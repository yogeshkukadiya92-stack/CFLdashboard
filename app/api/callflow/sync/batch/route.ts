import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { applyCallFlowEvent, normalizedCallPhone, parseEventPayload, type CallFlowCallRecord, type CallFlowEvent } from "@/lib/callflow-connector";
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
    const callRecords = Array.isArray(connector.callRecords) ? connector.callRecords as CallFlowCallRecord[] : [];
    const callOutcomes = Array.isArray(connector.callOutcomes) ? connector.callOutcomes as Array<{ callId: string; leadId: string; outcome: string; at: string }> : [];
    const acceptedEventIds: string[] = [], failedEventIds: string[] = [];
    const now = Date.now();
    let leads = [...state.leads] as Lead[];
    for (const event of events) {
      if (!event?.eventUuid || !event.entityId) { if (event?.eventUuid) failedEventIds.push(event.eventUuid); continue; }
      if (processed.has(event.eventUuid)) { acceptedEventIds.push(event.eventUuid); continue; }
      const payload = parseEventPayload(event);
      let leadId = event.entityType === "LEAD" ? event.entityId : String(payload.leadId || "");
      let index = leads.findIndex((lead) => lead.id === leadId && (lead.assignedTo === assignee || lead.assignedSalesPersonId === identity.salesPersonId));
      if (event.entityType === "CALL" && payload.endedAt) {
        // A system call-log entry can arrive without a lead id. Link it by normalized
        // phone number, preferring the caller's assigned copy when duplicates exist.
        const callPhone = normalizedCallPhone(payload.phone);
        const phoneMatches = callPhone
          ? leads.map((lead, leadIndex) => ({ lead, leadIndex })).filter(({ lead }) => normalizedCallPhone(lead.mobile) === callPhone)
          : [];
        const matched = phoneMatches.find(({ lead }) => lead.assignedTo === assignee || lead.assignedSalesPersonId === identity.salesPersonId);
        if (matched) { index = matched.leadIndex; leadId = matched.lead.id; }
      }
      if (index < 0 && event.entityType === "CALL" && payload.endedAt && !leadId) {
        if (!callRecords.some((record) => record.eventUuid === event.eventUuid)) {
          const durationSeconds = Math.max(0, Number(payload.durationSeconds) || 0);
          const direction = String(payload.direction).toUpperCase() === "INCOMING" ? "INCOMING" : "OUTGOING";
          const startedAtMs = Number(payload.startedAt) || now;
          callRecords.push({
            id: String(payload.callId || event.entityId), eventUuid: event.eventUuid, leadId: "", leadName: "Unknown number",
            salespersonId: identity.salesPersonId, salespersonName: user.name, campaign: "Unassigned",
            phone: String(payload.phone || "Unknown"), direction,
            startedAt: new Date(startedAtMs).toISOString(), endedAt: new Date(Number(payload.endedAt) || now).toISOString(),
            durationSeconds, connected: durationSeconds > 0,
            outcome: durationSeconds > 0 ? "Connected" : direction === "INCOMING" ? "Missed" : "Not connected",
            source: String(payload.source || "android_call_log"),
            simSlot: payload.simSlot != null && Number.isFinite(Number(payload.simSlot)) ? Number(payload.simSlot) : null,
            simLabel: payload.simLabel ? String(payload.simLabel) : null,
            phoneAccountId: payload.phoneAccountId ? String(payload.phoneAccountId) : null,
          });
        }
        processed.add(event.eventUuid); acceptedEventIds.push(event.eventUuid); continue;
      }
      if (index < 0) { failedEventIds.push(event.eventUuid); continue; }
      if (event.entityType === "CALL" && event.operation === "UPDATE" && payload.leadId) {
        const recordIndex = callRecords.findIndex((record) => record.id === String(payload.callId || event.entityId));
        if (recordIndex >= 0) callRecords[recordIndex] = {
          ...callRecords[recordIndex],
          leadId,
          leadName: leads[index].name,
          campaign: leads[index].source || "Unknown",
          salespersonId: identity.salesPersonId,
          salespersonName: user.name,
        };
        processed.add(event.eventUuid); acceptedEventIds.push(event.eventUuid); continue;
      }
      leads[index] = applyCallFlowEvent(leads[index], event, user.name);
      if (event.entityType === "CALL" && payload.endedAt && !callRecords.some((record) => record.eventUuid === event.eventUuid)) {
        const durationSeconds = Math.max(0, Number(payload.durationSeconds) || 0);
        const startedAtMs = Number(payload.startedAt) || now;
        const recentOutcome = [...callOutcomes].reverse().find((item) => item.leadId === leadId && Math.abs(Date.parse(item.at) - startedAtMs) <= 24 * 60 * 60 * 1000);
        callRecords.push({
          id: String(payload.callId || event.entityId), eventUuid: event.eventUuid, leadId, leadName: leads[index].name,
          salespersonId: identity.salesPersonId, salespersonName: user.name, campaign: leads[index].source || "Unknown",
          phone: String(payload.phone || leads[index].mobile), direction: String(payload.direction).toUpperCase() === "INCOMING" ? "INCOMING" : "OUTGOING",
          startedAt: new Date(startedAtMs).toISOString(), endedAt: new Date(Number(payload.endedAt) || now).toISOString(),
          durationSeconds, connected: durationSeconds > 0, outcome: recentOutcome?.outcome || (durationSeconds > 0 ? "Connected" : String(payload.direction).toUpperCase() === "INCOMING" ? "Missed" : "Not connected"),
          source: String(payload.source || "callflow"),
          simSlot: payload.simSlot != null && Number.isFinite(Number(payload.simSlot)) ? Number(payload.simSlot) : null,
          simLabel: payload.simLabel ? String(payload.simLabel) : null,
          phoneAccountId: payload.phoneAccountId ? String(payload.phoneAccountId) : null,
        });
      }
      if (event.entityType === "CALL_DISPOSITION") {
        const callId = String(payload.callId || "");
        const outcome = String(payload.dispositionCode || payload.dispositionId || "Completed").replaceAll("_", " ");
        callOutcomes.push({ callId, leadId, outcome, at: new Date(Number(payload.createdAt) || now).toISOString() });
        const recordIndex = callRecords.findIndex((record) => record.id === callId);
        if (recordIndex >= 0) callRecords[recordIndex] = {
          ...callRecords[recordIndex],
          outcome,
        };
      }
      processed.add(event.eventUuid); acceptedEventIds.push(event.eventUuid);
    }
    integrations.callflow = { ...connector, processedEventIds: [...processed].slice(-5000), callRecords: callRecords.slice(-20000), callOutcomes: callOutcomes.slice(-20000), lastSuccessfulSyncAt: new Date().toISOString() };
    if (acceptedEventIds.length) await saveAppState({ leads, integrations });
    return NextResponse.json({ acceptedEventIds, failedEventIds, nextSyncCursor: Buffer.from(String(now)).toString("base64url"), serverTimestamp: new Date(now).toISOString() });
  } catch { return NextResponse.json({ error: "Could not process sync batch." }, { status: 400 }); }
}
