import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { canUseManualOtpOverride } from "@/lib/otp-override";
import { NextRequest, NextResponse } from "next/server";

import { clearOtp, verifyStoredOtp } from "@/lib/otp-store";

function cleanMobile(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function cleanOtp(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 6);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mobile = cleanMobile(body?.mobile);
    const otp = cleanOtp(body?.otp);
    if (mobile.length !== 10 || otp.length !== 6) {
      return NextResponse.json({ error: "Valid mobile and 6-digit OTP are required." }, { status: 400 });
    }

    const isAdmin = await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
    if (canUseManualOtpOverride({
      configuredCode: process.env.ADMIN_MANUAL_OTP_CODE,
      isAdmin,
      submittedCode: otp
    })) {
      await clearOtp(mobile);
      return NextResponse.json({ manualOverride: true, ok: true });
    }

    const result = await verifyStoredOtp(mobile, otp);
    if (result === "expired") return NextResponse.json({ error: "OTP expired. Please request a new OTP." }, { status: 400 });
    if (result === "locked") return NextResponse.json({ error: "Too many wrong attempts. Please request a new OTP." }, { status: 429 });
    if (result === "incorrect") return NextResponse.json({ error: "Incorrect OTP." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not verify OTP. Please try again." }, { status: 500 });
  }
}
