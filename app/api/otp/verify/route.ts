import { NextResponse } from "next/server";

type OtpRecord = {
  attempts: number;
  code: string;
  expiresAt: number;
};

const OTP_STORE = (globalThis as unknown as { __cflOtpStore?: Map<string, OtpRecord> }).__cflOtpStore ?? new Map<string, OtpRecord>();
(globalThis as unknown as { __cflOtpStore?: Map<string, OtpRecord> }).__cflOtpStore = OTP_STORE;

function cleanMobile(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function cleanOtp(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 6);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mobile = cleanMobile(body?.mobile);
    const otp = cleanOtp(body?.otp);
    if (mobile.length !== 10 || otp.length !== 6) {
      return NextResponse.json({ error: "Valid mobile and 6-digit OTP are required." }, { status: 400 });
    }

    const record = OTP_STORE.get(mobile);
    if (!record || record.expiresAt <= Date.now()) {
      OTP_STORE.delete(mobile);
      return NextResponse.json({ error: "OTP expired. Please request a new OTP." }, { status: 400 });
    }
    if (record.attempts >= 5) {
      OTP_STORE.delete(mobile);
      return NextResponse.json({ error: "Too many wrong attempts. Please request a new OTP." }, { status: 429 });
    }
    if (record.code !== otp) {
      OTP_STORE.set(mobile, { ...record, attempts: record.attempts + 1 });
      return NextResponse.json({ error: "Incorrect OTP." }, { status: 400 });
    }

    OTP_STORE.delete(mobile);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not verify OTP. Please try again." }, { status: 500 });
  }
}
