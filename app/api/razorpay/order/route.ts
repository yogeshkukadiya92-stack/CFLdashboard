import { NextResponse } from "next/server";
import { getRazorpayConfig } from "@/lib/integrations";

export async function POST(request: Request) {
  const { keyId, keySecret } = await getRazorpayConfig();

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const amount = Number(body?.amount);
  const currency = String(body?.currency || "INR");
  const receipt = String(body?.receipt || `receipt_${Date.now()}`);

  if (!Number.isFinite(amount) || amount < 1) {
    return NextResponse.json({ error: "Valid amount is required." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency,
        notes: body?.notes || {},
        receipt
      }),
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    const data = await response.json().catch(() => ({ error: "Invalid response from Razorpay." }));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Unable to create Razorpay order." }, { status: 502 });
  }
}
