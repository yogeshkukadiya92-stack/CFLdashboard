import assert from "node:assert/strict";
import test from "node:test";
import { introductionInvitations } from "../lib/introduction-invitations.ts";
import type { Lead, RegistrationEntry } from "../lib/types.ts";

test("links each session confirmation only to assigned matching leads", () => {
  const leads = [{ id: "lead", mobile: "+91 9876543210" }, { id: "other", mobile: "1234567890" }] as Lead[];
  const registrations = [
    { id: "one", mobile: "9876543210", workshopId: "workshop", workshopTitle: "Workshop", introductionSessionId: "intro", confirmationStatus: "confirmed" },
    { id: "two", mobile: "9876543210", workshopId: "workshop", introductionSessionId: "next" },
    { id: "not-invited", mobile: "9876543210", workshopId: "workshop" },
    { id: "invalid", mobile: "", workshopId: "workshop", introductionSessionId: "intro" },
  ] as RegistrationEntry[];
  const rows = introductionInvitations({ registrations, workshops: [{ id: "workshop", batches: [{ introductionSessions: [{ id: "intro", title: "Introduction", sessionDate: "2026-10-10" }] }] }] }, leads);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].leadId, "lead");
  assert.equal(rows[0].sessionTitle, "Introduction");
  assert.equal(rows[0].sessionDate, "2026-10-10");
  assert.equal(rows[0].status, "confirmed");
  assert.equal(rows[1].status, "pending");
  assert.notEqual(rows[0].sessionId, rows[1].sessionId);
});

test("identical session ids in different workshops remain separate", () => {
  const registrations = ["first", "second"].map(workshopId => ({ id: workshopId, workshopId, workshopTitle: workshopId, mobile: "9876543210", introductionSessionId: "intro" })) as RegistrationEntry[];
  const rows = introductionInvitations({ registrations, workshops: [] }, [{ id: "lead", mobile: "9876543210" }] as Lead[]);
  assert.equal(new Set(rows.map(row => row.sessionId)).size, 2);
});
