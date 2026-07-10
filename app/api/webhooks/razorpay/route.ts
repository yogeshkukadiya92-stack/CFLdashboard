import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getRazorpayConfig } from "@/lib/integrations";

export async function POST(request: Request) {
  const { webhookSecret: secret } = await getRazorpayConfig();
  const signature = request.headers.get("x-razorpay-signature") || "";
  const rawBody = await request.text();

  if (!secret) {
    return NextResponse.json({ error: "RAZORPAY_WEBHOOK_SECRET is not configured." }, { status: 400 });
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const valid =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!valid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: { event?: string };
  try {
    event = JSON.parse(rawBody) as { event?: string };
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  return NextResponse.json({ event: event?.event || "received", ok: true });
}
