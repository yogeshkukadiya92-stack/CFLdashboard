import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
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
