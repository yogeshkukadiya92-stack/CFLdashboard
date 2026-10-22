import assert from "node:assert/strict";
import test from "node:test";
import { resolveSmartLeadAssignment, resolveWorkshopSalesPersonId } from "../lib/workshop-lead-assignment.ts";

test("city-specific rule takes priority over the default salesperson", () => {
  const selected = resolveWorkshopSalesPersonId(
    { city: "Ahmedabad", createdAt: "2026-09-04T08:00:00.000Z" },
    [{ id: "rule-1", city: "ahmedabad", salesPersonId: "city-sales" }],
    "default-sales"
  );
  assert.equal(selected, "city-sales");
});

test("date rules are inclusive and fall back when outside the range", () => {
  const rules = [{ id: "rule-1", startDate: "2026-09-01", endDate: "2026-09-07", salesPersonId: "week-sales" }];
  assert.equal(resolveWorkshopSalesPersonId({ createdAt: "2026-09-07T18:00:00.000Z" }, rules, "default-sales"), "week-sales");
  assert.equal(resolveWorkshopSalesPersonId({ createdAt: "2026-09-08T08:00:00.000Z" }, rules, "default-sales"), "default-sales");
});

test("the first matching rule wins", () => {
  const rules = [
    { id: "first", city: "Surat", salesPersonId: "sales-1" },
    { id: "second", city: "Surat", salesPersonId: "sales-2" }
  ];
  assert.equal(resolveWorkshopSalesPersonId({ city: "Surat" }, rules, "default-sales"), "sales-1");
});


const people = [
  { id: "surat", name: "Surat sales", isActive: true },
  { id: "default", name: "Default sales", isActive: true }
];

test("workshop imports require all city, state and pincode conditions to match", () => {
  const rules = [{ id: "local", city: "Surat", state: "Gujarat", pincode: "395007", salesPersonId: "surat" }];
  const route = (state: string) => resolveSmartLeadAssignment({ city: " SURAT ", state, pincode: "395007" }, rules, people, [], "default", "unassigned");
  assert.equal(route("gujarat").salesPersonId, "surat");
  assert.equal(route("Maharashtra").salesPersonId, "default");
});

test("disabled rules and unavailable salespeople fall back to the workshop default", () => {
  const rules = [{ id: "local", city: "Surat", salesPersonId: "surat", enabled: false }];
  assert.equal(resolveSmartLeadAssignment({ city: "Surat" }, rules, people, [], "default", "unassigned").salesPersonId, "default");
  assert.equal(resolveSmartLeadAssignment({ city: "Surat" }, [{ ...rules[0], enabled: true }], [{ ...people[0], acceptingLeads: false }, people[1]], [], "default", "unassigned").salesPersonId, "default");
});

test("no match and no workshop default does not assign an unrelated salesperson", () => {
  assert.equal(resolveSmartLeadAssignment({ city: "Mumbai" }, [{ id: "local", city: "Surat", salesPersonId: "surat" }], people, [], "", "unassigned").salesPersonId, "");
});

test("saved rule priority follows the configured order", () => {
  const rules = [{ id: "second", city: "Surat", salesPersonId: "default", priority: 1 }, { id: "first", city: "Surat", salesPersonId: "surat", priority: 0 }];
  assert.equal(resolveSmartLeadAssignment({ city: "Surat" }, rules, people, [], "default", "unassigned").ruleId, "first");
});


test("registration form answers supply state and pincode criteria", () => {
  const decision = resolveSmartLeadAssignment({ city: "Surat", answers: { State: "Gujarat", "Pin Code": "395007" } },
    [{ id: "local", state: "Gujarat", pincode: "395007", salesPersonId: "surat" }], people, [], "default", "unassigned");
  assert.equal(decision.salesPersonId, "surat");
});
