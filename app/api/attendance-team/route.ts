import { NextRequest, NextResponse } from "next/server";
import { getAppState, isDbEnabled, mutateAttendanceEntries } from "@/lib/db";
import { ATTENDANCE_TEAM_COOKIE, attendanceTeamUserExpired, verifyAttendanceTeamSession } from "@/lib/attendance-team-auth";
import type { AttendanceEntry, AttendanceSession, AttendanceTeamUser } from "@/lib/types";

async function context(request: NextRequest) {
  const state = await getAppState();
  const users = (Array.isArray(state?.attendanceTeamUsers) ? state.attendanceTeamUsers : []) as AttendanceTeamUser[];
  const token = request.cookies.get(ATTENDANCE_TEAM_COOKIE)?.value;
  const user = users.find((item) => item.active && !attendanceTeamUserExpired(item) && verifyAttendanceTeamSession(token, item));
  return { state, user };
}

function maskMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `+91 ******${digits.slice(-4)}` : "";
}

function maskEmail(value?: string) {
  if (!value) return "";
  const [local, domain] = value.split("@");
  return domain ? `${local.slice(0, 1)}***@${domain}` : "Hidden";
}

function cleanEntry(entry: AttendanceEntry, user: AttendanceTeamUser) {
  return {
    ...entry,
    answers: user.permissions.viewAnswers ? entry.answers : undefined,
    email: user.permissions.revealContact ? entry.email : maskEmail(entry.email),
    mobile: user.permissions.revealContact ? entry.mobile : maskMobile(entry.mobile)
  };
}

export async function GET(request: NextRequest) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Attendance access is unavailable." }, { status: 503 });
  try {
    const { state, user } = await context(request);
    if (!user) return NextResponse.json({ authorized: false }, { status: 401 });
    const sessionIds = new Set(user.sessionIds);
    const sessions = ((Array.isArray(state?.attendanceSessions) ? state.attendanceSessions : []) as AttendanceSession[])
      .filter((session) => sessionIds.has(session.id))
      .map(({ zoomJoinUrl: _zoomJoinUrl, ...session }) => session);
    const entries = ((Array.isArray(state?.attendanceEntries) ? state.attendanceEntries : []) as AttendanceEntry[])
      .filter((entry) => sessionIds.has(entry.sessionId))
      .map((entry) => cleanEntry(entry, user));
    return NextResponse.json({
      authorized: true,
      entries,
      sessions,
      user: { email: user.email, name: user.name, permissions: user.permissions }
    });
  } catch {
    return NextResponse.json({ error: "Could not load attendance responses." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Attendance access is unavailable." }, { status: 503 });
  try {
    const { state, user } = await context(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!user.permissions.editAttendance) return NextResponse.json({ error: "You do not have edit permission." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { id?: string; status?: AttendanceEntry["status"] };
    const allowedStatuses = new Set(["checked_in", "late", "joined_zoom", "completed"]);
    if (!body.status || !allowedStatuses.has(body.status)) return NextResponse.json({ error: "Attendance response not found." }, { status: 404 });
    const now = new Date().toISOString();
    const updated = await mutateAttendanceEntries((rawEntries) => {
      const entries = rawEntries as AttendanceEntry[];
      const target = entries.find((entry) => entry.id === body.id && user.sessionIds.includes(entry.sessionId));
      if (!target) return { entries, result: null };
      const entry: AttendanceEntry = {
        ...target,
        status: body.status,
        joinedZoomAt: body.status === "joined_zoom" && !target.joinedZoomAt ? now : target.joinedZoomAt,
        leftZoomAt: body.status === "completed" && !target.leftZoomAt ? now : target.leftZoomAt
      };
      return { entries: entries.map((item) => item.id === entry.id ? entry : item), result: entry };
    });
    if (!updated) return NextResponse.json({ error: "Attendance response not found." }, { status: 404 });
    return NextResponse.json({ entry: cleanEntry(updated, user), ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update attendance." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Attendance access is unavailable." }, { status: 503 });
  try {
    const { state, user } = await context(request);
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!user.permissions.deleteResponses) return NextResponse.json({ error: "You do not have delete permission." }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id")?.trim();
    const removed = await mutateAttendanceEntries((rawEntries) => {
      const entries = rawEntries as AttendanceEntry[];
      const target = entries.find((entry) => entry.id === id && user.sessionIds.includes(entry.sessionId));
      return target
        ? { entries: entries.filter((entry) => entry.id !== target.id), result: true }
        : { entries, result: false };
    });
    if (!removed) return NextResponse.json({ error: "Attendance response not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete attendance response." }, { status: 500 });
  }
}
