import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkshopSalesPersonId } from "../lib/workshop-lead-assignment.ts";

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
