import assert from "node:assert/strict";
import test from "node:test";
import { attendanceMatchesFinalRegistration, isDuplicateWorkshopRegistration, registrationMatchesBatch, shouldAutoConfirmFromAttendance } from "../lib/workshop-hierarchy.ts";

const base = {
  workshopId: "workshop-growth",
  mobile: "+91 98765 43210",
  batch: "August 2026",
  batchId: "batch-aug-2026",
  introductionSessionId: "intro-1"
};

test("blocks the same mobile only inside the same workshop, batch and introduction session", () => {
  assert.equal(isDuplicateWorkshopRegistration(base, { ...base, mobile: "9876543210" }), true);
  assert.equal(isDuplicateWorkshopRegistration(base, { ...base, batchId: "batch-sep-2026" }), false);
  assert.equal(isDuplicateWorkshopRegistration(base, { ...base, introductionSessionId: "intro-2" }), false);
  assert.equal(isDuplicateWorkshopRegistration(base, { ...base, workshopId: "another-workshop" }), false);
});

test("keeps legacy batch-name registrations visible in their matching batch", () => {
  assert.equal(registrationMatchesBatch({ batch: "August 2026" }, { id: "batch-aug", name: "August 2026" }), true);
  assert.equal(registrationMatchesBatch({ batch: "August 2026" }, { id: "batch-sep", name: "September 2026" }), false);
  assert.equal(registrationMatchesBatch({ batch: "Old", batchId: "batch-aug" }, { id: "batch-aug", name: "August 2026" }), true);
});

test("final registration eligibility matches the exact attendance session and mobile", () => {
  const registration = { mobile: "+91 98765 43210" };
  assert.equal(attendanceMatchesFinalRegistration({ mobile: "9876543210", sessionId: "intro-1" }, registration, "intro-1"), true);
  assert.equal(attendanceMatchesFinalRegistration({ mobile: "9999999999", sessionId: "intro-1" }, registration, "intro-1"), false);
  assert.equal(attendanceMatchesFinalRegistration({ mobile: "9876543210", sessionId: "intro-2" }, registration, "intro-1"), false);
});

test("attendance-confirmed registration triggers follow-up confirmation", () => {
  assert.equal(shouldAutoConfirmFromAttendance({ attendanceMatched: true, confirmationStatus: "pending", registrationStatus: "confirmed" }), true);
  assert.equal(shouldAutoConfirmFromAttendance({ attendanceMatched: false, confirmationStatus: "pending", registrationStatus: "confirmed" }), false);
  assert.equal(shouldAutoConfirmFromAttendance({ attendanceMatched: true, confirmationStatus: "confirmed", registrationStatus: "confirmed" }), false);
  assert.equal(shouldAutoConfirmFromAttendance({ attendanceMatched: true, confirmationStatus: "pending", registrationStatus: "waiting" }), false);
});
