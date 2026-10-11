import { getAppState, getDbPool, isDbEnabled, saveAppState } from "@/lib/db";
import { sendRegistrationStatusNotifications } from "@/lib/registration-confirmation";
import type { BuilderForm, RegistrationEntry } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ error: "Database is required to retry WhatsApp delivery." }, { status: 503 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const registrationId = String(body.registrationId ?? "").trim();
    if (!registrationId) return NextResponse.json({ error: "Registration is required." }, { status: 400 });

    if (body.resendConfirmation === true) {
      const workshopId = String(body.workshopId ?? "").trim();
      if (!workshopId) return NextResponse.json({ error: "Workshop is required." }, { status: 400 });
      const database = getDbPool()!;
      const result = await database.query<{ payload: RegistrationEntry }>(
        "SELECT payload FROM cfl_registration_records WHERE external_id=$1 AND workshop_id=$2", [registrationId, workshopId]);
      const entry = result.rows[0]?.payload;
      if (!entry) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
      if (entry.confirmationStatus !== "confirmed" || entry.registrationStatus === "waiting") {
        return NextResponse.json({ error: "Only confirmed participants can receive confirmation messages." }, { status: 400 });
      }
      const settings = await database.query(`SELECT
        (SELECT f FROM jsonb_array_elements(forms) f WHERE f->>'workshopId'=$1
        ORDER BY (COALESCE(f->>'batch', '')=$2) DESC LIMIT 1) AS form FROM app_state WHERE id=1`, [workshopId, entry.batch ?? ""]);
      const form = settings.rows[0]?.form as BuilderForm | undefined;
      if (!form?.whatsappConfirmationEnabled) return NextResponse.json({ error: "Enable confirmation WhatsApp in the workshop registration form first." }, { status: 400 });
      const patch = await sendRegistrationStatusNotifications({ ...entry, confirmationWhatsappSentAt: undefined }, form);
      const updated = await database.query<{ payload: RegistrationEntry }>(`UPDATE cfl_registration_records
        SET payload=(payload - 'confirmationWhatsappError') || $3::jsonb, updated_at=NOW()
        WHERE external_id=$1 AND workshop_id=$2 RETURNING payload`, [registrationId, workshopId, JSON.stringify(patch)]);
      return NextResponse.json({ registration: updated.rows[0]?.payload, sent: patch.confirmationWhatsappStatus === "sent" });
    }

    const state = await getAppState();
    const registrations = (Array.isArray(state?.registrations) ? state.registrations : []) as RegistrationEntry[];
    const registration = registrations.find((entry) => entry.id === registrationId);
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    const form = (Array.isArray(state?.forms) ? state.forms : [])
      .find((item: BuilderForm) => item.workshopId === registration.workshopId) as BuilderForm | undefined;
    const patch = await sendRegistrationStatusNotifications(registration, form);
    const saved = { ...registration, ...patch };
    const next = registrations.map((entry) => entry.id === registrationId ? saved : entry);
    await saveAppState({ registrations: next });
    return NextResponse.json({ registration: saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not retry WhatsApp delivery." }, { status: 500 });
  }
}
