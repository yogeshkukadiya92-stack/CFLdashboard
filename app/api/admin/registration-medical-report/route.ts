import { NextResponse } from "next/server";
import { ensurePersistenceTable, ensureRegistrationRecordsTable, getDbPool, upsertRegistrationRecord } from "@/lib/db";
import { isHealthyForeverWorkshop } from "@/lib/healthy-forever";
import type { RegistrationEntry } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const database = getDbPool();
  if (!database) return NextResponse.json({ error: "Database is required to update medical report status." }, { status: 503 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const registrationId = String(body.registrationId ?? "").trim();
    const status = String(body.status ?? "").trim();
    if (!registrationId || (status !== "yes" && status !== "no")) {
      return NextResponse.json({ error: "Registration and a Yes or No status are required." }, { status: 400 });
    }

    await ensurePersistenceTable();
    await ensureRegistrationRecordsTable();
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query<{ payload: RegistrationEntry }>(
        "SELECT payload FROM cfl_registration_records WHERE external_id=$1 FOR UPDATE",
        [registrationId]
      );
      const current = selected.rows[0]?.payload;
      if (!current) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Registration not found." }, { status: 404 });
      }
      if (!isHealthyForeverWorkshop(current.workshopTitle)) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Medical report status is available only for Healthy Forever workshops." }, { status: 403 });
      }

      const updated: RegistrationEntry = {
        ...current,
        medicalReportStatus: status,
        medicalReportUpdatedAt: new Date().toISOString(),
        medicalReportUpdatedBy: "Admin User"
      };
      await upsertRegistrationRecord(client, updated as unknown as Record<string, unknown>);
      await client.query(`UPDATE app_state SET registrations=COALESCE((SELECT jsonb_agg(
        CASE WHEN item->>'id'=$1 THEN item || $2::jsonb ELSE item END)
        FROM jsonb_array_elements(registrations) item), '[]'::jsonb), updated_at=NOW() WHERE id=1`,
        [registrationId, JSON.stringify(updated)]);
      await client.query("COMMIT");
      return NextResponse.json({ registration: updated });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update medical report status." }, { status: 500 });
  }
}
