import assert from "node:assert/strict";
import test from "node:test";
import { activeResponseFilterCount, applyResponseFilters, emptyResponseFilters, responseDateRangeLabel } from "../lib/response-filters.ts";

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

test("registration summary date range includes both selected days", () => {
  const filters = { ...emptyResponseFilters, datePreset: "custom" as const, fromDate: "2026-10-01", toDate: "2026-10-08" };
  const entries = [
    { answers: {}, submittedAt: "2026-09-30T23:59:59" },
    { answers: {}, submittedAt: "2026-10-01T00:00:00" },
    { answers: {}, submittedAt: "2026-10-08T23:59:59" },
    { answers: {}, submittedAt: "2026-10-09T00:00:00" }
  ];
  assert.deepEqual(applyResponseFilters(entries, filters), entries.slice(1, 3));
  assert.equal(responseDateRangeLabel(filters), "01 Oct 2026 to 08 Oct 2026");
});

test("summary date labels support presets and open ranges", () => {
  const now = new Date("2026-10-08T12:00:00");
  assert.equal(responseDateRangeLabel(emptyResponseFilters, now), "All dates");
  assert.equal(responseDateRangeLabel({ ...emptyResponseFilters, datePreset: "today" }, now), "08 Oct 2026");
  assert.equal(responseDateRangeLabel({ ...emptyResponseFilters, datePreset: "yesterday" }, now), "07 Oct 2026");
  assert.equal(responseDateRangeLabel({ ...emptyResponseFilters, datePreset: "last7" }, now), "02 Oct 2026 to 08 Oct 2026");
  assert.equal(responseDateRangeLabel({ ...emptyResponseFilters, datePreset: "custom", fromDate: "2026-10-01", fromTime: "09:00" }, now), "01 Oct 2026 09:00 to Any date");
});
