import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: false,
    value: ""
  });
  return response;
}
