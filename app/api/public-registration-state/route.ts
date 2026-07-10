import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
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

    const state = await getAppState();
    const current = Array.isArray(state?.registrations) ? state.registrations : [];
    const registrationWithId = registration as { id?: string };
    const next = registrationWithId.id
      ? [
          registration,
          ...current.filter((item: unknown) => {
            return !(item && typeof item === "object" && "id" in item && (item as { id?: string }).id === registrationWithId.id);
          })
        ]
      : [registration, ...current];

    await saveAppState({ registrations: next });
    return NextResponse.json({ ok: true, dbEnabled: true });
  } catch {
    return NextResponse.json({ error: "Failed to save registration" }, { status: 500 });
  }
}
