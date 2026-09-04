import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAppState, saveAppState } from "@/lib/db";
import { sendRegistrationStatusNotifications } from "@/lib/registration-confirmation";
import type { BuilderForm, RegistrationEntry } from "@/lib/types";
import { claimDueWhatsAppRetries, finishWhatsAppRetry, getWhatsAppAutomationOverview } from "@/lib/whatsapp-automation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    const items = await claimDueWhatsAppRetries(10);
    let registrations = Array.isArray(state.registrations) ? state.registrations as RegistrationEntry[] : [];
    const forms = Array.isArray(state.forms) ? state.forms as BuilderForm[] : [];
    const results = [];
    for (const item of items) {
      const registration = registrations.find((entry) => entry.id === item.registrationId);
      if (!registration) {
        await finishWhatsAppRetry(item.id, false, "Registration not found for retry.");
        results.push({ id: item.id, success: false });
        continue;
      }
      const form = forms.find((candidate) => candidate.workshopId === registration.workshopId);
      const patch = await sendRegistrationStatusNotifications(registration, form);
      const status = registration.registrationStatus === "waiting" ? patch.waitingWhatsappStatus : patch.confirmationWhatsappStatus;
      const success = status === "sent";
      if (Object.keys(patch).length) registrations = registrations.map((entry) => entry.id === registration.id ? { ...entry, ...patch } : entry);
      await finishWhatsAppRetry(item.id, success, success ? "" : "WhatsApp provider retry failed.");
      results.push({ id: item.id, success });
    }
    if (results.length) await saveAppState({ registrations });
    return NextResponse.json({ ok: true, processed: results.length, succeeded: results.filter((result) => result.success).length, overview: await getWhatsAppAutomationOverview() });
  } catch {
    return NextResponse.json({ error: "Could not process WhatsApp retries." }, { status: 500 });
  }
}
