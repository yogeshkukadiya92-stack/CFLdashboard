import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { callSummary, leaderboardRows } from "@/lib/call-analytics";
import type { CallFlowCallRecord } from "@/lib/callflow-connector";
import { getAppState } from "@/lib/db";
import type { Lead, SalesTeamUser } from "@/lib/types";

type SalesPersonPerformance = { dailyCallTarget?: number; dailyConnectedTarget?: number; id: string; isActive?: boolean; name: string };
const indiaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

export async function GET(request: NextRequest) {
  const identity = readCallFlowBearer(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const users = (Array.isArray(state.salesTeamUsers) ? state.salesTeamUsers : []) as SalesTeamUser[];
  const user = users.find((item) => item.id === identity.userId && item.salesPersonId === identity.salesPersonId && item.active);
  if (!user) return NextResponse.json({ error: "Account is inactive" }, { status: 401 });
  const people = (Array.isArray(state.salesPeople) ? state.salesPeople : []) as SalesPersonPerformance[];
  const person = people.find((item) => item.id === identity.salesPersonId);
  if (!person) return NextResponse.json({ error: "Salesperson profile not found" }, { status: 404 });
  const connector = (state.integrations?.callflow && typeof state.integrations.callflow === "object" ? state.integrations.callflow : {}) as { callRecords?: unknown };
  const today = indiaDay.format(new Date());
  const records = (Array.isArray(connector.callRecords) ? connector.callRecords : []) as CallFlowCallRecord[];
  const selected = records.filter((record) => record.salespersonId === identity.salesPersonId && indiaDay.format(new Date(record.startedAt)) === today);
  const summary = callSummary(selected);
  const converted = new Set(selected.filter((record) => record.outcome.toUpperCase() === "CONVERTED").map((record) => record.leadId)).size;
  const assignee = person.name || user.name;
  const now = Date.now();
  const followUpsDue = ((Array.isArray(state.leads) ? state.leads : []) as Lead[]).filter((lead) => (lead.assignedSalesPersonId === identity.salesPersonId || lead.assignedTo === assignee) && Boolean(lead.nextFollowUp) && Date.parse(lead.nextFollowUp) <= now && lead.stage !== "Won" && lead.stage !== "Lost").length;
  const callTarget = Math.max(1, Number(person.dailyCallTarget) || 50);
  const connectedTarget = Math.max(1, Number(person.dailyConnectedTarget) || 20);
  const board = leaderboardRows(records.filter((record) => indiaDay.format(new Date(record.startedAt)) === today), people.filter((item) => item.isActive !== false));
  const rank = board.find((item) => item.id === identity.salesPersonId)?.rank || board.length;
  return NextResponse.json({ date: today, callTarget, connectedTarget, calls: summary.total, connected: summary.connected, connectionRate: summary.connectionRate, talkTimeSeconds: summary.totalTalkSeconds, conversions: converted, followUpsDue, callTargetPercent: Math.min(100, Math.round(summary.total / callTarget * 100)), connectedTargetPercent: Math.min(100, Math.round(summary.connected / connectedTarget * 100)), leaderboardRank: rank, leaderboardSize: board.length });
}
