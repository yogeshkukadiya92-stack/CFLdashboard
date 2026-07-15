import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import { NextResponse } from "next/server";

function cleanText(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanMobile(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

export async function GET() {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false });
  }

  try {
    const state = await getAppState();
    const sessions = Array.isArray(state?.attendanceSessions) ? state.attendanceSessions : [];
    return NextResponse.json({
      attendanceSessions: sessions.filter((session: unknown) => {
        return session && typeof session === "object" && (session as { published?: boolean }).published !== false;
      }),
      dbEnabled: true
    });
  } catch {
    return NextResponse.json({ error: "Failed to read attendance state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false }, { status: 400 });
  }

  try {
    const body = await request.json();
    const input = body?.entry;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid attendance entry" }, { status: 400 });
    }

    const record = input as Record<string, unknown>;
    const mobileDigits = cleanMobile(record.mobile);
    const attendeeName = cleanText(record.attendeeName, 200);
    const sessionId = cleanText(record.sessionId, 200);
    const sessionSlug = cleanText(record.sessionSlug, 200);
    const workshopName = cleanText(record.workshopName, 300);
    if (!attendeeName || !sessionId || !sessionSlug || !workshopName || mobileDigits.length !== 10 || !/^[6-9]/.test(mobileDigits)) {
      return NextResponse.json({ error: "Name, valid mobile, session and workshop are required." }, { status: 400 });
    }

    const answersInput = record.answers && typeof record.answers === "object" && !Array.isArray(record.answers)
      ? record.answers as Record<string, unknown>
      : {};
    const answers = Object.fromEntries(
      Object.entries(answersInput)
        .slice(0, 100)
        .map(([key, value]) => [key.slice(0, 200), cleanText(value, 2000)])
    );

    const entry = {
      answers,
      attendeeName,
      city: cleanText(record.city, 150),
      email: cleanText(record.email, 254),
      id: cleanText(record.id, 300) || `att-${sessionId}-${mobileDigits}`,
      mobile: `+91 ${mobileDigits}`,
      sessionId,
      sessionSlug,
      submittedAt: new Date().toISOString(),
      workshopId: cleanText(record.workshopId, 200),
      workshopName
    };

    const state = await getAppState();
    const current = Array.isArray(state?.attendanceEntries) ? state.attendanceEntries : [];
    const next = [
      entry,
      ...current.filter((item: unknown) => {
        return !(item && typeof item === "object" && "id" in item && (item as { id?: string }).id === entry.id);
      })
    ];

    await saveAppState({ attendanceEntries: next.slice(0, 10000) });
    return NextResponse.json({ dbEnabled: true, ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 });
  }
}
