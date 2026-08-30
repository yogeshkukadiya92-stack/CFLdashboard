import { NextRequest, NextResponse } from "next/server";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import { ATTENDANCE_TEAM_COOKIE, attendanceTeamSessionMaxAge, attendanceTeamUserExpired, createAttendanceTeamSession, verifyAttendanceTeamAccessToken } from "@/lib/attendance-team-auth";
import type { AttendanceTeamUser } from "@/lib/types";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const loginUrl = new URL("/attendance-team/login", request.url);
  if (!(await isDbEnabled())) return NextResponse.redirect(loginUrl);
  const { token } = await context.params;
  try {
    const state = await getAppState();
    const users = (Array.isArray(state?.attendanceTeamUsers) ? state.attendanceTeamUsers : []) as AttendanceTeamUser[];
    const user = users.find((item) => item.active && !attendanceTeamUserExpired(item) && verifyAttendanceTeamAccessToken(token, item));
    if (!user) return NextResponse.redirect(loginUrl);
    const updated = { ...user, lastLoginAt: new Date().toISOString(), loginCount: user.loginCount + 1 };
    await saveAppState({ attendanceTeamUsers: [updated, ...users.filter((item) => item.id !== user.id)] });
    const response = NextResponse.redirect(new URL("/attendance-team", request.url));
    response.cookies.set({ httpOnly: true, maxAge: attendanceTeamSessionMaxAge(updated), name: ATTENDANCE_TEAM_COOKIE, path: "/", sameSite: "strict", secure: process.env.NODE_ENV === "production", value: createAttendanceTeamSession(updated) });
    return response;
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}
