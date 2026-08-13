import { NextResponse } from "next/server";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import type {
  BuilderForm,
  RegistrationConfirmationActivity,
  RegistrationConfirmationStatus,
  RegistrationEntry
} from "@/lib/types";
import { assignRegistrationNumbers, sendRegistrationConfirmation } from "@/lib/registration-confirmation";
import { syncConfirmedRegistrationToMfw } from "@/lib/mfw-registration";

export const runtime = "nodejs";

const validStatuses: RegistrationConfirmationStatus[] = [
  "pending",
  "confirmed",
  "not_confirmed",
  "no_answer",
  "callback",
  "cancelled"
];

export async function PATCH(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ error: "Database is required to update follow-up details." }, { status: 503 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const registrationId = String(body.registrationId ?? "").trim();
    const status = String(body.status ?? "pending") as RegistrationConfirmationStatus;
    const note = String(body.note ?? "").trim().slice(0, 2000);
    if (!registrationId || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Registration and a valid confirmation status are required." }, { status: 400 });
    }

    const state = await getAppState();
    const registrations = (Array.isArray(state?.registrations) ? state.registrations : []) as RegistrationEntry[];
    const current = registrations.find((entry) => entry.id === registrationId);
    if (!current) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

    const now = new Date().toISOString();
    const activity: RegistrationConfirmationActivity = {
      id: crypto.randomUUID(),
      action: "status",
      status,
      note: note || undefined,
      actorGrantId: "admin",
      actorName: "Admin User",
      createdAt: now
    };
    const mfwSync = status === "confirmed" ? await syncConfirmedRegistrationToMfw(current) : {};
    const updated: RegistrationEntry = {
      ...current,
      ...mfwSync,
      confirmationStatus: status,
      confirmationNote: note,
      confirmationUpdatedAt: now,
      confirmationUpdatedBy: "Admin User",
      confirmationHistory: [activity, ...(current.confirmationHistory ?? [])].slice(0, 200)
    };
    let next = assignRegistrationNumbers(registrations.map((entry) => entry.id === registrationId ? updated : entry), current.workshopId);
    let saved = next.find((entry) => entry.id === registrationId) as RegistrationEntry;
    if (status === "confirmed") {
      const form = (Array.isArray(state?.forms) ? state.forms : [])
        .find((item: BuilderForm) => item.workshopId === current.workshopId) as BuilderForm | undefined;
      const whatsapp = await sendRegistrationConfirmation(saved, form).catch(() => ({ configured: true, sent: false }));
      if (whatsapp.sent) {
        saved = { ...saved, confirmationWhatsappSentAt: now };
        next = next.map((entry) => entry.id === registrationId ? saved : entry);
      }
    }
    await saveAppState({ registrations: next });
    return NextResponse.json({ registration: saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update follow-up details." }, { status: 500 });
  }
}
