import { ensurePersistenceTable, getDbPool, isDbEnabled } from "@/lib/db";
import { upsertLiveRegistration } from "@/lib/crm-db";
import type { RegistrationEntry } from "@/lib/types";
import type { BuilderForm } from "@/lib/types";
import { assignRegistrationNumbers, sendRegistrationConfirmation } from "@/lib/registration-confirmation";
import { syncConfirmedRegistrationToMfw } from "@/lib/mfw-registration";
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
      const selected = await client.query(`SELECT registrations, forms FROM app_state WHERE id = 1 FOR UPDATE`);
      const registrations = (Array.isArray(selected.rows[0]?.registrations) ? selected.rows[0].registrations : []) as RegistrationEntry[];
      const requestedIds = new Set(registrationIds);
      const confirmedAt = new Date().toISOString();
      let promoted = 0;
      const promotedRegistrations = registrations.map((entry) => {
        if (entry.workshopId !== workshopId || entry.registrationStatus !== "waiting" || !requestedIds.has(entry.id)) return entry;
        promoted += 1;
        return {
          ...entry,
          confirmationStatus: "confirmed" as const,
          confirmationSource: "manual" as const,
          confirmationUpdatedAt: confirmedAt,
          confirmationUpdatedBy: "Workshop Master Admin",
          registrationStatus: "confirmed" as const,
          waitingPosition: undefined,
          waitingReason: undefined
        };
      });
      if (!promoted) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No matching waiting registrations were found." }, { status: 404 });
      }

      let next = assignRegistrationNumbers(renumberWaitingList(promotedRegistrations, workshopId), workshopId);
      for (const registration of next.filter((entry) => requestedIds.has(entry.id) && entry.registrationStatus === "confirmed")) {
        const mfwSync = await syncConfirmedRegistrationToMfw(registration);
        next = next.map((entry) => entry.id === registration.id ? { ...entry, ...mfwSync } : entry);
      }
      await client.query(`UPDATE app_state SET registrations = $1::jsonb, updated_at = NOW() WHERE id = 1`, [JSON.stringify(next)]);
      await client.query("COMMIT");
      const form = (Array.isArray(selected.rows[0]?.forms) ? selected.rows[0].forms : [])
        .find((item: BuilderForm) => item.workshopId === workshopId) as BuilderForm | undefined;
      const promotedEntries = next.filter((entry) => requestedIds.has(entry.id) && entry.registrationStatus === "confirmed");
      for (const entry of promotedEntries) {
        await upsertLiveRegistration(entry as unknown as Record<string, unknown>);
      }
      const sentIds = new Set<string>();
      for (const entry of promotedEntries) {
        const result = await sendRegistrationConfirmation(entry, form).catch(() => ({ configured: true, sent: false }));
        if (result.sent) sentIds.add(entry.id);
      }
      if (sentIds.size) {
        const sentAt = new Date().toISOString();
        next = next.map((entry) => sentIds.has(entry.id) ? { ...entry, confirmationWhatsappSentAt: sentAt } : entry);
        await client.query(`UPDATE app_state SET registrations = $1::jsonb, updated_at = NOW() WHERE id = 1`, [JSON.stringify(next)]);
      }
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
