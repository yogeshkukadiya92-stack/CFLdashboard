import assert from "node:assert/strict";
import test from "node:test";
import { promoteConfirmedRegistration, isWaitingRegistration } from "../lib/registration-status.ts";
import { assignRegistrationNumbers } from "../lib/registration-confirmation.ts";
import type { RegistrationEntry } from "../lib/types.ts";

test("promoting a waiting participant clears waiting data and permits a registration number", () => {
  const waiting = { id: "a", workshopId: "w", createdAt: "2026-11-16", registrationStatus: "waiting", waitingPosition: 2, waitingReason: "capacity" } as RegistrationEntry;
  const promoted = promoteConfirmedRegistration(waiting);
  assert.equal(isWaitingRegistration(waiting), true);
  assert.equal(isWaitingRegistration(promoted), false);
  assert.equal(promoted.waitingPosition, undefined);
  assert.equal(promoted.waitingReason, undefined);
  assert.equal(assignRegistrationNumbers([promoted], "w")[0].registrationNumber, "REG-0001");
  assert.equal(waiting.registrationStatus, "waiting");
});

test("legacy confirmed follow-ups do not get waiting notifications", () => {
  assert.equal(isWaitingRegistration({ registrationStatus: "waiting", confirmationStatus: "confirmed" } as RegistrationEntry), false);
  assert.equal(isWaitingRegistration({ registrationStatus: "waiting", confirmationStatus: "pending" } as RegistrationEntry), true);
});
