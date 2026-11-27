import { callFlowDispositions, callFlowStages } from "./callflow-connector.ts";
import { createLeadActivity, nextPendingFollowUp, normalizeLead } from "./lead-utils.ts";
import type { Lead, LeadFollowUp } from "./types.ts";

export type CrmNoteInput = { note: string; disposition: string; followUpAt: string; followUpType: LeadFollowUp["type"] };

export function addCrmNote(lead: Lead, input: CrmNoteInput, now = new Date()): Lead {
  const option = callFlowDispositions.find((item) => item[1] === input.disposition);
  const note = input.note.trim();
  if (input.disposition && !option) throw new Error("Select a valid outcome.");
  if (!note && (!option || option[3])) throw new Error("Please enter a note.");
  if (option?.[4] && !input.followUpAt) throw new Error("Select the next action date and time.");
  const due = input.followUpAt ? new Date(input.followUpAt) : null;
  if (due && (!Number.isFinite(due.getTime()) || due <= now)) throw new Error("Choose a future date and time.");
  if (lead.blocked && due) throw new Error("Unblock this lead before scheduling a next action.");
  const at = now.toISOString();
  const followUps = [...(lead.followUps ?? [])];
  const activities = [...(lead.activities ?? [])];
  const message = option ? `${option[2]}${note ? `: ${note}` : ""}` : note;
  activities.unshift(createLeadActivity("note", message));
  if (due) {
    const type = input.disposition === "GENERATE_MEETING" ? "Meeting" : input.followUpType;
    followUps.unshift({ id: `followup-${crypto.randomUUID()}`, type, dueAt: due.toISOString(), note: message, completed: false, createdAt: at });
    activities.unshift(createLeadActivity("follow_up", `${type} scheduled for ${due.toISOString()}.`));
  }
  const stage = callFlowStages.find(([id]) => id === option?.[5])?.[1] ?? lead.stage;
  if (stage !== lead.stage) activities.unshift(createLeadActivity("stage", `Stage changed to ${stage}.`));
  const wrongNumber = input.disposition === "WRONG_NUMBER";
  return normalizeLead({ ...lead, stage, priority: input.disposition === "HOT" ? "Hot" : input.disposition === "WARM" ? "Warm" : lead.priority,
    notes: [message, ...(lead.notes ?? [])], activities, followUps,
    nextFollowUp: nextPendingFollowUp(followUps)?.dueAt ?? "", updatedAt: at, lastActivityAt: at,
    lostReason: stage === "Lost" && option ? option[2] : lead.lostReason,
    doNotCall: wrongNumber || lead.doNotCall,
    tags: wrongNumber ? Array.from(new Set([...(lead.tags ?? []), "Do Not Call"])) : lead.tags
  });
}
