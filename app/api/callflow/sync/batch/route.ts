import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { applyCallFlowEvent, parseEventPayload, type CallFlowEvent } from "@/lib/callflow-connector";
import { getAppState, saveAppState } from "@/lib/db";
import type { Lead, SalesTeamUser } from "@/lib/types";

export async function POST(request: NextRequest) {
  const identity = readCallFlowBearer(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { events?: CallFlowEvent[] };
    const events = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "CRM database is unavailable." }, { status: 503 });
    const user = (state.salesTeamUsers as SalesTeamUser[]).find((item) => item.id === identity.userId && item.active);
    if (!user) return NextResponse.json({ error: "Account is inactive." }, { status: 401 });
    const person = (state.salesPeople as Array<{ id?: string; name?: string }>).find((item) => item.id === identity.salesPersonId);
    const assignee = person?.name || user.name;
    const integrations = { ...(state.integrations || {}) } as Record<string, unknown>;
    const connector = (integrations.callflow && typeof integrations.callflow === "object" ? integrations.callflow : {}) as Record<string, unknown>;
    const processed = new Set(Array.isArray(connector.processedEventIds) ? connector.processedEventIds.map(String) : []);
    const acceptedEventIds: string[] = [], failedEventIds: string[] = [];
    let leads = [...state.leads] as Lead[];
    for (const event of events) {
      if (!event?.eventUuid || !event.entityId) { if (event?.eventUuid) failedEventIds.push(event.eventUuid); continue; }
      if (processed.has(event.eventUuid)) { acceptedEventIds.push(event.eventUuid); continue; }
      const payload = parseEventPayload(event);
      const leadId = event.entityType === "LEAD" ? event.entityId : String(payload.leadId || "");
      const index = leads.findIndex((lead) => lead.id === leadId && (lead.assignedTo === assignee || lead.assignedSalesPersonId === identity.salesPersonId));
      if (index < 0) { failedEventIds.push(event.eventUuid); continue; }
      leads[index] = applyCallFlowEvent(leads[index], event, user.name);
      processed.add(event.eventUuid); acceptedEventIds.push(event.eventUuid);
    }
    integrations.callflow = { ...connector, processedEventIds: [...processed].slice(-5000), lastSuccessfulSyncAt: new Date().toISOString() };
    if (acceptedEventIds.length) await saveAppState({ leads, integrations });
    const now = Date.now();
    return NextResponse.json({ acceptedEventIds, failedEventIds, nextSyncCursor: Buffer.from(String(now)).toString("base64url"), serverTimestamp: new Date(now).toISOString() });
  } catch { return NextResponse.json({ error: "Could not process sync batch." }, { status: 400 }); }
}
