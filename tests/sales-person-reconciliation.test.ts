import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSalesPeople } from "../lib/sales-person-reconciliation.ts";
import type { SalesTeamUser } from "../lib/types.ts";

const user: SalesTeamUser = {
  id: "login-1", salesPersonId: "person-1", name: "Example Salesperson",
  mobile: "9999999999", email: "example@example.com", passwordHash: "private",
  active: true, canViewOther: false, createdAt: "", updatedAt: "", loginCount: 3
};

test("recovers a missing profile under its original ID without leaking login secrets", () => {
  const result = reconcileSalesPeople([], [user, user]) as Record<string, unknown>[];
  assert.equal(result.length, 1);
  assert.equal(result[0].id, user.salesPersonId);
  assert.equal(result[0].name, user.name);
  assert.equal(result[0].acceptingLeads, false);
  assert.equal("passwordHash" in result[0], false);
  assert.equal("permissions" in result[0], false);
});

test("preserves existing profile settings and commissions", () => {
  const person = { id: user.salesPersonId, name: "Updated name", commissions: [{ leadPercent: "15" }], isActive: false };
  assert.deepEqual(reconcileSalesPeople([person], [user]), [person]);
});

test("keeps recovered disabled accounts disabled and skips unlinked logins", () => {
  const result = reconcileSalesPeople([], [{ ...user, active: false }, { ...user, salesPersonId: "" }]) as Record<string, unknown>[];
  assert.equal(result.length, 1);
  assert.equal(result[0].isActive, false);
  assert.deepEqual(reconcileSalesPeople([], []), []);
});
