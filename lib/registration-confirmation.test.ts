import assert from "node:assert/strict";
import test from "node:test";

import type { RegistrationEntry } from "./types";

const registrationConfirmationModule = "./registration-confirmation.ts";
const { assignRegistrationNumbers } = await import(registrationConfirmationModule);

function registration(overrides: Partial<RegistrationEntry>): RegistrationEntry {
  return {
    amountDue: 0,
    amountPaid: 0,
    city: "Surat",
    createdAt: "2026-08-29T00:00:00.000Z",
    email: "participant@example.com",
    fullName: "Participant",
    id: "registration-id",
    mobile: "9876543210",
    paymentMode: "Full",
    status: "Paid",
    workshopId: "healthy-forever-38",
    workshopSlug: "healthy-forever-38",
    workshopTitle: "Healthy Forever 38",
    ...overrides
  };
}

test("registration numbers continue globally when the workshop changes", () => {
  const registrations = [
    registration({
      id: "hf-35-participant",
      registrationNumber: "REG-0035",
      workshopId: "healthy-forever-35",
      workshopSlug: "healthy-forever-35",
      workshopTitle: "Healthy Forever 35"
    }),
    registration({ id: "hf-38-participant" })
  ];

  const result = assignRegistrationNumbers(registrations, "healthy-forever-38");

  assert.equal(result[0].registrationNumber, "REG-0035");
  assert.equal(result[1].registrationNumber, "REG-0036");
});

test("waiting registrations do not consume a globally unique number", () => {
  const registrations = [
    registration({ id: "existing", registrationNumber: "REG-0099", workshopId: "another-workshop" }),
    registration({ id: "waiting", registrationStatus: "waiting" }),
    registration({ id: "confirmed", createdAt: "2026-08-29T00:01:00.000Z" })
  ];

  const result = assignRegistrationNumbers(registrations, "healthy-forever-38");

  assert.equal(result[1].registrationNumber, undefined);
  assert.equal(result[2].registrationNumber, "REG-0100");
});
