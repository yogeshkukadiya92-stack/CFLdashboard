import test from "node:test";
import assert from "node:assert/strict";
import { applyCallFlowEvent } from "../lib/callflow-connector.ts";
import type { Lead } from "../lib/types.ts";

function lead(): Lead {
  const now = "2026-08-22T08:00:00.000Z";
  return {
    id: "lead-1", name: "Assigned Lead", mobile: "9999999999", email: "", city: "Ahmedabad", state: "Gujarat", country: "India",
    source: "Dashboard", stage: "Contacted", priority: "Warm", assignedTo: "Sales One",
    interest: "Coaching", revenuePotential: 0, score: 50, sourceDetails: [], notes: [], callHistory: [], whatsappHistory: [], workshopsAttended: [], paymentHistory: [], certificates: [], familyAccounts: [], tags: [], bestTime: "",
    activities: [], followUps: [{ id: "follow-1", dueAt: now, type: "Call", note: "Discuss plan", completed: false, createdAt: now }],
    nextFollowUp: now, createdAt: now, updatedAt: now,
  };
}

test("CallFlow completion closes the matching dashboard follow-up", () => {
  const result = applyCallFlowEvent(lead(), {
    eventUuid: "event-1", entityType: "FOLLOW_UP", entityId: "follow-1", operation: "COMPLETE",
    payload: { leadId: "lead-1", completedAt: Date.parse("2026-08-22T09:00:00.000Z") },
  }, "Sales One");
  assert.equal(result.followUps?.[0]?.completed, true);
  assert.equal(result.nextFollowUp, "");
  assert.match(result.activities?.[0]?.message || "", /completed/i);
});

test("CallFlow dispositions are recorded in dashboard activity and notes", () => {
  const result = applyCallFlowEvent(lead(), {
    eventUuid: "event-2", entityType: "CALL_DISPOSITION", entityId: "disposition-1", operation: "CREATE",
    payload: { leadId: "lead-1", dispositionCode: "INTERESTED", note: "Send brochure", createdAt: Date.parse("2026-08-22T09:00:00.000Z") },
  }, "Sales One");
  assert.match(result.callHistory.at(-1) || "", /interested/i);
  assert.ok(result.notes.includes("Send brochure"));
});

test("wrong number disposition enables Do Not Call protection", () => {
  const result = applyCallFlowEvent(lead(), {
    eventUuid: "event-wrong-number", entityType: "CALL_DISPOSITION", entityId: "disposition-wrong", operation: "CREATE",
    payload: { leadId: "lead-1", dispositionCode: "WRONG_NUMBER", createdAt: Date.parse("2026-08-22T09:00:00.000Z") },
  }, "Sales One");
  assert.equal(result.doNotCall, true);
  assert.equal(result.stage, "Lost");
  assert.ok(result.tags?.includes("Do Not Call"));
});
