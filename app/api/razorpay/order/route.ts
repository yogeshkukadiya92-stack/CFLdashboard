import { hasInvalidBirthdateAnswer } from "@/lib/birthdate";
import { ensureRegistrationRecordsTable, getDbPool } from "@/lib/db";
import { internationalPhone } from "@/lib/phone-number";
import { completeCheckoutRegistration, saveCheckoutRegistration } from "@/lib/checkout-registration";
import { assignVerifiedCourseCheckout } from "@/lib/razorpay-course-checkout";
import { courseOrderNotes } from "@/lib/course-order-enrollment";
import { NextResponse } from "next/server";
import { getRazorpayConfig } from "@/lib/integrations";
import { verifyRazorpayCheckoutSignature } from "@/lib/payment-automation";

export async function POST(request: Request) {
  const { keyId, keySecret } = await getRazorpayConfig();

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (body?.action === "verify") {
    const orderId = String(body.razorpay_order_id || "").trim();
    const paymentId = String(body.razorpay_payment_id || "").trim();
    const signature = String(body.razorpay_signature || "").trim();
    if (!verifyRazorpayCheckoutSignature(orderId, paymentId, signature, keySecret)) {
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }
    try {
      await completeCheckoutRegistration(orderId, paymentId);
    } catch {
      return NextResponse.json({ error: "Payment received. Registration is pending recovery. Please contact support before paying again." }, { status: 503 });
    }
    try {
      const enrollment = await assignVerifiedCourseCheckout(orderId, paymentId);
      return NextResponse.json({ ok: true, courseAssigned: enrollment.assigned });
    } catch {
      // Keep paid registration intact; Razorpay webhook retries the same assignment.
      console.error("Course checkout assignment pending", { orderId, paymentId });
      return NextResponse.json({ ok: true, courseAssignmentPending: true });
    }
  }
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

  const registration = body?.registration;
  if (registration && (typeof registration !== "object" || Array.isArray(registration)
    || !registration.id || registration.id !== notes.registrationId
    || registration.workshopId !== notes.workshopId || !registration.fullName || !internationalPhone(registration.mobile)
    || JSON.stringify(registration).length > 64000)) {
    return NextResponse.json({ error: "Valid registration details are required." }, { status: 400 });
  }
  if (hasInvalidBirthdateAnswer(registration?.answers)) return NextResponse.json({ error: "Please select a valid birthdate. Minimum age is 12 years." }, { status: 400 });
  if (notes.registrationId && !registration) {
    return NextResponse.json({ error: "Refresh the registration page before paying." }, { status: 400 });
  }

  try {
    if (registration) {
      const db = getDbPool();
      if (!db) throw new Error("Checkout database is unavailable.");
      await ensureRegistrationRecordsTable();
      const existing = await db.query("SELECT external_id FROM cfl_registration_records WHERE external_id=$1", [registration.id]);
      if (existing.rowCount) {
        return NextResponse.json({ error: "This registration is already saved. Contact support before paying again." }, { status: 409 });
      }
    }
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency,
        notes: await courseOrderNotes(body, notes, amount),
        receipt
      }),
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    const data = await response.json().catch(() => ({ error: "Invalid response from Razorpay." }));
    if (response.ok && registration) {
      // Never expose an order to checkout until its full form is durable.
      await saveCheckoutRegistration(data.id, registration, amount, currency);
    }
    return NextResponse.json(response.ok ? { ...data, key: keyId } : data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Unable to create Razorpay order." }, { status: 502 });
  }
}
