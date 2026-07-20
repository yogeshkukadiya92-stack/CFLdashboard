import type { Lead, LeadActivity, LeadFollowUp, LeadPriority, LeadStage } from "@/lib/types";

type SalesPersonLike = {
  generalAssign?: string;
  id?: string;
  isActive?: boolean;
  name?: string;
};

type RegistrationLeadInput = {
  city?: unknown;
  createdAt?: unknown;
  email?: unknown;
  fullName?: unknown;
  mobile?: unknown;
  source?: unknown;
  workshopTitle?: unknown;
};

export function normalizeLeadMobile(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

export function createLeadId() {
  return `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLeadActivity(type: LeadActivity["type"], message: string, createdBy = "Admin", createdAt = new Date().toISOString()): LeadActivity {
  return {
    createdAt,
    createdBy,
    id: `activity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    type
  };
}

export function normalizeLead(value: unknown): Lead {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<Lead> : {};
  const legacy = input as Partial<Lead> & {
    contactLogs?: Array<{ createdAt?: string; id?: string; method?: string; notes?: string }>;
    notes?: string | string[];
    status?: string;
    workshopLinks?: Array<{ status?: string; workshopName?: string }>;
  };
  const createdAt = validIso(input.createdAt) ?? new Date().toISOString();
  const stage = isLeadStage(input.stage) ? input.stage : legacyStage(legacy.status);
  const legacyActivities = (legacy.contactLogs ?? []).map((log) => ({
    createdAt: validIso(log.createdAt) ?? createdAt,
    createdBy: "Admin",
    id: String(log.id ?? createLeadId()),
    message: `${log.method || "Contact"}: ${log.notes || "Contact recorded."}`,
    type: log.method === "WhatsApp" ? "whatsapp" as const : log.method === "Call" ? "call" as const : "note" as const
  }));
  const activities = Array.isArray(input.activities) ? input.activities.filter(isLeadActivity) : legacyActivities;
  const followUps = Array.isArray(input.followUps) ? input.followUps.filter(isLeadFollowUp) : [];
  const legacyInterest = legacy.workshopLinks?.[0]?.workshopName ?? "";

  return {
    assignedTo: String(input.assignedTo ?? ""),
    activities,
    bestTime: String(input.bestTime ?? ""),
    callHistory: stringArray(input.callHistory),
    certificates: stringArray(input.certificates),
    city: String(input.city ?? ""),
    country: String(input.country ?? "India"),
    createdAt,
    email: String(input.email ?? ""),
    familyAccounts: stringArray(input.familyAccounts),
    followUps,
    id: String(input.id ?? createLeadId()),
    interest: String(input.interest ?? legacyInterest),
    lastActivityAt: validIso(input.lastActivityAt) ?? activities[0]?.createdAt ?? createdAt,
    lostReason: String(input.lostReason ?? ""),
    mobile: normalizeLeadMobile(input.mobile),
    name: String(input.name ?? "Unnamed Lead"),
    nextFollowUp: String(input.nextFollowUp ?? nextPendingFollowUp(followUps)?.dueAt ?? ""),
    notes: stringArray(legacy.notes),
    paymentHistory: stringArray(input.paymentHistory),
    priority: isLeadPriority(input.priority) ? input.priority : "Warm",
    revenuePotential: Number(input.revenuePotential ?? 0) || 0,
    score: Number(input.score ?? 50) || 0,
    source: String(input.source ?? "Manual"),
    sourceDetails: stringArray(input.sourceDetails),
    stage,
    state: String(input.state ?? ""),
    tags: stringArray(input.tags),
    updatedAt: validIso(input.updatedAt) ?? createdAt,
    whatsappHistory: stringArray(input.whatsappHistory),
    workshopsAttended: stringArray(input.workshopsAttended),
    convertedClientId: input.convertedClientId ? String(input.convertedClientId) : undefined
  };
}

export function upsertLeadFromRegistration(
  currentLeads: unknown[],
  registration: RegistrationLeadInput,
  salesPeople: unknown[] = []
) {
  const leads = currentLeads.map(normalizeLead);
  const mobile = normalizeLeadMobile(registration.mobile);
  if (mobile.length !== 10) return leads;

  const now = validIso(registration.createdAt) ?? new Date().toISOString();
  const workshop = String(registration.workshopTitle ?? "Workshop").trim();
  const source = registration.source === "landing_page" ? "Landing Page" : registration.source === "manual" ? "Manual" : "Registration Link";
  const sourceDetail = `${source}: ${workshop}`;
  const existingIndex = leads.findIndex((lead) => normalizeLeadMobile(lead.mobile) === mobile);

  if (existingIndex >= 0) {
    const existing = leads[existingIndex];
    const activity = createLeadActivity("created", `New ${source.toLowerCase()} response received for ${workshop}.`, "System", now);
    leads[existingIndex] = {
      ...existing,
      activities: [activity, ...(existing.activities ?? [])].slice(0, 300),
      city: existing.city || String(registration.city ?? ""),
      email: existing.email || String(registration.email ?? ""),
      interest: workshop || existing.interest,
      lastActivityAt: now,
      name: existing.name === "Unnamed Lead" ? String(registration.fullName ?? existing.name) : existing.name,
      sourceDetails: unique([sourceDetail, ...(existing.sourceDetails ?? [])]),
      updatedAt: now
    };
    return leads;
  }

  const assignedTo = chooseAssignee(salesPeople, workshop, leads);
  const created = createLeadActivity("created", `Lead captured from ${source.toLowerCase()} for ${workshop}.`, "System", now);
  const assignment = assignedTo ? createLeadActivity("assignment", `Automatically assigned to ${assignedTo}.`, "System", now) : null;
  const lead = normalizeLead({
    activities: assignment ? [assignment, created] : [created],
    assignedTo,
    city: String(registration.city ?? ""),
    country: "India",
    createdAt: now,
    email: String(registration.email ?? ""),
    id: createLeadId(),
    interest: workshop,
    lastActivityAt: now,
    mobile,
    name: String(registration.fullName ?? "Unnamed Lead"),
    priority: "Warm",
    score: 60,
    source,
    sourceDetails: [sourceDetail],
    stage: "New Leads",
    updatedAt: now
  });
  return [lead, ...leads].slice(0, 10000);
}

export function nextPendingFollowUp(followUps: LeadFollowUp[]) {
  return [...followUps]
    .filter((item) => !item.completed && validIso(item.dueAt))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
}

function chooseAssignee(salesPeople: unknown[], workshop: string, leads: Lead[]) {
  const candidates = salesPeople
    .filter((value): value is SalesPersonLike => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    .filter((person) => person.isActive !== false && person.name)
    .filter((person) => !person.generalAssign || person.generalAssign.trim().toLowerCase() === workshop.toLowerCase());
  if (!candidates.length) return "";

  const counts = new Map<string, number>();
  leads.forEach((lead) => counts.set(lead.assignedTo, (counts.get(lead.assignedTo) ?? 0) + 1));
  return [...candidates].sort((a, b) => (counts.get(String(a.name)) ?? 0) - (counts.get(String(b.name)) ?? 0))[0]?.name ?? "";
}

function stringArray(value: unknown) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function validIso(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isLeadStage(value: unknown): value is LeadStage {
  return ["New Leads", "Contacted", "Qualified", "Proposal", "Won", "Lost"].includes(String(value));
}

function legacyStage(value: unknown): LeadStage {
  const status = String(value ?? "").toLowerCase();
  if (status === "contacted") return "Contacted";
  if (status === "interested" || status === "intro attended") return "Qualified";
  if (status === "registered") return "Won";
  if (status === "no show" || status === "dropped") return "Lost";
  return "New Leads";
}

function isLeadPriority(value: unknown): value is LeadPriority {
  return ["Hot", "Warm", "Cold"].includes(String(value));
}

function isLeadActivity(value: unknown): value is LeadActivity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && typeof (value as LeadActivity).message === "string";
}

function isLeadFollowUp(value: unknown): value is LeadFollowUp {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && typeof (value as LeadFollowUp).dueAt === "string";
}
