import assert from "node:assert/strict";
import test from "node:test";
import { ensureRegistrationCrmAssignment } from "../lib/registration-crm-assignment.ts";
import { normalizeLead } from "../lib/lead-utils.ts";
import { assignRegistrationLeads } from "../lib/registration-sales-assignment.ts";
import type { RegistrationEntry } from "../lib/types.ts";

const registration = (mobile = "+91 9876543210") => ({ id: "r1", mobile, fullName: "Participant",
  workshopId: "w1", workshopTitle: "Workshop", createdAt: "2026-11-24T08:00:00Z" } as RegistrationEntry);
const people = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const settings = { assignedSalesPersonIds: ["a", "b"] };

test("foreign phones create assigned leads without truncation, including manual assignment", () => {
  const result = ensureRegistrationCrmAssignment([], registration("+358 40 123 4567"), people, settings);
  assert.equal(result.receipt.crmAssignmentStatus, "assigned");
  assert.equal(result.leads[0].mobile, "+358401234567");
  assert.equal(assignRegistrationLeads([], [registration("+358401234567")], people[0]).assigned, 1);
});

test("retry preserves owner, notes and activities and creates no duplicate lead", () => {
  const first = ensureRegistrationCrmAssignment([], registration(), people, settings);
  const retry = ensureRegistrationCrmAssignment(first.leads, { ...registration(), ...first.receipt }, people, settings);
  assert.equal(retry.leads, first.leads);
  assert.equal(retry.leads.length, 1);
  assert.equal(retry.receipt.crmSalesPersonId, first.receipt.crmSalesPersonId);
});

test("existing owners remain unchanged even outside the workshop team", () => {
  const existing = normalizeLead({ id: "old", mobile: "9876543210", assignedTo: "Previous owner", assignedSalesPersonId: "old-person", notes: ["Keep"], stage: "Won" });
  const result = ensureRegistrationCrmAssignment([existing], registration(), people, settings);
  assert.equal(result.receipt.crmSalesPersonId, "old-person");
  assert.equal(result.leads[0].stage, "Won");
  assert.deepEqual(result.leads[0].notes, ["Keep"]);
});

test("no available owner stays pending and later recovers without duplicates", () => {
  const unavailable = people.map(person => ({ ...person, acceptingLeads: false }));
  const first = ensureRegistrationCrmAssignment([], registration(), unavailable, settings);
  assert.equal(first.receipt.crmAssignmentStatus, "pending");
  assert.equal(first.leads.length, 1);
  const second = ensureRegistrationCrmAssignment(first.leads, { ...registration(), ...first.receipt }, unavailable, settings);
  assert.equal(second.leads, first.leads);
  const recovered = ensureRegistrationCrmAssignment(second.leads, { ...registration(), ...second.receipt }, people, settings);
  assert.equal(recovered.leads.length, 1);
  assert.equal(recovered.receipt.crmAssignmentStatus, "assigned");
});

test("inactive or capacity-limited selected team falls back to an eligible owner", () => {
  const result = ensureRegistrationCrmAssignment([], registration(), [
    { id: "a", name: "A", isActive: false },
    { id: "b", name: "B", maxActiveLeads: 1, activeLeadCount: 1 },
    { id: "c", name: "C" }
  ], settings);
  assert.equal(result.receipt.crmSalesPersonId, "c");
});

test("invalid phone and ambiguous duplicates produce actionable failures", () => {
  const invalid = ensureRegistrationCrmAssignment([], registration("123"), people, settings);
  assert.equal(invalid.receipt.crmAssignmentStatus, "failed");
  assert.match(invalid.receipt.crmAssignmentReason!, /Invalid mobile/);
  assert.equal(invalid.leads.length, 0);
  const duplicates = ["one", "two"].map(id => normalizeLead({ id, mobile: "9876543210" }));
  const result = ensureRegistrationCrmAssignment(duplicates, registration(), people, settings);
  assert.equal(result.receipt.crmAssignmentStatus, "failed");
  assert.equal(result.leads, duplicates);
});

test("selected workshop team is balanced as successive registrations arrive", () => {
  let leads = [] as ReturnType<typeof normalizeLead>[];
  for (let index = 0; index < 8; index++) {
    leads = ensureRegistrationCrmAssignment(leads, { ...registration(), id: `r${index}`, mobile: String(9876543210 + index) }, people, settings).leads;
  }
  assert.equal(leads.filter(lead => lead.assignedSalesPersonId === "a").length, 4);
  assert.equal(leads.filter(lead => lead.assignedSalesPersonId === "b").length, 4);
});

test("nameless salesperson is skipped so a valid fallback receives the lead", () => {
  const result = ensureRegistrationCrmAssignment([], registration(), [
    { id: "a", name: "" }, { id: "c", name: "Fallback" }
  ], { assignedSalesPersonIds: ["a"] });
  assert.equal(result.receipt.crmAssignmentStatus, "assigned");
  assert.equal(result.receipt.crmSalesPersonId, "c");
});

test("creating a registration lead never evicts existing CRM history at 10000 records", () => {
  const old = normalizeLead({ id: "old", mobile: "9999999999", assignedTo: "Owner" });
  const leads = Array.from({ length: 10000 }, (_, index) => ({ ...old, id: `old-${index}` }));
  const result = ensureRegistrationCrmAssignment(leads, registration(), people, settings);
  assert.equal(result.leads.length, 10001);
  assert.ok(result.leads.some(lead => lead.id === "old-9999"));
  assert.equal(result.receipt.crmAssignmentStatus, "assigned");
});
