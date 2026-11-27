import test from "node:test";
import assert from "node:assert/strict";
import { addCrmNote } from "../lib/crm-note.ts";
import { normalizeLead } from "../lib/lead-utils.ts";
const now = new Date("2026-11-27T10:00:00Z");
const lead = normalizeLead({ id: "one", name: "Test", mobile: "9999999999", stage: "New Leads", notes: [], followUps: [] });
const base = { note: "Discussed introduction", disposition: "", followUpAt: "", followUpType: "Call" as const };
test("dashboard note preserves existing notes and records timeline", () => {
  const result = addCrmNote({ ...lead, notes: ["Previous"] }, base, now);
  assert.deepEqual(result.notes, [base.note, "Previous"]);
  assert.ok(result.activities?.some((item) => item.type === "note" && item.message === base.note));
});
test("CallFlow meeting outcome requires time and schedules a meeting", () => {
  assert.throws(() => addCrmNote(lead, { ...base, disposition: "GENERATE_MEETING" }, now));
  const result = addCrmNote(lead, { ...base, disposition: "GENERATE_MEETING", followUpAt: "2026-11-28T10:00:00Z" }, now);
  assert.equal(result.followUps?.[0].type, "Meeting");
  assert.equal(result.stage, "Contacted");
});
test("required notes, future dates and wrong-number DNC match CallFlow rules", () => {
  assert.throws(() => addCrmNote(lead, { ...base, disposition: "NOT_ELIGIBLE", note: " " }, now));
  assert.throws(() => addCrmNote(lead, { ...base, followUpAt: "2026-11-26T10:00:00Z" }, now));
  const result = addCrmNote(lead, { ...base, disposition: "WRONG_NUMBER" }, now);
  assert.equal(result.stage, "Lost"); assert.equal(result.doNotCall, true);
  assert.ok(result.tags?.includes("Do Not Call"));
});
