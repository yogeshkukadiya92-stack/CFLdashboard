import type { CallFlowCallRecord } from "@/lib/callflow-connector";

export type CallAnalyticsFilters = { from?: string; to?: string; salesperson?: string; campaign?: string };

export function filterCallRecords(records: CallFlowCallRecord[], filters: CallAnalyticsFilters) {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  return records.filter((record) => {
    const at = Date.parse(record.startedAt);
    return at >= from && at <= to
      && (!filters.salesperson || record.salespersonName === filters.salesperson)
      && (!filters.campaign || record.campaign === filters.campaign);
  });
}

export function callSummary(records: CallFlowCallRecord[]) {
  const connected = records.filter((record) => record.connected);
  const totalTalkSeconds = connected.reduce((sum, record) => sum + record.durationSeconds, 0);
  return {
    total: records.length,
    connected: connected.length,
    missed: records.length - connected.length,
    uniqueLeads: new Set(records.map((record) => record.leadId)).size,
    totalTalkSeconds,
    averageTalkSeconds: connected.length ? Math.round(totalTalkSeconds / connected.length) : 0,
    connectionRate: records.length ? Math.round(connected.length / records.length * 100) : 0,
  };
}

export function salespersonCallRows(records: CallFlowCallRecord[]) {
  const grouped = new Map<string, CallFlowCallRecord[]>();
  records.forEach((record) => grouped.set(record.salespersonName || "Unknown", [...(grouped.get(record.salespersonName || "Unknown") || []), record]));
  return [...grouped].map(([name, rows]) => ({ name, ...callSummary(rows) })).sort((a, b) => b.total - a.total);
}

export function leaderboardRows(records: CallFlowCallRecord[], people: Array<{ id: string; name: string; dailyCallTarget?: number; dailyConnectedTarget?: number }>) {
  return people.map((person) => {
    const rows = records.filter((record) => record.salespersonId === person.id || record.salespersonName === person.name);
    const summary = callSummary(rows); const callTarget = Math.max(1, Number(person.dailyCallTarget) || 50); const connectedTarget = Math.max(1, Number(person.dailyConnectedTarget) || 20);
    const conversions = new Set(rows.filter((record) => record.outcome.toUpperCase() === "CONVERTED").map((record) => record.leadId)).size;
    const score = Math.round(Math.min(1, summary.total / callTarget) * 40 + Math.min(1, summary.connected / connectedTarget) * 30 + summary.connectionRate / 100 * 20 + Math.min(1, conversions / 3) * 10);
    return { id: person.id, name: person.name, score, conversions, callProgress: Math.min(100, Math.round(summary.total / callTarget * 100)), connectedProgress: Math.min(100, Math.round(summary.connected / connectedTarget * 100)), ...summary };
  }).sort((a, b) => b.score - a.score || b.connected - a.connected || b.total - a.total).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function leadJourneyRows(records: CallFlowCallRecord[]) {
  const grouped = new Map<string, CallFlowCallRecord[]>();
  records.forEach((record) => grouped.set(record.leadId, [...(grouped.get(record.leadId) || []), record]));
  return [...grouped].map(([leadId, rows]) => {
    const sorted = [...rows].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
    return { leadId, leadName: sorted[0]?.leadName || "Unknown", phone: sorted[0]?.phone || "", salesperson: sorted.at(-1)?.salespersonName || "", attempts: rows.length, ...callSummary(rows), firstCallAt: sorted[0]?.startedAt || "", lastCallAt: sorted.at(-1)?.startedAt || "", lastOutcome: sorted.at(-1)?.outcome || "" };
  }).sort((a, b) => Date.parse(b.lastCallAt) - Date.parse(a.lastCallAt));
}

export function hourlyConnectionRows(records: CallFlowCallRecord[]) {
  return Array.from({ length: 24 }, (_, hour) => {
    const rows = records.filter((record) => new Date(record.startedAt).getHours() === hour);
    const summary = callSummary(rows);
    return { hour, ...summary };
  }).filter((row) => row.total > 0);
}

export function callRecordsCsv(records: CallFlowCallRecord[]) {
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const headers = ["Call ID", "Lead", "Phone", "Salesperson", "Campaign", "Direction", "Started At", "Ended At", "Duration Seconds", "Connected", "Outcome"];
  const rows = records.map((record) => [record.id, record.leadName, record.phone, record.salespersonName, record.campaign, record.direction, record.startedAt, record.endedAt, record.durationSeconds, record.connected ? "Yes" : "No", record.outcome]);
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}
