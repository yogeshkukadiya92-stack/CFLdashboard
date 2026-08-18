import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { SALES_SESSION_COOKIE } from "@/lib/sales-session";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: ""
  });
  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: SALES_SESSION_COOKIE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: ""
  });
  return response;
}
