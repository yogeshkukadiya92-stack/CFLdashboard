import assert from "node:assert/strict";
import test from "node:test";
import { attendanceCanConfirmWaitingRegistration, attendanceMatchesFinalRegistration, findRepeaterSource, isDuplicateWorkshopRegistration, registrationMatchesBatch, shouldAutoConfirmFromAttendance } from "../lib/workshop-hierarchy.ts";

const base = {
  workshopId: "workshop-growth",
  mobile: "+91 98765 43210",
  batch: "August 2026",
  batchId: "batch-aug-2026",
  introductionSessionId: "intro-1"
};

test("blocks the same mobile inside the same workshop", () => {
  assert.equal(isDuplicateWorkshopRegistration(base, { ...base, mobile: "9876543210" }), true);
  assert.equal(isDuplicateWorkshopRegistration(base, { ...base, batchId: "batch-sep-2026" }), true);
  assert.equal(isDuplicateWorkshopRegistration(base, { ...base, introductionSessionId: "intro-2" }), true);
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

test("future introduction attendance can confirm a waiting registration in the same workshop", () => {
  const form = { requireAttendanceForConfirmation: true, requiredAttendanceSessionId: "intro-1" };
  const registration = { mobile: "+91 98765 43210", workshopId: "workshop-growth" };
  assert.equal(attendanceCanConfirmWaitingRegistration(
    { mobile: "9876543210", sessionId: "intro-2", workshopId: "workshop-growth" },
    registration,
    form,
    { id: "intro-2", workshopId: "workshop-growth", published: true }
  ), true);
  assert.equal(attendanceCanConfirmWaitingRegistration(
    { mobile: "9876543210", sessionId: "intro-2", workshopId: "another-workshop" },
    registration,
    form,
    { id: "intro-2", workshopId: "another-workshop", published: true }
  ), false);
  assert.equal(attendanceCanConfirmWaitingRegistration(
    { mobile: "9876543210", sessionId: "intro-2", workshopId: "workshop-growth" },
    registration,
    form,
    { id: "intro-2", workshopId: "workshop-growth", published: false }
  ), false);
});

test("attendance-confirmed registration triggers follow-up confirmation", () => {
  assert.equal(shouldAutoConfirmFromAttendance({ attendanceMatched: true, confirmationStatus: "pending", registrationStatus: "confirmed" }), true);
  assert.equal(shouldAutoConfirmFromAttendance({ attendanceMatched: false, confirmationStatus: "pending", registrationStatus: "confirmed" }), false);
  assert.equal(shouldAutoConfirmFromAttendance({ attendanceMatched: true, confirmationStatus: "confirmed", registrationStatus: "confirmed" }), false);
  assert.equal(shouldAutoConfirmFromAttendance({ attendanceMatched: true, confirmationStatus: "pending", registrationStatus: "waiting" }), false);
});

test("finds a repeater from a paid or confirmed past workshop registration", () => {
  const source = findRepeaterSource([
    { id: "old", workshopId: "w-old", workshopSlug: "old", workshopTitle: "Old Workshop", fullName: "A", mobile: "+91 98765 43210", email: "", city: "", paymentMode: "Full", amountPaid: 100, amountDue: 0, status: "Paid", createdAt: "2026-01-01T00:00:00.000Z" }
  ], [], { mobile: "9876543210", workshopId: "w-new" }, ["w-old"]);
  assert.deepEqual(source, { registrationId: "old", workshopId: "w-old", workshopTitle: "Old Workshop" });
});

test("does not mark due-only history in another workshop as a repeater", () => {
  const source = findRepeaterSource([
    { id: "old", workshopId: "w-old", workshopSlug: "old", workshopTitle: "Old Workshop", fullName: "A", mobile: "9876543210", email: "", city: "", paymentMode: "Part", amountPaid: 0, amountDue: 100, status: "Due", createdAt: "2026-01-01T00:00:00.000Z" }
  ], [], { mobile: "9876543210", workshopId: "w-new" }, ["w-old"]);
  assert.equal(source, undefined);
});

test("finds a repeater from past workshop attendance", () => {
  const source = findRepeaterSource([], [
    { id: "attendance-old", sessionId: "session-old", sessionSlug: "old", workshopId: "w-old", workshopName: "Old Workshop", attendeeName: "A", mobile: "9876543210", submittedAt: "2026-01-02T00:00:00.000Z" }
  ], { mobile: "+91 98765 43210", workshopId: "w-new" }, ["w-old"]);
  assert.deepEqual(source, { workshopId: "w-old", workshopTitle: "Old Workshop" });
});

test("does not use an unselected past workshop for repeater detection", () => {
  const source = findRepeaterSource([
    { id: "old", workshopId: "w-old", workshopSlug: "old", workshopTitle: "Old Workshop", fullName: "A", mobile: "9876543210", email: "", city: "", paymentMode: "Full", amountPaid: 100, amountDue: 0, status: "Paid", createdAt: "2026-01-01T00:00:00.000Z" }
  ], [], { mobile: "9876543210", workshopId: "w-new" }, ["another-workshop"]);
  assert.equal(source, undefined);
});
