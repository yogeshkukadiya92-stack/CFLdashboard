import { detectLeadRisk, taskBucket, type LeadRisk } from "./crm-workflow.ts";
import type { Lead, LeadFollowUp } from "./types.ts";

export type CrmAutomationOverview = {
  counts: { pending: number; overdue: number; today: number; slaRisk: number; unassigned: number };
  activity: Array<{ id: string; leadId: string; leadName: string; assignedTo: string; type: string; dueAt: string; bucket: string; note: string }>;
};

function followUpType(risk: Exclude<LeadRisk, null>): LeadFollowUp["type"] {
  if (risk === "REVENUE_AT_RISK") return "Payment Follow-up";
  if (risk === "STUCK") return "Meeting";
  return "Call";
}

function riskNote(risk: Exclude<LeadRisk, null>) {
  const notes: Record<Exclude<LeadRisk, null>, string> = {
    FIRST_RESPONSE_OVERDUE: "First response SLA breached — contact this lead immediately.",
    SLA_RISK: "High-value lead is inactive — complete a priority follow-up.",
    STUCK: "Qualified lead has no next action — schedule the next conversation.",
    REVENUE_AT_RISK: "Proposal is inactive — recover the pending commercial decision.",
    NO_NEXT_ACTION: "No next action is scheduled for this active lead."
  };
  return notes[risk];
}

export function getCrmAutomationOverview(leads: Lead[], now = new Date()): CrmAutomationOverview {
  const followUps = leads.flatMap((lead) => (lead.followUps || []).filter((item) => !item.completed).map((item) => ({ lead, item, bucket: taskBucket(item, now) })));
  return {
    counts: {
      pending: followUps.length,
      overdue: followUps.filter((row) => row.bucket === "overdue").length,
      today: followUps.filter((row) => row.bucket === "today").length,
      slaRisk: leads.filter((lead) => Boolean(detectLeadRisk(lead, now))).length,
      unassigned: leads.filter((lead) => !["Won", "Lost"].includes(lead.stage) && !lead.assignedTo && !lead.assignedSalesPersonId).length
    },
    activity: followUps.sort((first, second) => new Date(first.item.dueAt).getTime() - new Date(second.item.dueAt).getTime()).slice(0, 20).map(({ lead, item, bucket }) => ({ id: item.id, leadId: lead.id, leadName: lead.name, assignedTo: lead.assignedTo || "Unassigned", type: item.type, dueAt: item.dueAt, bucket, note: item.note }))
  };
}

export function applyCrmSlaAutomation(leads: Lead[], now = new Date()) {
  const created: Array<{ leadId: string; followUpId: string; risk: Exclude<LeadRisk, null> }> = [];
  const updated = leads.map((lead) => {
    const risk = detectLeadRisk(lead, now);
    if (!risk) return lead;
    const id = `auto-sla-${lead.id}-${risk.toLowerCase()}`;
    const followUps = lead.followUps || [];
    if (followUps.some((item) => item.id === id && !item.completed)) return lead;
    const createdAt = now.toISOString();
    const dueAt = new Date(now.getTime() + (risk === "NO_NEXT_ACTION" ? 4 * 60 * 60 * 1000 : 15 * 60 * 1000)).toISOString();
    const followUp: LeadFollowUp = { id, type: followUpType(risk), dueAt, note: riskNote(risk), completed: false, createdAt };
    created.push({ leadId: lead.id, followUpId: id, risk });
    return {
      ...lead,
      followUps: [...followUps, followUp],
      nextFollowUp: dueAt,
      updatedAt: createdAt,
      activities: [...(lead.activities || []), { id: `activity-${id}`, type: "follow_up" as const, message: `Automation created ${followUp.type.toLowerCase()}: ${followUp.note}`, createdAt, createdBy: "Workflow Automation" }]
    };
  });
  return { leads: updated, created };
}
