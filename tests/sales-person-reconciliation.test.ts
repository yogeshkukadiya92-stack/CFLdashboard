import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSalesPeople } from "../lib/sales-person-reconciliation.ts";
import { resolveSmartLeadAssignment } from "../lib/workshop-lead-assignment.ts";
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
  assert.equal(result[0].acceptingLeads, true);
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


test("an active recovered salesperson receives leads from their workshop default", () => {
  const people = reconcileSalesPeople([], [user]);
  const decision = resolveSmartLeadAssignment({ city: "Surat" }, [], people as Array<{ id: string; name: string; isActive: boolean; acceptingLeads: boolean }>, [], user.salesPersonId, "unassigned");
  assert.equal(decision.salesPersonId, user.salesPersonId);
});

test("recovery never resumes a saved explicit pause", () => {
  const person = { id: user.salesPersonId, name: user.name, isActive: true, acceptingLeads: false, assignmentPausedAt: "2026-10-22T10:00:00Z" };
  const people = reconcileSalesPeople([person], [user]);
  assert.deepEqual(people, [person]);
  assert.equal(resolveSmartLeadAssignment({}, [], people as Array<{ id: string; name: string; isActive: boolean; acceptingLeads: boolean }>, [], user.salesPersonId, "unassigned").salesPersonId, "");
});
