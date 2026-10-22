import assert from "node:assert/strict";
import test from "node:test";
import { assignRegistrationLeads } from "../lib/registration-sales-assignment.ts";
import { normalizeLead } from "../lib/lead-utils.ts";
import type { RegistrationEntry } from "../lib/types.ts";

const person = { id: "sales-1", name: "Sales One", salesPersonCode: "SP-CUSTOM" };
const registration = (mobile: string, id = "r1") => ({ id, mobile, fullName: "Participant", workshopId: "workshop-1", workshopTitle: "Course" } as RegistrationEntry);

test("creates one CRM lead for duplicate responses and uses the selected salesperson", () => {
  const result = assignRegistrationLeads([], [registration("+91 9876543210"), registration("9876543210", "r2")], person);
  assert.equal(result.assigned, 1);
  assert.equal(result.created, 1);
  assert.equal(result.leads[0].assignedSalesPersonId, person.id);
  assert.equal(result.leads[0].assignedSalesPersonCode, "SP-CUSTOM");
  assert.equal(result.leads[0].interest, "Course");
});

test("transfers an existing lead without losing history or changing unrelated leads", () => {
  const original = normalizeLead({ id: "existing", mobile: "9876543210", assignedTo: "Old owner", stage: "Won", notes: ["Keep this"], convertedClientId: "42" });
  const unrelated = normalizeLead({ id: "other", mobile: "9123456780" });
  const result = assignRegistrationLeads([original, unrelated], [registration("9876543210")], person);
  assert.equal(result.created, 0);
  assert.equal(result.leads[0].assignedTo, "Sales One");
  assert.equal(result.leads[0].stage, "Won");
  assert.deepEqual(result.leads[0].notes, ["Keep this"]);
  assert.equal(result.leads[0].convertedClientId, "42");
  assert.equal(result.leads[0].activities?.[0].type, "assignment");
  assert.equal(result.leads[1], unrelated);
  assert.equal(original.assignedTo, "Old owner");
});

test("rejects invalid phones, inactive owners and ambiguous duplicate CRM records", () => {
  assert.throws(() => assignRegistrationLeads([], [registration("123")], person), /mobile/);
  assert.throws(() => assignRegistrationLeads([], [registration("9876543210")], { ...person, isActive: false }), /active/);
  const leads = [normalizeLead({ id: "a", mobile: "9876543210" }), normalizeLead({ id: "b", mobile: "9876543210" })];
  assert.throws(() => assignRegistrationLeads(leads, [registration("9876543210")], person), /duplicate/);
});

test("adding a lead preserves the entire existing collection", () => {
  const current = Array.from({ length: 10000 }, (_, index) => normalizeLead({ id: String(index), mobile: String(8000000000 + index) }));
  const result = assignRegistrationLeads(current, [registration("9876543210")], person);
  assert.equal(result.leads.length, 10001);
});
