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
  const currency = String(body?.currency || "INR").trim().toUpperCase();
  const receipt = String(body?.receipt || `receipt_${Date.now()}`).trim().slice(0, 40);
  const notes = body?.notes && typeof body.notes === "object" && !Array.isArray(body.notes)
    ? Object.fromEntries(
        Object.entries(body.notes as Record<string, unknown>)
          .slice(0, 20)
          .map(([key, value]) => [key.slice(0, 40), String(value ?? "").slice(0, 250)])
      )
    : {};

  if (!Number.isFinite(amount) || amount < 1 || amount > 10_000_000) {
    return NextResponse.json({ error: "Valid amount is required." }, { status: 400 });
  }
  if (!/^[A-Z]{3}$/.test(currency) || !receipt) {
    return NextResponse.json({ error: "Valid currency and receipt are required." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency,
        notes,
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
