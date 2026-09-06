import assert from "node:assert/strict";
import test from "node:test";
import { activeResponseFilterCount, applyResponseFilters, emptyResponseFilters } from "../lib/response-filters.ts";

const responses = [
  { id: "sent", answers: {}, submittedAt: "2026-09-06T08:00:00Z", confirmationStatus: "confirmed", mfwSyncStatus: "synced", whatsappStatus: "sent" },
  { id: "failed", answers: {}, submittedAt: "2026-09-06T09:00:00Z", confirmationStatus: "pending", mfwSyncStatus: "failed", whatsappStatus: "failed" },
  { id: "not-sent", answers: {}, submittedAt: "2026-09-06T10:00:00Z", confirmationStatus: "not_confirmed", mfwSyncStatus: "not_required", whatsappStatus: "not_sent" }
];

test("response status filters combine confirmation, MFW and WhatsApp state", () => {
  const filters = { ...emptyResponseFilters, confirmationStatus: "confirmed", mfwSyncStatus: "synced", whatsappStatus: "sent" };
  assert.deepEqual(applyResponseFilters(responses, filters).map((item) => item.id), ["sent"]);
  assert.equal(activeResponseFilterCount(filters), 3);
});

test("each response status filter works independently", () => {
  assert.deepEqual(applyResponseFilters(responses, { ...emptyResponseFilters, mfwSyncStatus: "failed" }).map((item) => item.id), ["failed"]);
  assert.deepEqual(applyResponseFilters(responses, { ...emptyResponseFilters, whatsappStatus: "not_sent" }).map((item) => item.id), ["not-sent"]);
});
