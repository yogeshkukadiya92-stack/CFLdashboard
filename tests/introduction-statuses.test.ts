import assert from "node:assert/strict";
import test from "node:test";
import { defaultIntroductionStatuses as defaults, introductionStatuses, validateIntroductionStatuses } from "../lib/introduction-statuses.ts";

test("supports Gujarati custom names and confirmation classification", () => {
  const saved = validateIntroductionStatuses([...defaults, { id: "custom_ready", label: "  આવવાના છે  ", active: true, isConfirmed: true }], defaults);
  assert.equal(saved.at(-1)?.label, "આવવાના છે");
  assert.equal(saved.at(-1)?.isConfirmed, true);
  assert.deepEqual(introductionStatuses({ callFlowContent: { introductionStatuses: saved } }), saved);
});
test("renames keep ids and system confirmation meaning", () => {
  const saved = validateIntroductionStatuses(defaults.map(status => status.id === "confirmed" ? { ...status, label: "Yes, attending", isConfirmed: false } : status), defaults);
  assert.equal(saved.find(status => status.id === "confirmed")?.isConfirmed, true);
  assert.equal(saved.find(status => status.id === "confirmed")?.label, "Yes, attending");
});
test("rejects duplicate names, blank names, removed history and all inactive choices", () => {
  assert.throws(() => validateIntroductionStatuses([...defaults, { id: "duplicate", label: " confirmed ", active: true, isConfirmed: false }], defaults), /unique/);
  assert.throws(() => validateIntroductionStatuses([...defaults, { id: "blank", label: "  ", active: true, isConfirmed: false }], defaults), /name/);
  assert.throws(() => validateIntroductionStatuses(defaults.slice(1), defaults), /history/);
  assert.throws(() => validateIntroductionStatuses(defaults.map(status => ({ ...status, active: false })), defaults), /active/);
});
