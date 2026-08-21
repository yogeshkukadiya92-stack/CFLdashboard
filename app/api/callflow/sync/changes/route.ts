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
  const leads = (state.leads as Lead[]).filter((lead) => lead.assignedTo === assignee || lead.assignedSalesPersonId === identity.salesPersonId).map((lead) => leadToCallFlow(lead, identity.userId)).filter((lead) => lead.updatedAt > cursor);
  return NextResponse.json({ leads, calls: [], callEvents: [], notes: [], followUps: [], leadStages: callFlowStages.map(([id, name], sortOrder) => ({ id, code: id.toUpperCase(), name, sortOrder, active: true })), dispositions: callFlowDispositions.map(([id, code, name, requiresNote, requiresFollowUp, targetStageId], sortOrder) => ({ id, code, name, icon: null, sortOrder, active: true, requiresNote, requiresFollowUp, targetStageId })), appConfiguration: [], deletedLeadIds: [], deletedFollowUpIds: [], nextCursor: Buffer.from(String(now)).toString("base64url"), serverTimestamp: new Date(now).toISOString() });
}
