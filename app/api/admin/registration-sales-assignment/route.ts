import { NextResponse } from "next/server";
import { ensurePersistenceTable, ensureRegistrationRecordsTable, getDbPool } from "@/lib/db";
import { assignRegistrationLeads } from "@/lib/registration-sales-assignment";
import type { Lead, RegistrationEntry } from "@/lib/types";

export const runtime = "nodejs";

// /api/admin routes require the master admin session in proxy.ts.
export async function PATCH(request: Request) {
  const database = getDbPool();
  if (!database) return NextResponse.json({ error: "Database is required to assign registrations." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const workshopId = String(body.workshopId ?? "").trim();
  const salesPersonId = String(body.salesPersonId ?? "").trim();
  const ids = [...new Set((Array.isArray(body.registrationIds) ? body.registrationIds : []).map(String).filter(Boolean))];
  if (!workshopId || !salesPersonId || !ids.length || ids.length > 5000) {
    return NextResponse.json({ error: "Select a workshop, sales person and 1–5000 responses." }, { status: 400 });
  }
  try {
    await ensurePersistenceTable();
    await ensureRegistrationRecordsTable();
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const state = await client.query<{ leads: Lead[]; sales_people: Array<{ id: string; name: string; isActive?: boolean; salesPersonCode?: string }> }>("SELECT leads, sales_people FROM app_state WHERE id=1 FOR UPDATE");
      const person = state.rows[0]?.sales_people.find((item) => item.id === salesPersonId && item.isActive !== false);
      if (!person) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Please select an active sales person." }, { status: 400 });
      }
      const selected = await client.query<{ payload: RegistrationEntry }>("SELECT payload FROM cfl_registration_records WHERE workshop_id=$1 AND external_id=ANY($2::text[])", [workshopId, ids]);
      if (selected.rows.length !== ids.length) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Some selected responses are unavailable. Refresh and select again." }, { status: 409 });
      }
      let result;
      try { result = assignRegistrationLeads(state.rows[0].leads ?? [], selected.rows.map((row) => row.payload), person); }
      catch (error) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not assign responses." }, { status: 409 });
      }
      await client.query("UPDATE app_state SET leads=$1::jsonb, updated_at=NOW() WHERE id=1", [JSON.stringify(result.leads)]);
      await client.query("COMMIT");
      return NextResponse.json({ assigned: result.assigned, created: result.created, salesPersonName: person.name });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  } catch (error) {
    console.error("Registration sales assignment failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not assign the selected responses. Please try again." }, { status: 500 });
  }
}
