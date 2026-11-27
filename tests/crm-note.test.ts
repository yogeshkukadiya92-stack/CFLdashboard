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
test("salesperson custom questions survive normalization and keep historical answers", () => {
  const first = addCrmNote(lead, { ...base, note: "", fields: [{ label: "Turnover", value: "20 lakh" }, { label: "Team members", value: "12" }] }, now);
  assert.equal(normalizeLead(first).noteFields?.[0].value, "20 lakh");
  assert.match(first.notes[0], /Turnover: 20 lakh\nTeam members: 12/);
  const next = addCrmNote(first, { ...base, fields: [{ label: "Turnover", value: "30 lakh" }] }, now);
  assert.equal(next.noteFields?.[0].value, "30 lakh");
  assert.match(next.notes[1], /20 lakh/);
  assert.throws(() => addCrmNote(lead, { ...base, fields: [{ label: " ", value: "12" }] }, now));
  assert.throws(() => addCrmNote(lead, { ...base, fields: [{ label: "Team", value: "12" }, { label: "team", value: "13" }] }, now));
});
test("typed questions validate answers and record who changed details", () => {
  const fields = [
    { label: "Team", value: "12", type: "number" as const, required: true, section: "Business details" },
    { label: "Period", value: "Yearly", type: "choice" as const, options: ["Monthly", "Yearly"] },
    { label: "Ready?", value: "Yes", type: "yesno" as const }
  ];
  const first = addCrmNote(lead, { ...base, actor: "Salesperson One", fields }, now);
  assert.equal(normalizeLead(first).noteFields?.[0].type, "number");
  assert.equal(first.noteFields?.[0].required, true);
  assert.ok(first.activities?.some(a=>a.createdBy === "Salesperson One" && a.message.includes("Team: Not filled → 12")));
  const next = addCrmNote(first, { ...base, actor: "Salesperson Two", fields: [{ ...fields[0], value: "15" }] }, now);
  assert.ok(next.activities?.some(a=>a.createdBy === "Salesperson Two" && a.message.includes("Team: 12 → 15")));
  assert.ok(next.activities?.some(a=>a.message.includes("Removed Period: Yearly")));
  assert.throws(()=>addCrmNote(lead, { ...base, fields: [{ ...fields[0], value: "" }] }, now), /Please answer/);
  assert.throws(()=>addCrmNote(lead, { ...base, fields: [{ ...fields[0], value: "abc" }] }, now), /number/);
  assert.throws(()=>addCrmNote(lead, { ...base, fields: [{ ...fields[1], value: "Weekly" }] }, now), /list/);
});
test("note without questions preserves existing required customer details", () => {
  const existing = { ...lead, noteFields: [{ label: "Team", value: "", required: true, type: "number" as const }] };
  const result = addCrmNote(existing, { ...base, fields: undefined }, now);
  assert.deepEqual(result.noteFields, existing.noteFields);
  assert.equal(result.notes[0], base.note);
  assert.ok(!result.activities?.some(activity => activity.message.startsWith("Removed Team")));
});
