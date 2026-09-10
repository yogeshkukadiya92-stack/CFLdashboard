import { after, NextResponse } from "next/server";
import {
  ensurePersistenceTable,
  ensureRegistrationRecordsTable,
  getDbPool,
  reserveRegistrationNumber,
  upsertRegistrationRecord
} from "@/lib/db";
import { ensureRegistrationHotPath } from "@/lib/registration-hot-path";
import { drainRegistrationJobs, ensureRegistrationJobs } from "@/lib/registration-jobs";
import type { RegistrationEntry } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const database = getDbPool();
  if (!database) return NextResponse.json({ error: "Database is required to assign participants to MFW." }, { status: 503 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const workshopId = String(body.workshopId ?? "").trim();
    const ids = [...new Set((Array.isArray(body.registrationIds) ? body.registrationIds : [])
      .map(String).map((value) => value.trim()).filter(Boolean))].slice(0, 5000);
    if (!workshopId || !ids.length) {
      return NextResponse.json({ error: "Workshop and confirmed registrations are required." }, { status: 400 });
    }

    await ensurePersistenceTable();
    await ensureRegistrationRecordsTable();
    await ensureRegistrationJobs();
    await ensureRegistrationHotPath();

    const client = await database.connect();
    let queued = 0;
    let promoted = 0;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`registration-workshop:${workshopId}`]);
      const selected = await client.query<{ payload: RegistrationEntry }>(`SELECT payload FROM cfl_registration_records
        WHERE workshop_id=$1 AND external_id=ANY($2::text[]) ORDER BY external_id FOR UPDATE`, [workshopId, ids]);

      for (const { payload: entry } of selected.rows) {
        if (entry.confirmationStatus !== "confirmed" || entry.mfwSyncStatus === "synced") continue;
        const wasWaiting = entry.registrationStatus === "waiting";
        const next: RegistrationEntry = {
          ...entry,
          registrationStatus: "confirmed",
          waitingPosition: undefined,
          waitingReason: undefined,
          registrationNumber: entry.registrationNumber || await reserveRegistrationNumber(client),
          mfwSyncOnly: true,
          mfwSyncStatus: "pending",
          mfwSyncError: undefined
        };
        await upsertRegistrationRecord(client, next as unknown as Record<string, unknown>);
        await client.query(`INSERT INTO cfl_registration_jobs(registration_id) VALUES($1)
          ON CONFLICT(registration_id) DO UPDATE SET completed_at=NULL,available_at=NOW(),attempts=0,last_error=NULL,
          revision=cfl_registration_jobs.revision+1`, [entry.id]);
        queued++;
        if (wasWaiting) promoted++;
      }

      if (!queued) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No selected participants need MFW assignment." }, { status: 409 });
      }
      if (promoted) {
        await client.query(`WITH positions AS (
          SELECT external_id,row_number() OVER(ORDER BY created_at,external_id) position FROM cfl_registration_records
          WHERE workshop_id=$1 AND payload->>'registrationStatus'='waiting')
          UPDATE cfl_registration_records r SET payload=jsonb_set(r.payload,'{waitingPosition}',to_jsonb(p.position)),updated_at=NOW()
          FROM positions p WHERE r.external_id=p.external_id AND r.payload->>'waitingPosition' IS DISTINCT FROM p.position::text`, [workshopId]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    after(() => process.env.REGISTRATION_WORKER_ENABLED === "false" ? Promise.resolve() : drainRegistrationJobs());
    const result = await database.query<{ payload: RegistrationEntry }>(`SELECT payload FROM cfl_registration_records
      WHERE workshop_id=$1 ORDER BY created_at DESC,external_id DESC`, [workshopId]);
    return NextResponse.json({ queued, registrations: result.rows.map((row) => row.payload), scope: "workshop", workshopId });
  } catch (error) {
    console.error("Bulk MFW assignment failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not assign the selected participants to MFW." }, { status: 500 });
  }
}
