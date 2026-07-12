import { AUTH_COOKIE_NAME, createAuthToken, getAdminEmail, getAdminPassword } from "@/lib/auth";
import { NextResponse } from "next/server";

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function registerFailedAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  const next = !current || current.resetAt < now
    ? { count: 1, resetAt: now + WINDOW_MS }
    : { count: current.count + 1, resetAt: current.resetAt };
  attempts.set(key, next);
  return next;
}

function isLimited(key: string) {
  const current = attempts.get(key);
  return Boolean(current && current.resetAt > Date.now() && current.count >= MAX_ATTEMPTS);
}

export async function POST(request: Request) {
  const key = clientKey(request);
  if (isLimited(key)) {
    return NextResponse.json({ message: "Too many login attempts. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  const adminEmail = getAdminEmail();

  if (email !== adminEmail.toLowerCase() || password !== getAdminPassword()) {
    registerFailedAttempt(key);
    return NextResponse.json({ message: "Invalid admin email or password." }, { status: 401 });
  }

  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    name: AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: await createAuthToken(adminEmail)
  });

  return response;
}
