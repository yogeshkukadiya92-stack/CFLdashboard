import assert from "node:assert/strict";
import test from "node:test";
import { newestFirstByCreatedAt } from "../lib/lead-sort.ts";

test("leads sort by newest creation date and time across months and time zones", () => {
  const leads = [
    { id: "october", createdAt: "2026-10-23T09:59:00+05:30" },
    { id: "november17", createdAt: "2026-11-17T09:07:00+05:30" },
    { id: "latest", createdAt: "2026-11-18T16:19:00+05:30" },
    { id: "earlier", createdAt: "2026-11-18T10:00:00Z" }
  ];
  assert.deepEqual(newestFirstByCreatedAt(leads).map(lead => lead.id), ["latest", "earlier", "november17", "october"]);
  assert.equal(leads[0].id, "october");
});

test("missing dates go last and equal timestamps retain their original order", () => {
  const leads = [
    { id: "missing" }, { id: "invalid", createdAt: "invalid" },
    { id: "first", createdAt: "2026-11-18T12:00:00Z" },
    { id: "second", createdAt: "2026-11-18T17:30:00+05:30" }
  ];
  assert.deepEqual(newestFirstByCreatedAt(leads).map(lead => lead.id), ["first", "second", "missing", "invalid"]);
});

test("newest records reach the first page even when appended after older leads", () => {
  const leads = Array.from({ length: 101 }, (_, index) => ({ createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(), id: index }));
  assert.equal(newestFirstByCreatedAt(leads).slice(0, 100)[0].id, 100);
});


test("activity timeline sorts mixed call and registration events by precise time", () => {
  const activities = [
    { id: "call", createdAt: "2026-11-18T12:06:00+05:30" },
    { id: "registration", createdAt: "2026-11-18T10:37:00+05:30" },
    { id: "no-answer", createdAt: "2026-11-18T11:54:00+05:30" },
    { id: "stage", createdAt: "2026-11-18T11:56:00+05:30" },
    { id: "new-note", createdAt: "2026-11-18T12:06:30+05:30" }
  ];
  assert.deepEqual(newestFirstByCreatedAt(activities).map(activity => activity.id), ["new-note", "call", "stage", "no-answer", "registration"]);
  assert.equal(activities[1].id, "registration");
});
