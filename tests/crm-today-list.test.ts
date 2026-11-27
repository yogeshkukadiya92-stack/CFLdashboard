import test from "node:test";
import assert from "node:assert/strict";
import { compareLeads, lastContactTime, matchesLeadSearch } from "../lib/crm-today-list.ts";
import { normalizeLead } from "../lib/lead-utils.ts";
const lead = normalizeLead({ id: "test-12", name: "Pradip Shah", mobile: "+919427165817", city: "Surat", email: "pradip@example.com", priority: "Hot", score: 75 });
test("search supports formatted phones and multi-word case-insensitive details", () => {
  for (const query of ["+91 94271-65817", "9427165817", " PRADIP   Surat ", "pradip@example.com", "test-12"]) assert.equal(matchesLeadSearch(lead, query), true, query);
  for (const query of ["unknown", "wrong9427165817", "Surat Ahmedabad", "00000000"]) assert.equal(matchesLeadSearch(lead, query), false, query);
});
test("last contact ignores unrelated updates and invalid dates", () => {
  const record = normalizeLead({ ...lead, activities: [
    { id: "1", type: "call", createdAt: "2026-11-20T10:00:00Z", message: "Called" },
    { id: "2", type: "assignment", createdAt: "2026-11-27T10:00:00Z", message: "Assigned" },
    { id: "3", type: "whatsapp", createdAt: "invalid", message: "Message" }
  ] });
  assert.equal(lastContactTime(record), Date.parse("2026-11-20T10:00:00Z"));
  assert.equal(lastContactTime(lead), 0);
  for (const descending of [true, false]) assert.ok(compareLeads(record, lead, "contact", descending) < 0);
});
test("sorts name, city and quality in either direction", () => {
  const other = normalizeLead({ ...lead, id: "other", name: "Zebra", city: "Vadodara", priority: "Cold", score: 95 });
  assert.ok(compareLeads(lead, other, "name", false) < 0);
  assert.ok(compareLeads(lead, other, "city", true) > 0);
  assert.ok(compareLeads(lead, other, "quality", true) < 0);
  assert.ok(compareLeads(lead, other, "quality", false) > 0);
});
