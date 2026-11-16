import assert from "node:assert/strict";
import test from "node:test";
import { registrationPaymentLabel } from "../lib/registration-payment-display.ts";

test("free workshop registrations display Free instead of legacy Paid with zero amounts", () => {
  const entry = { status: "Paid", amountPaid: 0, amountDue: 0 };
  assert.equal(registrationPaymentLabel(entry, { isPaid: false }), "Free");
  assert.equal(entry.status, "Paid");
});

test("paid, due, historical unknown and actual payments keep their status", () => {
  assert.equal(registrationPaymentLabel({ status: "Paid", amountPaid: 0, amountDue: 0 }, { isPaid: true }), "Paid");
  assert.equal(registrationPaymentLabel({ status: "Paid", amountPaid: 100, amountDue: 0 }, { isPaid: false }), "Paid");
  assert.equal(registrationPaymentLabel({ status: "Due", amountPaid: 0, amountDue: 100 }, { isPaid: false }), "Due");
  assert.equal(registrationPaymentLabel({ status: "Paid", amountPaid: 0, amountDue: 0 }, { isPaid: false, paymentUnknown: true }), "Paid");
  assert.equal(registrationPaymentLabel({ status: "Paid", amountPaid: 0, amountDue: 0 }), "Paid");
});
