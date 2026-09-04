import assert from "node:assert/strict";
import test from "node:test";
import { resolveSmartLeadAssignment, resolveWorkshopSalesPersonId } from "../lib/workshop-lead-assignment.ts";

const people = [
  { id: "sales-ahmedabad", name: "Asha", isActive: true, acceptingLeads: true, activeLeadCount: 8 },
  { id: "sales-west", name: "Bhavin", isActive: true, acceptingLeads: true, activeLeadCount: 2 },
  { id: "sales-paused", name: "Chetan", isActive: true, acceptingLeads: false, activeLeadCount: 0 }
];

test("first matching priority rule assigns the configured salesperson", () => {
  const decision = resolveSmartLeadAssignment(
    { id: "reg-1", city: "Ahmedabad", state: "Gujarat", pincode: "380015", source: "Registration Link", createdAt: "2026-09-04T10:00:00Z" },
    [
      { id: "surat", priority: 2, city: "Surat", salesPersonId: "sales-west" },
      { id: "ahmedabad", priority: 1, city: "ahmedabad", pincode: "380015", salesPersonId: "sales-ahmedabad" }
    ],
    people
  );
  assert.equal(decision.salesPersonId, "sales-ahmedabad");
  assert.equal(decision.ruleId, "ahmedabad");
});

test("paused salesperson is skipped and least-active fallback is selected", () => {
  const decision = resolveSmartLeadAssignment(
    { id: "reg-2", city: "Rajkot", createdAt: "2026-09-04T10:00:00Z" },
    [{ id: "rajkot", city: "Rajkot", salesPersonId: "sales-paused" }],
    people,
    [],
    "",
    "least-active"
  );
  assert.equal(decision.salesPersonId, "sales-west");
  assert.equal(decision.strategy, "least-active");
});

test("rule workload cap skips a salesperson at capacity", () => {
  const decision = resolveSmartLeadAssignment(
    { id: "reg-3", city: "Ahmedabad", createdAt: "2026-09-04T10:00:00Z" },
    [{ id: "capped", city: "Ahmedabad", salesPersonId: "sales-ahmedabad", maxActiveLeads: 8 }],
    people,
    [],
    "sales-west"
  );
  assert.equal(decision.salesPersonId, "sales-west");
  assert.equal(decision.reason, "Used default sales person");
});

test("legacy workshop rules still resolve without a salesperson inventory", () => {
  const id = resolveWorkshopSalesPersonId(
    { city: "Ahmedabad", createdAt: "2026-09-04T10:00:00Z" },
    [{ id: "legacy", city: "Ahmedabad", salesPersonId: "sales-ahmedabad" }],
    "sales-default"
  );
  assert.equal(id, "sales-ahmedabad");
});
