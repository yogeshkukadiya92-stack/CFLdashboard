import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { createWorkshopOtpFallbackHash } from "@/lib/workshop-otp-fallback";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (!(await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const formId = String(body?.formId ?? "").trim();
    const code = String(body?.code ?? "").replace(/\D/g, "").slice(0, 6);
    if (!formId || code.length !== 6) {
      return NextResponse.json({ error: "Enter a valid 6-digit fallback OTP." }, { status: 400 });
    }
    return NextResponse.json({ hash: createWorkshopOtpFallbackHash(formId, code), ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save fallback OTP." }, { status: 500 });
  }
}
