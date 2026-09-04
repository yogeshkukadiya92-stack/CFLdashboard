import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { parseRazorpayPaymentEvent, verifyRazorpayWebhookSignature } from "../lib/payment-automation.ts";

test("Razorpay signature requires an exact SHA-256 HMAC", () => {
  const body = JSON.stringify({ event: "payment.captured" });
  const signature = createHmac("sha256", "secret").update(body).digest("hex");
  assert.equal(verifyRazorpayWebhookSignature(body, signature, "secret"), true);
  assert.equal(verifyRazorpayWebhookSignature(body, `${signature.slice(0, -1)}0`, "secret"), false);
  assert.equal(verifyRazorpayWebhookSignature(body, "bad", "secret"), false);
});

test("Razorpay parser normalizes paise and registration notes", () => {
  const event = parseRazorpayPaymentEvent({
    id: "evt_1",
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", amount: 125050, currency: "INR", method: "upi", status: "captured", notes: { registrationId: "reg-1" } } } }
  });
  assert.equal(event?.amount, 1250.5);
  assert.equal(event?.registrationId, "reg-1");
  assert.equal(event?.paymentId, "pay_1");
});

test("unsupported Razorpay payloads are rejected", () => {
  assert.equal(parseRazorpayPaymentEvent({ event: "payment.captured" }), null);
  assert.equal(parseRazorpayPaymentEvent(null), null);
});
