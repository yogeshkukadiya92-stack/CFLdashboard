import { ensurePersistenceTable, getDbPool, isDbEnabled } from "@/lib/db";
import type { RegistrationEntry } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function renumberWaitingList(registrations: RegistrationEntry[], workshopId: string) {
  const waiting = registrations
    .filter((entry) => entry.workshopId === workshopId && entry.registrationStatus === "waiting")
    .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
  const positions = new Map(waiting.map((entry, index) => [entry.id, index + 1]));

  return registrations.map((entry) => positions.has(entry.id)
    ? { ...entry, waitingPosition: positions.get(entry.id) }
    : entry);
}

export async function PATCH(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ error: "Database is required to update the waiting list." }, { status: 503 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const workshopId = String(body.workshopId ?? "").trim();
    const registrationIds = Array.from(new Set(
      (Array.isArray(body.registrationIds) ? body.registrationIds : [])
        .map((value) => String(value).trim())
        .filter(Boolean)
    )).slice(0, 5000);
    if (!workshopId || !registrationIds.length) {
      return NextResponse.json({ error: "Workshop and waiting registrations are required." }, { status: 400 });
    }

    const database = getDbPool();
    if (!database) return NextResponse.json({ error: "Database is not configured." }, { status: 500 });
    await ensurePersistenceTable();
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(`SELECT registrations FROM app_state WHERE id = 1 FOR UPDATE`);
      const registrations = (Array.isArray(selected.rows[0]?.registrations) ? selected.rows[0].registrations : []) as RegistrationEntry[];
      const requestedIds = new Set(registrationIds);
      let promoted = 0;
      const promotedRegistrations = registrations.map((entry) => {
        if (entry.workshopId !== workshopId || entry.registrationStatus !== "waiting" || !requestedIds.has(entry.id)) return entry;
        promoted += 1;
        return { ...entry, registrationStatus: "confirmed" as const, waitingPosition: undefined };
      });
      if (!promoted) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No matching waiting registrations were found." }, { status: 404 });
      }

      const next = renumberWaitingList(promotedRegistrations, workshopId);
      await client.query(`UPDATE app_state SET registrations = $1::jsonb, updated_at = NOW() WHERE id = 1`, [JSON.stringify(next)]);
      await client.query("COMMIT");
      return NextResponse.json({ promoted, registrations: next });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ error: "Could not convert waiting registrations." }, { status: 500 });
  }
}
