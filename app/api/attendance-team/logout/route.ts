import { NextResponse } from "next/server";
import { ATTENDANCE_TEAM_COOKIE } from "@/lib/attendance-team-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ httpOnly: true, maxAge: 0, name: ATTENDANCE_TEAM_COOKIE, path: "/", sameSite: "strict", value: "" });
  return response;
}
