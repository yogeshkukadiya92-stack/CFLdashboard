import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import { upsertLiveRegistration } from "@/lib/crm-db";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false });
  }

  try {
    const state = await getAppState();
    return NextResponse.json({
      dbEnabled: true,
      forms: state?.forms ?? [],
      registrationLinks: state?.registrationLinks ?? {},
      workshops: state?.workshops ?? []
    });
  } catch {
    return NextResponse.json({ error: "Failed to read registration state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false }, { status: 400 });
  }

  try {
    const body = await request.json();
    const registration = body?.registration;
    if (!registration || typeof registration !== "object" || Array.isArray(registration)) {
      return NextResponse.json({ error: "Invalid registration" }, { status: 400 });
    }

    const input = registration as Record<string, unknown>;
    const fullName = String(input.fullName ?? "").trim().slice(0, 200);
    const mobileDigits = String(input.mobile ?? "").replace(/\D/g, "").slice(-10);
    const workshopTitle = String(input.workshopTitle ?? "").trim().slice(0, 300);
    if (!fullName || !workshopTitle || mobileDigits.length !== 10 || !/^[6-9]/.test(mobileDigits)) {
      return NextResponse.json({ error: "Name, workshop and valid 10-digit mobile are required." }, { status: 400 });
    }

    const amountPaid = Math.min(10_000_000, Math.max(0, Number(input.amountPaid ?? 0) || 0));
    const amountDue = Math.min(10_000_000, Math.max(0, Number(input.amountDue ?? 0) || 0));
    const createdAtInput = String(input.createdAt ?? "");
    const createdAt = Number.isNaN(new Date(createdAtInput).getTime()) ? new Date().toISOString() : createdAtInput;
    const answersInput = input.answers && typeof input.answers === "object" && !Array.isArray(input.answers)
      ? input.answers as Record<string, unknown>
      : null;
    const answers = answersInput
      ? Object.fromEntries(Object.entries(answersInput).slice(0, 100).map(([key, value]) => [key.slice(0, 200), String(value ?? "").slice(0, 2000)]))
      : undefined;
    const sanitizedRegistration = {
      amountDue,
      amountPaid,
      answers,
      batch: String(input.batch ?? "Main Batch").trim().slice(0, 200),
      city: String(input.city ?? "").trim().slice(0, 150),
      createdAt,
      email: String(input.email ?? "").trim().slice(0, 254),
      facilitator: String(input.facilitator ?? "CFL Facilitator").trim().slice(0, 200),
      fullName,
      id: String(input.id ?? "").trim().slice(0, 300),
      mobile: `+91 ${mobileDigits}`,
      paymentMode: input.paymentMode === "Part" ? "Part" : "Full",
      status: amountDue > 0 ? "Due" : "Paid",
      whatsappVerificationStatus: input.whatsappVerificationStatus === "verified"
        ? "verified"
        : input.whatsappVerificationStatus === "not_verified"
          ? "not_verified"
          : "not_required",
      workshopId: String(input.workshopId ?? workshopTitle).trim().slice(0, 300),
      workshopSlug: String(input.workshopSlug ?? "").trim().slice(0, 300),
      workshopTitle
    };

    const state = await getAppState();
    const current = Array.isArray(state?.registrations) ? state.registrations : [];
    const registrationWithId = sanitizedRegistration as { id?: string };
    const next = registrationWithId.id
      ? [
          sanitizedRegistration,
          ...current.filter((item: unknown) => {
            return !(item && typeof item === "object" && "id" in item && (item as { id?: string }).id === registrationWithId.id);
          })
        ]
      : [sanitizedRegistration, ...current];

    await upsertLiveRegistration(sanitizedRegistration);
    await saveAppState({ registrations: next.slice(0, 5000) });
    return NextResponse.json({ ok: true, dbEnabled: true });
  } catch {
    return NextResponse.json({ error: "Failed to save registration" }, { status: 500 });
  }
}
