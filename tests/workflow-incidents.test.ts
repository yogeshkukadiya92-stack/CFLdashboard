import test from "node:test";
import assert from "node:assert/strict";
import { deriveIncidentSeverity } from "../lib/workflow-db.ts";

test("payment and credential failures become critical incidents", () => {
  assert.equal(deriveIncidentSeverity("Capture Razorpay payment", "Signature mismatch"), "critical");
  assert.equal(deriveIncidentSeverity("HTTP request", "Unauthorized credential"), "critical");
});

test("delivery and infrastructure failures receive actionable severity", () => {
  assert.equal(deriveIncidentSeverity("Send WhatsApp template", "Provider timeout"), "high");
  assert.equal(deriveIncidentSeverity("Validate registration", "Missing city"), "medium");
  assert.equal(deriveIncidentSeverity("Add tag", "Unknown error"), "low");
});
