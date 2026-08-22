import assert from "node:assert/strict";
import test from "node:test";
import { detectLeadRisk, rankNextBestActions, taskBucket } from "../lib/crm-workflow.ts";
import { normalizeLead, upsertLeadFromRegistration } from "../lib/lead-utils.ts";

const now = new Date("2026-08-18T10:00:00.000Z");

test("new uncontacted lead beyond SLA is first-response overdue", () => {
  const lead = normalizeLead({ id: "new", name: "New Lead", mobile: "9876543210", createdAt: "2026-08-18T09:00:00.000Z", lastActivityAt: "2026-08-18T09:00:00.000Z", stage: "New Leads" });
  assert.equal(detectLeadRisk(lead, now), "FIRST_RESPONSE_OVERDUE");
});

test("proposal inactivity is revenue at risk", () => {
  const lead = normalizeLead({ id: "offer", name: "Offer Lead", mobile: "9876543211", createdAt: "2026-08-16T08:00:00.000Z", lastActivityAt: "2026-08-16T08:00:00.000Z", stage: "Proposal" });
  assert.equal(detectLeadRisk(lead, now), "REVENUE_AT_RISK");
});

test("overdue follow-up outranks an otherwise similar active lead", () => {
  const overdue = normalizeLead({ id: "overdue", name: "Overdue", mobile: "9876543212", score: 50, stage: "Contacted", followUps: [{ id: "f1", type: "Call", dueAt: "2026-08-18T08:00:00.000Z", note: "", completed: false, createdAt: "2026-08-17T08:00:00.000Z" }] });
  const future = normalizeLead({ id: "future", name: "Future", mobile: "9876543213", score: 50, stage: "Contacted", followUps: [{ id: "f2", type: "Call", dueAt: "2026-08-19T08:00:00.000Z", note: "", completed: false, createdAt: "2026-08-17T08:00:00.000Z" }] });
  assert.equal(rankNextBestActions([future, overdue], now)[0].lead.id, "overdue");
});

test("task buckets are deterministic", () => {
  assert.equal(taskBucket({ id: "1", type: "Call", dueAt: "2026-08-18T09:00:00.000Z", note: "", completed: false, createdAt: "2026-08-17T00:00:00.000Z" }, now), "overdue");
  assert.equal(taskBucket({ id: "2", type: "Call", dueAt: "2026-08-18T11:00:00.000Z", note: "", completed: false, createdAt: "2026-08-17T00:00:00.000Z" }, now), "today");
  assert.equal(taskBucket({ id: "3", type: "Call", dueAt: "2026-08-19T11:00:00.000Z", note: "", completed: false, createdAt: "2026-08-17T00:00:00.000Z" }, now), "upcoming");
});

test("registration qualification is persisted on the CRM lead", () => {
  const leads = upsertLeadFromRegistration([], {
    fullName: "Qualified Lead",
    mobile: "9876543214",
    workshopTitle: "Intro Workshop",
    answers: {
      Turnover: "Rs 1 - 5 Cr",
      "Team Size": "20+ people",
      "Business without you": "It runs, but I need to make daily calls",
      "Business Age": "5 - 10 years"
    }
  });
  assert.deepEqual(leads[0].preQualification, {
    turnoverOption: "1_TO_5_CR",
    teamSizeOption: "20_PLUS",
    timeFreedomOption: "DAILY_CALLS",
    vintageOption: "5_TO_10"
  });
});

test("registration leads remain unassigned for manual Phase 1 routing", () => {
  const leads = upsertLeadFromRegistration([], {
    fullName: "Manual Queue Lead",
    mobile: "9876543215",
    workshopTitle: "Intro Workshop"
  }, [{ id: "sales-1", isActive: true, name: "Sales One" }]);
  assert.equal(leads[0].assignedTo, "");
  assert.equal(leads[0].assignedSalesPersonId, undefined);
  assert.equal((leads[0].activities ?? []).some((activity) => activity.message.includes("Automatically assigned")), false);
});

test("lead block metadata survives normalization", () => {
  const lead = normalizeLead({
    id: "blocked",
    name: "Blocked Lead",
    mobile: "9876543216",
    blocked: true,
    blockedAt: "2026-08-18T10:00:00.000Z",
    blockedBy: "Admin",
    blockReason: "Duplicate enquiry"
  });
  assert.equal(lead.blocked, true);
  assert.equal(lead.blockReason, "Duplicate enquiry");
  assert.equal(lead.blockedBy, "Admin");
});
