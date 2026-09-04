import assert from "node:assert/strict";
import test from "node:test";
import { applyCrmSlaAutomation, getCrmAutomationOverview } from "../lib/crm-automation.ts";
import type { Lead } from "../lib/types.ts";

function lead(overrides: Partial<Lead> = {}): Lead {
  return { id: "lead-1", name: "Asha", mobile: "9876543210", email: "", city: "Ahmedabad", state: "Gujarat", country: "India", source: "Registration", stage: "New Leads", assignedTo: "Sales One", score: 50, revenuePotential: 0, notes: [], callHistory: [], whatsappHistory: [], workshopsAttended: [], paymentHistory: [], certificates: [], familyAccounts: [], tags: [], createdAt: "2026-09-04T04:00:00.000Z", nextFollowUp: "", bestTime: "", ...overrides };
}

test("SLA automation creates one deterministic follow-up and stays idempotent", () => {
  const now = new Date("2026-09-04T06:00:00.000Z");
  const first = applyCrmSlaAutomation([lead()], now);
  assert.equal(first.created.length, 1);
  assert.match(first.leads[0].followUps?.[0].id || "", /^auto-sla-lead-1-/);
  const second = applyCrmSlaAutomation(first.leads, now);
  assert.equal(second.created.length, 0);
  assert.equal(second.leads[0].followUps?.length, 1);
});

test("CRM overview separates overdue, today and unassigned workload", () => {
  const now = new Date("2026-09-04T06:00:00.000Z");
  const overview = getCrmAutomationOverview([
    lead({ assignedTo: "", followUps: [{ id: "overdue", type: "Call", dueAt: "2026-09-04T05:00:00.000Z", note: "Call", completed: false, createdAt: "2026-09-03T00:00:00.000Z" }] }),
    lead({ id: "lead-2", followUps: [{ id: "today", type: "WhatsApp", dueAt: "2026-09-04T10:00:00.000Z", note: "Message", completed: false, createdAt: "2026-09-03T00:00:00.000Z" }] })
  ], now);
  assert.equal(overview.counts.pending, 2);
  assert.equal(overview.counts.overdue, 1);
  assert.equal(overview.counts.today, 1);
  assert.equal(overview.counts.unassigned, 1);
});

test("terminal leads never receive automated SLA tasks", () => {
  const result = applyCrmSlaAutomation([lead({ stage: "Won" })], new Date("2026-09-04T06:00:00.000Z"));
  assert.equal(result.created.length, 0);
});
