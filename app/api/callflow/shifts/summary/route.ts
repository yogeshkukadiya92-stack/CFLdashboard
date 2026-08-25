import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import type { CallFlowCallRecord } from "@/lib/callflow-connector";
import { getAppState } from "@/lib/db";

type ShiftEvent = { salespersonId: string; type: "START" | "END"; at: string };
const indiaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

export async function GET(request: NextRequest) {
  const identity = readCallFlowBearer(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const connector = (state.integrations?.callflow && typeof state.integrations.callflow === "object" ? state.integrations.callflow : {}) as { callRecords?: unknown; shiftEvents?: unknown };
  const events = (Array.isArray(connector.shiftEvents) ? connector.shiftEvents : []) as ShiftEvent[];
  const records = (Array.isArray(connector.callRecords) ? connector.callRecords : []) as CallFlowCallRecord[];
  const today = indiaDay.format(new Date());
  const days = Array.from({ length: 7 }, (_, offset) => { const date = new Date(); date.setDate(date.getDate() - offset); return indiaDay.format(date); }).reverse();
  const rows = days.map((date) => shiftRow(date, identity.salesPersonId, events, records));
  const todayRow = rows.find((row) => row.date === today) || shiftRow(today, identity.salesPersonId, events, records);
  return NextResponse.json({ today: todayRow, last7Days: rows, totalActiveSeconds: rows.reduce((sum, row) => sum + row.activeSeconds, 0), totalCalls: rows.reduce((sum, row) => sum + row.calls, 0) });
}

function shiftRow(date: string, salespersonId: string, allEvents: ShiftEvent[], allCalls: CallFlowCallRecord[]) {
  const now = Date.now();
  const events = allEvents.filter((event) => event.salespersonId === salespersonId && indiaDay.format(new Date(event.at)) === date).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let openAt: number | null = null; let activeSeconds = 0;
  events.forEach((event) => { const at = Date.parse(event.at); if (event.type === "START") openAt = at; else if (openAt != null) { activeSeconds += Math.max(0, Math.floor((at - openAt) / 1000)); openAt = null; } });
  if (openAt != null && date === indiaDay.format(new Date())) activeSeconds += Math.max(0, Math.floor((now - openAt) / 1000));
  const calls = allCalls.filter((record) => record.salespersonId === salespersonId && indiaDay.format(new Date(record.startedAt)) === date).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  if (activeSeconds === 0 && calls.length > 1) activeSeconds = Math.max(0, Math.floor((Date.parse(calls.at(-1)!.startedAt) - Date.parse(calls[0].startedAt)) / 1000));
  return { date, shiftStartedAt: events.find((event) => event.type === "START")?.at ?? null, shiftEndedAt: [...events].reverse().find((event) => event.type === "END")?.at ?? null, activeSeconds, calls: calls.length, connected: calls.filter((call) => call.connected).length, firstCallAt: calls[0]?.startedAt ?? null, lastCallAt: calls.at(-1)?.startedAt ?? null, callsPerActiveHour: activeSeconds > 0 ? Math.round(calls.length / (activeSeconds / 3600) * 10) / 10 : 0 };
}
