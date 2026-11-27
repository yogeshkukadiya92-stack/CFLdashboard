import { cleanNoteFields, type NoteField } from "./crm-note-fields.ts";
import { callFlowDispositions, callFlowStages } from "./callflow-connector.ts";
import { createLeadActivity, nextPendingFollowUp, normalizeLead } from "./lead-utils.ts";
import type { Lead, LeadFollowUp } from "./types.ts";

export type CrmNoteInput = { note: string; fields?: NoteField[]; actor?: string; disposition: string; followUpAt: string; followUpType: LeadFollowUp["type"] };

export function addCrmNote(lead: Lead, input: CrmNoteInput, now = new Date()): Lead {
  const option = callFlowDispositions.find((item) => item[1] === input.disposition);
  const fields = input.fields ? cleanNoteFields(input.fields) : undefined;
  const missing = fields?.find(field => field.required && !field.value);
  if (missing) throw new Error(`Please answer: ${missing.label}`);
  const note = [input.note.trim(), ...(fields ?? []).filter((field) => field.value).map((field) => `${field.label}: ${field.value}`)].filter(Boolean).join("\n");
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
  for (const field of fields ?? []) {
    const previous = lead.noteFields?.find(old => old.label.toLowerCase() === field.label.toLowerCase());
    if (previous?.value !== field.value) activities.unshift({ ...createLeadActivity("note", `${field.label}: ${previous?.value || "Not filled"} → ${field.value || "Not filled"}`), createdAt: at, createdBy: input.actor || "Sales team" });
  }
  for (const previous of lead.noteFields ?? []) {
    if (fields && !fields.some(field => field.label.toLowerCase() === previous.label.toLowerCase())) activities.unshift({ ...createLeadActivity("note", `Removed ${previous.label}: ${previous.value || "Not filled"}`), createdAt: at, createdBy: input.actor || "Sales team" });
  }
  const wrongNumber = input.disposition === "WRONG_NUMBER";
  return normalizeLead({ ...lead, stage, priority: input.disposition === "HOT" ? "Hot" : input.disposition === "WARM" ? "Warm" : lead.priority,
    noteFields: fields ?? lead.noteFields,
    notes: [message, ...(lead.notes ?? [])], activities: activities.map(activity => lead.activities?.some(old => old.id === activity.id) ? activity : { ...activity, createdAt: at, createdBy: input.actor || "Sales team" }), followUps,
    nextFollowUp: nextPendingFollowUp(followUps)?.dueAt ?? "", updatedAt: at, lastActivityAt: at,
    lostReason: stage === "Lost" && option ? option[2] : lead.lostReason,
    doNotCall: wrongNumber || lead.doNotCall,
    tags: wrongNumber ? Array.from(new Set([...(lead.tags ?? []), "Do Not Call"])) : lead.tags
  });
}
