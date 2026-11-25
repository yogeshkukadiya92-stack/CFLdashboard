import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import {
  medicalKey,
  medicalMapping,
  availableMedicalSlots,
} from "@/lib/mfw-medical";
import type { RegistrationEntry } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    typeof body?.secret !== "string" ||
    body.secret.length !== 36 ||
    typeof body.registrationId !== "string" ||
    !["status", "book"].includes(body.action) ||
    (body.action === "book" && typeof body.slot !== "string")
  )
    return new Response(null, { status: 400 });
  const db = getDbPool();
  if (!db) return new Response(null, { status: 503 });
  const client = await db.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT payload FROM cfl_registration_records WHERE external_id=$1
      AND payload->>'registrationStatus'='confirmed' AND payload->>'medicalSlotAccess'=$2 FOR UPDATE`,
      [body.registrationId, medicalKey(body.secret)]
    );
    const registration = result.rows[0]?.payload as
      | RegistrationEntry
      | undefined;
    if (!registration) return new Response(null, { status: 403 });
    if (registration.medicalBookingReceipt)
      return NextResponse.json({ receipt: registration.medicalBookingReceipt });
    const mapping = await medicalMapping(registration.workshopId, client);
    if (!mapping) return new Response(null, { status: 404 });
    const enrolled =
      registration.mfwSyncStatus === "synced" &&
      registration.mfwWorkshopEventId === mapping.event &&
      Boolean(registration.mfwParticipantId);
    if (body.action === "status") {
      const slots = await availableMedicalSlots(mapping);
      return NextResponse.json({ slots, enrolled });
    }
    if (!enrolled)
      return NextResponse.json(
        { error: "Enrollment is processing. Please try again shortly." },
        { status: 409 }
      );
    const url = String(process.env.MFW_API_BASE_URL || "").replace(/\/+$/, "");
    const response = await fetch(
      url +
        "/integrations/v1/workshops/" +
        encodeURIComponent(mapping.event) +
        "/appointments",
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
        headers: {
          "Content-Type": "application/json",
          "x-mfw-api-key": process.env.MFW_INTEGRATION_API_KEY || "",
        },
        body: JSON.stringify({
          formToken: mapping.token,
          participantId: registration.mfwParticipantId,
          slotId: body.slot,
        }),
      }
    );
    if (!response.ok)
      return NextResponse.json(
        {
          error:
            response.status === 409
              ? "This time is unavailable. Please select another slot."
              : "MFW could not confirm the booking. Please try again.",
        },
        { status: response.status === 409 ? 409 : 503 }
      );
    const { receipt } = await response.json();
    if (!receipt?.id || !receipt.startsAt || !receipt.endsAt)
      throw new Error("Missing appointment receipt");
    await client.query(
      "UPDATE cfl_registration_records SET payload=payload || jsonb_build_object('medicalBookingReceipt',$2::jsonb),updated_at=now() WHERE external_id=$1",
      [registration.id, receipt]
    );
    await client.query("COMMIT");
    committed = true;
    return NextResponse.json({ receipt });
  } catch {
    return NextResponse.json(
      { error: "MFW is unavailable. Please try again." },
      { status: 503 }
    );
  } finally {
    try {
      if (!committed) await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}
