import { NextRequest, NextResponse } from "next/server";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import { ATTENDANCE_TEAM_COOKIE, attendanceTeamSessionMaxAge, attendanceTeamUserExpired, createAttendanceTeamSession, verifyAttendanceTeamPassword } from "@/lib/attendance-team-auth";
import type { AttendanceTeamUser } from "@/lib/types";

const ATTEMPTS = (globalThis as unknown as { __cflAttendanceTeamAttempts?: Map<string, { count: number; resetAt: number }> }).__cflAttendanceTeamAttempts ?? new Map<string, { count: number; resetAt: number }>();
(globalThis as unknown as { __cflAttendanceTeamAttempts?: typeof ATTEMPTS }).__cflAttendanceTeamAttempts = ATTEMPTS;

export async function POST(request: NextRequest) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Attendance access is unavailable." }, { status: 503 });
  try {
    const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const now = Date.now();
    const attempt = ATTEMPTS.get(client);
    if (attempt && attempt.resetAt > now && attempt.count >= 8) return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const state = await getAppState();
    const users = (Array.isArray(state?.attendanceTeamUsers) ? state.attendanceTeamUsers : []) as AttendanceTeamUser[];
    const user = users.find((item) => item.email === email);
    if (!user || !user.active || attendanceTeamUserExpired(user) || !verifyAttendanceTeamPassword(String(body.password ?? ""), user)) {
      ATTEMPTS.set(client, !attempt || attempt.resetAt <= now ? { count: 1, resetAt: now + 15 * 60_000 } : { ...attempt, count: attempt.count + 1 });
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    ATTEMPTS.delete(client);
    const updated = { ...user, lastLoginAt: new Date().toISOString(), loginCount: user.loginCount + 1 };
    await saveAppState({ attendanceTeamUsers: [updated, ...users.filter((item) => item.id !== user.id)] });
    const response = NextResponse.json({ ok: true });
    response.cookies.set({ httpOnly: true, maxAge: attendanceTeamSessionMaxAge(updated), name: ATTENDANCE_TEAM_COOKIE, path: "/", sameSite: "strict", secure: process.env.NODE_ENV === "production", value: createAttendanceTeamSession(updated) });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
