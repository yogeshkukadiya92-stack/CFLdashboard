import assert from "node:assert/strict";
import test from "node:test";
import { recoverCheckoutRegistration } from "../lib/checkout-registration-recovery.ts";

const draft = { payload: { id: "reg-1", fullName: "Member", answers: { Custom: "Answer" }, amountDue: 3000 }, amount: 699900, currency: "INR" };
const payment = { id: "pay_1", order_id: "order_1", status: "captured", amount: 699900, currency: "INR" };

test("webhook recovers the saved form without browser state and preserves part-payment details", async () => {
  let written: Record<string, unknown> | undefined;
  await recoverCheckoutRegistration(draft, "order_1", "pay_1", {
    readPayment: async () => payment,
    saveRegistration: async (entry) => {
      written = entry;
      return { ok: true, registration: { answers: entry.answers as Record<string, string> } };
    }
  });
  assert.equal(written?.amountPaid, 6999);
  assert.equal(written?.amountDue, 3000);
  assert.deepEqual(written?.answers, { Custom: "Answer", "Razorpay Order ID": "order_1", "Razorpay Payment ID": "pay_1" });
});

test("wrong order, amount, currency, uncaptured or refunded payments cannot create registrations", async () => {
  for (const change of [{ order_id: "other" }, { amount: 1 }, { currency: "USD" }, { status: "authorized" }, { amount_refunded: 1 }]) {
    await assert.rejects(recoverCheckoutRegistration(draft, "order_1", "pay_1", {
      readPayment: async () => ({ ...payment, ...change }),
      saveRegistration: async () => { assert.fail("Must not save an invalid payment"); }
    }));
  }
});

test("a failed registration save remains retryable with the same identity", async () => {
  let attempts = 0;
  const dependencies = {
    readPayment: async () => payment,
    saveRegistration: async (entry: Record<string, unknown>) => {
      attempts++;
      assert.equal(entry.id, "reg-1");
      return attempts === 1 ? { ok: false, error: "Database unavailable" } : { ok: true, registration: { answers: entry.answers as Record<string, string> } };
    }
  };
  await assert.rejects(recoverCheckoutRegistration(draft, "order_1", "pay_1", dependencies), /Database unavailable/);
  await recoverCheckoutRegistration(draft, "order_1", "pay_1", dependencies);
  assert.equal(attempts, 2);
});

test("an existing registration for a different order is flagged for recovery", async () => {
  await assert.rejects(recoverCheckoutRegistration(draft, "order_1", "pay_1", {
    readPayment: async () => payment,
    saveRegistration: async () => ({ ok: true, registration: { answers: { "Razorpay Order ID": "order_other" } } })
  }), /another checkout/);
});
