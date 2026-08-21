import type { Lead, LeadActivity, LeadFollowUp } from "@/lib/types";

export const callFlowStages = [
  ["new_leads", "New Leads"], ["contacted", "Contacted"], ["qualified", "Qualified"],
  ["proposal", "Proposal"], ["won", "Won"], ["lost", "Lost"]
] as const;

export const callFlowDispositions = [
  ["hot", "HOT", "Hot", false, false, "qualified"],
  ["interested", "INTERESTED", "Interested", false, false, "qualified"],
  ["follow_up", "FOLLOW_UP", "Follow-up", false, true, "contacted"],
  ["info_sent", "INFORMATION_SENT", "Information sent", false, false, "contacted"],
  ["not_interested", "NOT_INTERESTED", "Not interested", true, false, "lost"],
  ["no_answer", "NO_ANSWER", "No answer", false, false, null],
  ["busy", "BUSY", "Busy", false, true, null],
  ["wrong_number", "WRONG_NUMBER", "Wrong number", true, false, "lost"],
  ["converted", "CONVERTED", "Converted", false, false, "won"]
] as const;

function time(value?: string) { const parsed = Date.parse(value || ""); return Number.isFinite(parsed) ? parsed : 0; }
function iso(value: unknown, fallback = Date.now()) { const n = Number(value); return new Date(Number.isFinite(n) ? n : fallback).toISOString(); }
function stageId(stage: string) { return stage.trim().toLowerCase().replace(/\s+/g, "_"); }
function stageName(id: string) { return callFlowStages.find(([code]) => code === id)?.[1] || "Contacted"; }
function phone(value: string) { const digits = value.replace(/\D/g, ""); return digits.length > 10 ? digits.slice(-10) : digits; }

export function leadToCallFlow(lead: Lead, userId: string) {
  const updatedAt = Math.max(time(lead.updatedAt), time(lead.lastActivityAt), time(lead.createdAt), 1);
  const normalizedPhone = phone(lead.mobile);
  return {
    id: lead.id, serverId: lead.id, name: lead.name, company: lead.interest || null, city: lead.city || null,
    normalizedPhone, displayPhone: lead.mobile || normalizedPhone, stageId: stageId(lead.stage),
    assignedUserId: lead.assignedSalesPersonId || lead.assignedSalesPersonCode || userId,
    campaignId: lead.source || null, nextFollowUpAt: time(lead.nextFollowUp) || null,
    updatedAt, updatedBy: "cfl-dashboard", version: updatedAt
  };
}

export type CallFlowEvent = { eventUuid: string; entityType: string; entityId: string; operation: string; payload?: Record<string, unknown> };

export function parseEventPayload(event: CallFlowEvent) {
  const raw = event.payload?.raw;
  if (typeof raw === "string") { try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; } }
  return event.payload || {};
}

export function applyCallFlowEvent(lead: Lead, event: CallFlowEvent, actor: string, now = Date.now()): Lead {
  const payload = parseEventPayload(event);
  const at = iso(payload.createdAt, now);
  const activities = [...(lead.activities || [])];
  const notes = [...(lead.notes || [])];
  const callHistory = [...(lead.callHistory || [])];
  const followUps = [...(lead.followUps || [])];
  let stage = lead.stage;
  let nextFollowUp = lead.nextFollowUp;

  if (event.entityType === "CALL") {
    const message = `Call initiated from CallFlow${payload.callId ? ` (${String(payload.callId).slice(0, 8)})` : ""}`;
    callHistory.push(message);
    activities.push({ id: event.eventUuid, type: "call", message, createdAt: at, createdBy: actor });
  } else if (event.entityType === "CALL_DISPOSITION") {
    const disposition = String(payload.dispositionCode || payload.dispositionId || "Call completed").replace(/_/g, " ");
    const note = String(payload.note || "").trim();
    const message = `Call result: ${disposition}${note ? ` — ${note}` : ""}`;
    callHistory.push(message);
    activities.push({ id: event.eventUuid, type: "call", message, createdAt: at, createdBy: actor });
    if (note && !notes.includes(note)) notes.push(note);
  } else if (event.entityType === "NOTE") {
    const note = String(payload.body || payload.note || "").trim();
    if (note && !notes.includes(note)) notes.push(note);
    if (note) activities.push({ id: event.eventUuid, type: "note", message: note, createdAt: at, createdBy: actor });
  } else if (event.entityType === "FOLLOW_UP") {
    const dueAt = iso(payload.scheduledAt, now);
    const note = String(payload.note || "").trim();
    if (!followUps.some((item) => item.id === event.entityId)) followUps.push({ id: event.entityId, dueAt, type: "Call", note, completed: false, createdAt: at });
    nextFollowUp = dueAt;
    activities.push({ id: event.eventUuid, type: "follow_up", message: `Call follow-up scheduled${note ? ` — ${note}` : ""}`, createdAt: at, createdBy: actor });
  } else if (event.entityType === "LEAD") {
    const requestedStage = String(payload.stageId || "");
    if (requestedStage) stage = stageName(requestedStage) as Lead["stage"];
    if (payload.followUpAt) nextFollowUp = iso(payload.followUpAt, now);
    activities.push({ id: event.eventUuid, type: "stage", message: `Stage updated to ${stage}`, createdAt: at, createdBy: actor });
  }
  return { ...lead, stage, nextFollowUp, notes, callHistory, activities: activities as LeadActivity[], followUps: followUps as LeadFollowUp[], updatedAt: at, lastActivityAt: at };
}
