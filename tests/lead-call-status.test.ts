import assert from "node:assert/strict";
import test from "node:test";
import { latestLeadCallStatus, normalizeCallStatus } from "../lib/lead-call-status.ts";

test("CallFlow codes and display labels match the same filter", () => {
  assert.equal(normalizeCallStatus("NO_ANSWER"), normalizeCallStatus("No answer"));
  assert.equal(normalizeCallStatus("FOLLOW_UP"), normalizeCallStatus("Follow-up"));
});

test("latest disposition wins regardless of activity order or later call logs", () => {
  assert.equal(latestLeadCallStatus({ activities: [
    { id: "old", type: "call", message: "Call result: BUSY", createdAt: "2026-10-25T10:00:00Z" },
    { id: "log", type: "call", message: "Outgoing call · Connected", createdAt: "2026-10-26T11:00:00Z" },
    { id: "new", type: "call", message: "Call result: INTERESTED — Send information", createdAt: "2026-10-26T10:00:00Z" },
  ], callHistory: [] }), "interested");
});

test("legacy history and leads without dispositions are handled", () => {
  assert.equal(latestLeadCallStatus({ callHistory: ["Call result: BUSY", "Call result: NO ANSWER", "Outgoing call"] }), "no answer");
  assert.equal(latestLeadCallStatus({ callHistory: [] }), "");
});
