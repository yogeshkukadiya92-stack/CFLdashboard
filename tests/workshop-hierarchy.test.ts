import assert from "node:assert/strict";
import test from "node:test";
import { isDuplicateWorkshopRegistration, registrationMatchesBatch } from "../lib/workshop-hierarchy.ts";

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
