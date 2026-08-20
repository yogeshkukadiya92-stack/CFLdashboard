import assert from "node:assert/strict";
import test from "node:test";
import { findSalesPersonByCode, salesPersonCodeFromId } from "../lib/sales-person-code.ts";

test("creates a stable visible salesperson code from the internal id", () => {
  assert.equal(salesPersonCodeFromId("sales-person-abcd-1234"), "SP-ABCD1234");
  assert.equal(salesPersonCodeFromId("sales-person-abcd-1234"), salesPersonCodeFromId("sales-person-abcd-1234"));
});

test("matches salesperson codes case-insensitively and supports legacy records", () => {
  const people = [{ id: "person-legacy-9876", name: "Legacy" }, { id: "person-new", name: "New", salesPersonCode: "SP-CFL00001" }];
  assert.equal(findSalesPersonByCode(people, "sp-cfl00001")?.name, "New");
  assert.equal(findSalesPersonByCode(people, salesPersonCodeFromId("person-legacy-9876"))?.name, "Legacy");
});
