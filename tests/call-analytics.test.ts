import test from "node:test";
import assert from "node:assert/strict";
import { callRecordsCsv, callSummary, filterCallRecords, leadJourneyRows, leaderboardRows, salespersonCallRows } from "../lib/call-analytics.ts";
import type { CallFlowCallRecord } from "../lib/callflow-connector.ts";

const records: CallFlowCallRecord[] = [
  { id: "c1", eventUuid: "e1", leadId: "l1", leadName: "Lead One", salespersonId: "s1", salespersonName: "Sales One", campaign: "Meta", phone: "9999999999", direction: "OUTGOING", startedAt: "2026-08-22T05:00:00.000Z", endedAt: "2026-08-22T05:02:00.000Z", durationSeconds: 120, connected: true, outcome: "INTERESTED", source: "android_call_log" },
  { id: "c2", eventUuid: "e2", leadId: "l1", leadName: "Lead One", salespersonId: "s1", salespersonName: "Sales One", campaign: "Meta", phone: "9999999999", direction: "OUTGOING", startedAt: "2026-08-23T05:00:00.000Z", endedAt: "2026-08-23T05:00:00.000Z", durationSeconds: 0, connected: false, outcome: "NO ANSWER", source: "android_call_log" },
  { id: "c3", eventUuid: "e3", leadId: "l2", leadName: "Lead Two", salespersonId: "s2", salespersonName: "Sales Two", campaign: "Referral", phone: "8888888888", direction: "INCOMING", startedAt: "2026-08-22T06:00:00.000Z", endedAt: "2026-08-22T06:01:00.000Z", durationSeconds: 60, connected: true, outcome: "FOLLOW UP", source: "android_call_log" },
];

test("call analytics calculates connected, unique lead and talk-time KPIs", () => {
  assert.deepEqual(callSummary(records), { total: 3, connected: 2, missed: 1, uniqueLeads: 2, totalTalkSeconds: 180, averageTalkSeconds: 90, connectionRate: 67 });
});

test("date, salesperson and campaign filters use structured call records", () => {
  const values = filterCallRecords(records, { from: "2026-08-22", to: "2026-08-22", salesperson: "Sales One", campaign: "Meta" });
  assert.deepEqual(values.map((record) => record.id), ["c1"]);
});

test("staff and lead journey reports aggregate attempts", () => {
  assert.equal(salespersonCallRows(records)[0].total, 2);
  assert.equal(leadJourneyRows(records).find((row) => row.leadId === "l1")?.attempts, 2);
});

test("CSV export includes raw call dimensions", () => {
  const csv = callRecordsCsv(records);
  assert.match(csv, /Salesperson/);
  assert.match(csv, /Sales One/);
  assert.match(csv, /INTERESTED/);
});

test("leaderboard rewards target progress and connection quality instead of raw volume only", () => {
  const board = leaderboardRows(records, [{ id: "s1", name: "Sales One", dailyCallTarget: 2, dailyConnectedTarget: 1 }, { id: "s2", name: "Sales Two", dailyCallTarget: 10, dailyConnectedTarget: 5 }]);
  assert.equal(board[0].name, "Sales One");
  assert.equal(board[0].rank, 1);
});
