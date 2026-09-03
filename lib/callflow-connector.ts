import type { Lead, LeadActivity, LeadFollowUp } from "@/lib/types";

export const callFlowStages = [
  ["new_leads", "New Leads"], ["contacted", "Contacted"], ["qualified", "Qualified"],
  ["proposal", "Proposal"], ["won", "Won"], ["lost", "Lost"]
] as const;

export const callFlowDispositions = [
  ["warm", "WARM", "Warm", false, false, "qualified"],
  ["invite_intro", "INVITE_INTRO", "Invite intro", false, false, "contacted"],
  ["online_intro", "ONLINE_INTRO", "Online intro", false, true, "contacted"],
  ["next_time_attend", "NEXT_TIME_ATTEND", "Next time attend", false, true, "contacted"],
  ["intro_attended", "INTRO_ATTENDED", "Intro attended", false, false, "qualified"],
  ["not_eligible", "NOT_ELIGIBLE", "Not eligible", true, false, "lost"],
  ["generate_meeting", "GENERATE_MEETING", "Generate meeting", false, true, "contacted"],
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

export function callDurationLabel(value: unknown) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

export function normalizedCallPhone(value: unknown) { return phone(String(value || "")); }

export function leadToCallFlow(lead: Lead, userId: string, duplicateCount = 1) {
  const updatedAt = Math.max(time(lead.updatedAt), time(lead.lastActivityAt), time(lead.createdAt), 1);
  const normalizedPhone = phone(lead.mobile);
  return {
    id: lead.id, serverId: lead.id, name: lead.name, company: lead.interest || null, city: lead.city || null,
    normalizedPhone, displayPhone: lead.mobile || normalizedPhone, stageId: stageId(lead.stage),
    assignedUserId: lead.assignedSalesPersonId || lead.assignedSalesPersonCode || userId,
    campaignId: lead.source || null, nextFollowUpAt: time(lead.nextFollowUp) || null,
    updatedAt, updatedBy: "cfl-dashboard", version: updatedAt, doNotCall: lead.doNotCall === true || lead.tags?.some((tag) => tag.toLowerCase() === "do not call"), duplicateCount: Math.max(1, duplicateCount),
    score: Math.max(0, Math.round(Number(lead.score) || 0)), quality: lead.priority || null
  };
}

export type CallFlowEvent = { eventUuid: string; entityType: string; entityId: string; operation: string; payload?: Record<string, unknown> };

export type CallFlowCallRecord = {
  id: string;
  eventUuid: string;
  leadId: string;
  leadName: string;
  salespersonId: string;
  salespersonName: string;
  campaign: string;
  phone: string;
  direction: "INCOMING" | "OUTGOING";
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  connected: boolean;
  outcome: string;
  source: string;
  simSlot?: number | null;
  simLabel?: string | null;
  phoneAccountId?: string | null;
};

export function parseEventPayload(event: CallFlowEvent) {
  const raw = event.payload?.raw;
  if (typeof raw === "string") { try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; } }
  return event.payload || {};
}

export function applyCallFlowEvent(lead: Lead, event: CallFlowEvent, actor: string, now = Date.now()): Lead {
  const payload = parseEventPayload(event);
  const at = iso(payload.createdAt ?? payload.startedAt, now);
  const activities = [...(lead.activities || [])];
  const notes = [...(lead.notes || [])];
  const callHistory = [...(lead.callHistory || [])];
  const followUps = [...(lead.followUps || [])];
  let stage = lead.stage;
  let nextFollowUp = lead.nextFollowUp;
  let doNotCall = lead.doNotCall === true;

  if (event.entityType === "CALL") {
    const duration = Math.max(0, Number(payload.durationSeconds) || 0);
    const direction = String(payload.direction || "OUTGOING").toLowerCase();
    const message = payload.endedAt
      ? `${direction === "incoming" ? "Incoming" : "Outgoing"} call · ${callDurationLabel(duration)} · ${duration > 0 ? "Connected" : direction === "incoming" ? "Missed" : "Not connected"} · Salesperson: ${actor}`
      : `Call initiated from CallFlow${payload.callId ? ` (${String(payload.callId).slice(0, 8)})` : ""}`;
    callHistory.push(message);
    activities.push({ id: event.eventUuid, type: "call", message, createdAt: at, createdBy: actor });
  } else if (event.entityType === "CALL_DISPOSITION") {
    const disposition = String(payload.dispositionCode || payload.dispositionId || "Call completed").replace(/_/g, " ");
    const note = String(payload.note || "").trim();
    const message = `Call result: ${disposition}${note ? ` — ${note}` : ""}`;
    callHistory.push(message);
    activities.push({ id: event.eventUuid, type: "call", message, createdAt: at, createdBy: actor });
    if (note && !notes.includes(note)) notes.push(note);
    if (String(payload.dispositionCode || "").toUpperCase() === "WRONG_NUMBER") { doNotCall = true; stage = "Lost"; if (!lead.tags?.includes("Do Not Call")) lead = { ...lead, tags: [...(lead.tags || []), "Do Not Call"] }; }
  } else if (event.entityType === "NOTE") {
    const note = String(payload.body || payload.note || "").trim();
    if (note && !notes.includes(note)) notes.push(note);
    if (note) activities.push({ id: event.eventUuid, type: "note", message: note, createdAt: at, createdBy: actor });
  } else if (event.entityType === "FOLLOW_UP") {
    if (event.operation === "COMPLETE") {
      const completedAt = iso(payload.completedAt, now);
      const updated = followUps.map((item) => item.id === event.entityId ? { ...item, completed: true, completedAt } : item);
      const nextPending = updated.filter((item) => !item.completed).sort((a, b) => time(a.dueAt) - time(b.dueAt))[0];
      activities.push({ id: event.eventUuid, type: "follow_up", message: "Call follow-up completed", createdAt: completedAt, createdBy: actor });
      return { ...lead, followUps: updated as LeadFollowUp[], nextFollowUp: nextPending?.dueAt || "", activities: activities as LeadActivity[], updatedAt: completedAt, lastActivityAt: completedAt };
    }
    if (event.operation === "CANCEL") {
      const cancelledAt = iso(payload.cancelledAt, now);
      const updated = followUps.map((item) => item.id === event.entityId ? { ...item, completed: true, completedAt: cancelledAt } : item);
      const nextPending = updated.filter((item) => !item.completed).sort((a, b) => time(a.dueAt) - time(b.dueAt))[0];
      activities.push({ id: event.eventUuid, type: "follow_up", message: "Call follow-up cancelled", createdAt: cancelledAt, createdBy: actor });
      return { ...lead, followUps: updated as LeadFollowUp[], nextFollowUp: nextPending?.dueAt || "", activities: activities as LeadActivity[], updatedAt: cancelledAt, lastActivityAt: cancelledAt };
    }
    if (event.operation === "UPDATE") {
      const dueAt = iso(payload.scheduledAt, now); const note = String(payload.note || "").trim();
      const updated = followUps.map((item) => item.id === event.entityId ? { ...item, dueAt, note, completed: false } : item);
      const nextPending = updated.filter((item) => !item.completed).sort((a, b) => time(a.dueAt) - time(b.dueAt))[0];
      activities.push({ id: event.eventUuid, type: "follow_up", message: `Call follow-up rescheduled${note ? ` — ${note}` : ""}`, createdAt: at, createdBy: actor });
      return { ...lead, followUps: updated as LeadFollowUp[], nextFollowUp: nextPending?.dueAt || dueAt, activities: activities as LeadActivity[], updatedAt: at, lastActivityAt: at };
    }
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
  return { ...lead, stage, doNotCall, nextFollowUp, notes, callHistory, activities: activities as LeadActivity[], followUps: followUps as LeadFollowUp[], updatedAt: at, lastActivityAt: at };
}
