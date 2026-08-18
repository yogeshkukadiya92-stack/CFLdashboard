import type { Lead, LeadFollowUp } from "./types.ts";
import { nextPendingFollowUp } from "./lead-utils.ts";

export const CRM_WORKFLOW_CONFIG = {
  newLeadSlaMinutes: 30,
  tierAInactiveHours: 24,
  qualifiedInactiveHours: 48,
  proposalInactiveHours: 24
} as const;

export type LeadRisk = "FIRST_RESPONSE_OVERDUE" | "SLA_RISK" | "STUCK" | "REVENUE_AT_RISK" | "NO_NEXT_ACTION" | null;

export type PrioritizedLead = {
  lead: Lead;
  points: number;
  reason: string;
  recommendedAction: LeadFollowUp["type"];
  risk: LeadRisk;
  dueAt?: string;
};

const terminalStages = new Set(["Won", "Lost"]);

export function detectLeadRisk(lead: Lead, now = new Date()): LeadRisk {
  if (terminalStages.has(lead.stage)) return null;
  const next = nextPendingFollowUp(lead.followUps ?? []);
  const inactiveHours = hoursBetween(lead.lastActivityAt || lead.createdAt, now);
  const ageMinutes = inactiveHours * 60;
  const hasContact = (lead.activities ?? []).some((activity) => ["call", "whatsapp"].includes(activity.type));
  if (lead.stage === "New Leads" && !hasContact && ageMinutes >= CRM_WORKFLOW_CONFIG.newLeadSlaMinutes) return "FIRST_RESPONSE_OVERDUE";
  if ((lead.priority === "Hot" || lead.score >= 65) && inactiveHours >= CRM_WORKFLOW_CONFIG.tierAInactiveHours) return "SLA_RISK";
  if (lead.stage === "Proposal" && inactiveHours >= CRM_WORKFLOW_CONFIG.proposalInactiveHours) return "REVENUE_AT_RISK";
  if (lead.stage === "Qualified" && !next && inactiveHours >= CRM_WORKFLOW_CONFIG.qualifiedInactiveHours) return "STUCK";
  if (!next) return "NO_NEXT_ACTION";
  return null;
}

export function prioritizeLead(lead: Lead, now = new Date()): PrioritizedLead | null {
  if (terminalStages.has(lead.stage)) return null;
  const next = nextPendingFollowUp(lead.followUps ?? []);
  const risk = detectLeadRisk(lead, now);
  let points = Math.max(0, Math.min(100, lead.score || 0));
  const reasons: string[] = [];
  if (lead.priority === "Hot") { points += 35; reasons.push("Hot lead"); }
  else if (lead.priority === "Warm") points += 15;
  if (next) {
    const overdueMinutes = (now.getTime() - new Date(next.dueAt).getTime()) / 60_000;
    if (overdueMinutes > 0) { points += 45 + Math.min(30, Math.floor(overdueMinutes / 60)); reasons.push(`Follow-up overdue ${formatDuration(overdueMinutes)}`); }
    else if (overdueMinutes > -180) { points += 25; reasons.push("Follow-up due soon"); }
  }
  if (risk === "FIRST_RESPONSE_OVERDUE") { points += 50; reasons.push("First response SLA overdue"); }
  if (risk === "SLA_RISK") { points += 35; reasons.push("High-value lead inactive"); }
  if (risk === "REVENUE_AT_RISK") { points += 40; reasons.push("Offer follow-up at risk"); }
  if (risk === "STUCK") { points += 30; reasons.push("Qualified lead has no next action"); }
  if (risk === "NO_NEXT_ACTION") reasons.push("No next action scheduled");
  if (lead.stage === "Proposal") points += 25;
  else if (lead.stage === "Qualified") points += 18;
  else if (lead.stage === "Contacted") points += 10;
  return { lead, points, reason: reasons.slice(0, 2).join(" · ") || "Continue active sales follow-up", recommendedAction: next?.type ?? (lead.stage === "Proposal" ? "Meeting" : "Call"), risk, dueAt: next?.dueAt };
}

export function rankNextBestActions(leads: Lead[], now = new Date()) {
  return leads.map((lead) => prioritizeLead(lead, now)).filter((item): item is PrioritizedLead => Boolean(item)).sort((a, b) => b.points - a.points || new Date(a.lead.createdAt).getTime() - new Date(b.lead.createdAt).getTime() || a.lead.id.localeCompare(b.lead.id));
}

export function taskBucket(followUp: LeadFollowUp, now = new Date()): "overdue" | "today" | "upcoming" | "done" {
  if (followUp.completed) return "done";
  const due = new Date(followUp.dueAt);
  if (due.getTime() < now.getTime()) return "overdue";
  if (due.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })) return "today";
  return "upcoming";
}

function hoursBetween(value: string, now: Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : Math.max(0, (now.getTime() - date.getTime()) / 3_600_000);
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}
