import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { callSummary, salespersonCallRows } from "@/lib/call-analytics";
import type { CallFlowCallRecord } from "@/lib/callflow-connector";
import { getAppState, saveAppState } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(secret && token.length === secret.length && timingSafeEqual(Buffer.from(token), Buffer.from(secret)));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const connector = (state.integrations?.callflow && typeof state.integrations.callflow === "object" ? state.integrations.callflow : {}) as { callRecords?: unknown; managerReportDeliveries?: unknown; shiftEvents?: unknown };
  const records = Array.isArray(connector.callRecords) ? connector.callRecords as CallFlowCallRecord[] : [];
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
  const to = day.format(now);
  const period = request.nextUrl.searchParams.get("period") === "weekly" ? "weekly" : "daily";
  const periodDays = period === "weekly" ? Array.from({ length: 7 }, (_, offset) => { const date = new Date(now); date.setDate(date.getDate() - offset); return day.format(date); }) : [to];
  const selected = records.filter((record) => periodDays.includes(day.format(new Date(record.startedAt))));
  const summary = callSummary(selected);
  const staff = salespersonCallRows(selected);
  const alerts = staff.filter((row) => row.total < 10 || (row.total >= 5 && row.connectionRate < 20));
  const message = [
    `CallFlow ${period} manager report · ${period === "weekly" ? `${periodDays.at(-1)} to ${to}` : to}`,
    `Calls: ${summary.total} · Connected: ${summary.connected} (${summary.connectionRate}%)`,
    `Unique leads: ${summary.uniqueLeads} · Talk time: ${summary.totalTalkSeconds}s`,
    ...staff.slice(0, 10).map((row) => `${row.name}: ${row.total} calls, ${row.connected} connected, ${row.connectionRate}%`),
    ...(alerts.length ? [`Attention: ${alerts.map((row) => row.name).join(", ")}`] : []),
  ].join("\n");
  const webhook = process.env.CALLFLOW_DAILY_REPORT_WEBHOOK_URL?.trim();
  let delivered = false;
  if (webhook) {
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: `callflow.${period}-report`, period, date: to, summary, staff, alerts, message }) });
    delivered = response.ok;
  }
  const integrations = { ...(state.integrations || {}) } as Record<string, unknown>;
  const existing = Array.isArray(connector.managerReportDeliveries) ? connector.managerReportDeliveries as unknown[] : [];
  integrations.callflow = { ...connector, managerReportDeliveries: [{ id: `report-${period}-${Date.now()}`, period, date: to, generatedAt: new Date().toISOString(), delivered, deliveryConfigured: Boolean(webhook), summary }, ...existing].slice(0, 365) };
  await saveAppState({ integrations });
  return NextResponse.json({ period, date: to, summary, staff, alerts, message, delivered, deliveryConfigured: Boolean(webhook) });
}
