import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { callFlowDispositions, callFlowStages, leadToCallFlow } from "@/lib/callflow-connector";
import { getAppState } from "@/lib/db";
import type { Lead, SalesTeamUser } from "@/lib/types";

export async function GET(request: NextRequest) {
  const identity = readCallFlowBearer(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "CRM database is unavailable." }, { status: 503 });
  const user = (state.salesTeamUsers as SalesTeamUser[]).find((item) => item.id === identity.userId && item.active);
  if (!user) return NextResponse.json({ error: "Account is inactive." }, { status: 401 });
  const person = (state.salesPeople as Array<{ id?: string; name?: string }>).find((item) => item.id === identity.salesPersonId);
  const assignee = person?.name || user.name;
  const cursor = Number(Buffer.from(request.nextUrl.searchParams.get("cursor") || "MA", "base64url").toString("utf8")) || 0;
  const now = Date.now();
  const assignedLeads = (state.leads as Lead[]).filter((lead) => lead.assignedTo === assignee || lead.assignedSalesPersonId === identity.salesPersonId);
  const phoneCounts = (state.leads as Lead[]).reduce((counts, lead) => { const phone = lead.mobile.replace(/\D/g, "").slice(-10); if (phone) counts.set(phone, (counts.get(phone) || 0) + 1); return counts; }, new Map<string, number>());
  const leads = assignedLeads.map((lead) => { const phone = lead.mobile.replace(/\D/g, "").slice(-10); return leadToCallFlow(lead, identity.userId, phoneCounts.get(phone) || 1); }).filter((lead) => lead.updatedAt > cursor);
  const content = (state.integrations.callFlowContent || {}) as { announcements?: unknown[]; scripts?: unknown[]; updatedAt?: string };
  const contentUpdatedAt = Date.parse(content.updatedAt || "") || 0;
  const appConfiguration = contentUpdatedAt > cursor ? [
    { key: "team_announcements", value: JSON.stringify(content.announcements || []), updatedAt: contentUpdatedAt },
    { key: "call_scripts", value: JSON.stringify(content.scripts || []), updatedAt: contentUpdatedAt },
  ] : [];
  const followUps = assignedLeads.flatMap((lead) => (lead.followUps || []).map((item) => ({
    id: item.id, leadId: lead.id, scheduledAt: Date.parse(item.dueAt) || now, note: item.note || null,
    priority: 1, assignedTo: identity.userId, type: item.type.toUpperCase(), status: item.completed ? "COMPLETED" : "PENDING",
    createdAt: Date.parse(item.createdAt || item.dueAt) || now, updatedAt: Date.parse(item.completedAt || item.createdAt || item.dueAt) || now,
    version: Date.parse(item.completedAt || item.createdAt || item.dueAt) || now,
  })));
  return NextResponse.json({ leads, calls: [], callEvents: [], notes: [], followUps, leadStages: callFlowStages.map(([id, name], sortOrder) => ({ id, code: id.toUpperCase(), name, sortOrder, active: true })), dispositions: callFlowDispositions.map(([id, code, name, requiresNote, requiresFollowUp, targetStageId], sortOrder) => ({ id, code, name, icon: null, sortOrder, active: true, requiresNote, requiresFollowUp, targetStageId })), appConfiguration, deletedLeadIds: [], deletedFollowUpIds: [], nextCursor: Buffer.from(String(now)).toString("base64url"), serverTimestamp: new Date(now).toISOString() });
}
