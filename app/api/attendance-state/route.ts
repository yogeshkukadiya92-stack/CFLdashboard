import { getAppState, isDbEnabled, mutateAttendanceEntries } from "@/lib/db";
import type { AttendanceEntry, AttendanceSession, BuilderField } from "@/lib/types";
import { NextResponse } from "next/server";

function cleanText(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanMobile(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function validZoomUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "zoom.us" || url.hostname.endsWith(".zoom.us")) ? url.toString() : "";
  } catch {
    return "";
  }
}

function sessionTimestamp(session: AttendanceSession, time?: string) {
  if (!session.sessionDate || !time) return null;
  const timestamp = new Date(`${session.sessionDate}T${time}:00+05:30`).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function attendanceWindow(session: AttendanceSession, now = Date.now()) {
  const start = sessionTimestamp(session, session.startTime);
  const end = sessionTimestamp(session, session.endTime);
  const openMinutes = cleanNumber(session.openMinutesBefore, 60, 0, 1440);
  const lateMinutes = cleanNumber(session.lateAfterMinutes, 15, 0, 1440);
  const closeMinutes = cleanNumber(session.closeMinutesAfter, 120, 0, 2880);
  if (start && now < start - openMinutes * 60_000) return { allowed: false, reason: "Attendance has not opened yet.", late: false };
  const closeAt = (end ?? (start ? start + 4 * 60 * 60_000 : null));
  if (closeAt && now > closeAt + closeMinutes * 60_000) return { allowed: false, reason: "Attendance for this session is closed.", late: false };
  return { allowed: true, reason: "", late: Boolean(start && now > start + lateMinutes * 60_000) };
}

function publicSession(session: AttendanceSession) {
  const { zoomJoinUrl: _privateZoomJoinUrl, ...safe } = session;
  return {
    ...safe,
    attendanceWindow: attendanceWindow(session)
  };
}

function cleanAnswers(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(input)
      .slice(0, 100)
      .map(([key, answer]) => [key.slice(0, 200), cleanText(answer, 2000)])
  );
}

function fieldIsVisible(field: BuilderField, fields: BuilderField[], answers: Record<string, string>) {
  if (!field.visibility) return true;
  const sourceField = fields.find((item) => item.id === field.visibility?.fieldId);
  const source = sourceField ? (answers[sourceField.label] ?? "").trim() : "";
  const expected = (field.visibility.value ?? "").trim();
  if (field.visibility.operator === "answered") return Boolean(source);
  if (field.visibility.operator === "not_answered") return !source;
  if (field.visibility.operator === "not_equals") return source !== expected;
  if (field.visibility.operator === "contains") return source.toLowerCase().includes(expected.toLowerCase());
  return source === expected;
}

function requiredCustomFields(fields: BuilderField[], answers: Record<string, string>) {
  return fields.filter((field) => field.required && field.type !== "heading" && field.type !== "divider" && !field.role && fieldIsVisible(field, fields, answers));
}

export async function GET(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false });
  try {
    const state = await getAppState();
    const sessions = (Array.isArray(state?.attendanceSessions) ? state.attendanceSessions : []) as AttendanceSession[];
    const slug = new URL(request.url).searchParams.get("slug")?.trim();
    if (slug) {
      const session = sessions.find((item) => item.slug === slug && item.published !== false);
      return session
        ? NextResponse.json({ attendanceSession: publicSession(session), dbEnabled: true })
        : NextResponse.json({ error: "Attendance link is not active." }, { status: 404 });
    }
    return NextResponse.json({
      attendanceSessions: sessions.filter((session) => session.published !== false).map(publicSession),
      dbEnabled: true
    });
  } catch {
    return NextResponse.json({ error: "Failed to read attendance state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Attendance server is not configured." }, { status: 503 });
  try {
    const body = await request.json().catch(() => null) as { entry?: Record<string, unknown> } | null;
    const input = body?.entry;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid attendance entry." }, { status: 400 });
    }

    const state = await getAppState();
    const sessions = (Array.isArray(state?.attendanceSessions) ? state.attendanceSessions : []) as AttendanceSession[];
    const sessionId = cleanText(input.sessionId, 200);
    const sessionSlug = cleanText(input.sessionSlug, 200);
    const session = sessions.find((item) => item.id === sessionId && item.slug === sessionSlug && item.published !== false);
    if (!session) return NextResponse.json({ error: "Attendance session is not active." }, { status: 404 });

    const windowStatus = attendanceWindow(session);
    if (!windowStatus.allowed) return NextResponse.json({ error: windowStatus.reason }, { status: 403 });

    const mobileDigits = cleanMobile(input.mobile);
    const attendeeName = cleanText(input.attendeeName, 200);
    const email = cleanText(input.email, 254);
    const answers = cleanAnswers(input.answers);
    if (!attendeeName || mobileDigits.length !== 10 || !/^[6-9]/.test(mobileDigits)) {
      return NextResponse.json({ error: "Name and a valid 10-digit mobile number are required." }, { status: 400 });
    }
    const missingField = requiredCustomFields(session.fields, answers).find((field) => !answers[field.label]?.trim());
    if (missingField) return NextResponse.json({ error: `${missingField.label} is required.` }, { status: 400 });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const stableId = `att-${session.id}-${mobileDigits}`;
    const zoomJoinUrl = validZoomUrl(session.zoomJoinUrl);
    const responseMeta = {
      joinUrl: zoomJoinUrl,
      redirectDelaySeconds: cleanNumber(session.redirectDelaySeconds, 3, 0, 15),
      successMessage: cleanText(session.successMessage, 500) || "Attendance marked successfully. You can now join the live session."
    };
    const now = new Date().toISOString();
    const proposedEntry: AttendanceEntry = {
      answers,
      attendeeName,
      batch: cleanText(input.batch, 120) || session.batch || "",
      checkInAt: now,
      city: cleanText(input.city, 150),
      email,
      id: session.allowDuplicate ? crypto.randomUUID() : stableId,
      mobile: `+91 ${mobileDigits}`,
      sessionId: session.id,
      sessionSlug: session.slug,
      source: "attendance_form",
      status: windowStatus.late ? "late" : "checked_in",
      submittedAt: now,
      workshopId: session.workshopId,
      workshopName: session.workshopName
    };
    const saved = await mutateAttendanceEntries((rawEntries) => {
      const entries = rawEntries as AttendanceEntry[];
      const existing = entries.find((entry) => entry.id === stableId);
      if (existing && !session.allowDuplicate) return { entries, result: { duplicate: true, entry: existing } };
      return { entries: [proposedEntry, ...entries].slice(0, 20_000), result: { duplicate: false, entry: proposedEntry } };
    });
    return NextResponse.json({ ...saved, ok: true, ...responseMeta });
  } catch {
    return NextResponse.json({ error: "Failed to save attendance." }, { status: 500 });
  }
}
