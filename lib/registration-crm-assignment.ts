import { internationalPhone } from "./phone-number.ts";
import { normalizeLeadMobile, upsertLeadFromRegistration } from "./lead-utils.ts";
import { resolveSmartLeadAssignment, type WorkshopLeadAssignmentRule, type SalesPersonForAssignment } from "./workshop-lead-assignment.ts";
import type { Lead, RegistrationEntry } from "./types.ts";

export type RegistrationAssignmentSettings = {
  assignedSalesPersonIds?: string[];
  assignedSalesPersonId?: unknown;
  leadAssignmentRules?: WorkshopLeadAssignmentRule[];
};

// Pure assignment step shared by immediate processing and recovery. Retries
// retain an existing owner and never append another registration activity.
export function ensureRegistrationCrmAssignment(
  leads: Lead[], registration: RegistrationEntry,
  people: SalesPersonForAssignment[], settings: RegistrationAssignmentSettings,
  now = new Date().toISOString()
) {
  const receipt: Partial<RegistrationEntry> = {
    crmAssignmentCheckedAt: now, crmAssignmentStatus: "pending",
    crmAssignmentReason: "No available salesperson; automatic retry scheduled.",
    crmLeadId: "", crmSalesPersonId: "", crmSalesPersonName: ""
  };
  if (!internationalPhone(registration.mobile)) {
    return { leads, receipt: { ...receipt, crmAssignmentStatus: "failed" as const,
      crmAssignmentReason: "Invalid mobile number. Correct the registration phone number to retry." } };
  }
  const mobile = normalizeLeadMobile(registration.mobile);
  const matches = leads.filter(lead => normalizeLeadMobile(lead.mobile) === mobile);
  if (matches.length > 1) {
    return { leads, receipt: { ...receipt, crmAssignmentStatus: "failed" as const,
      crmAssignmentReason: "Duplicate CRM leads share this mobile number. Resolve duplicates to retry." } };
  }
  const existing = matches[0];
  if (existing?.assignedTo || existing?.assignedSalesPersonId) {
    return { leads: registration.crmLeadId === existing.id ? leads : upsertLeadFromRegistration(leads, registration), receipt: { ...receipt, crmAssignmentStatus: "assigned" as const,
      crmAssignmentReason: "Existing CRM owner retained.", crmLeadId: existing.id,
      crmSalesPersonId: existing.assignedSalesPersonId || "", crmSalesPersonName: existing.assignedTo || "" } };
  }
  const decision = resolveSmartLeadAssignment(registration, settings.leadAssignmentRules, people, leads,
    settings.assignedSalesPersonIds?.length ? settings.assignedSalesPersonIds : settings.assignedSalesPersonId,
    "least-active");
  // Keep one unassigned CRM record visible while waiting for an available owner.
  const next = existing && !decision.salesPersonId ? leads
    : upsertLeadFromRegistration(leads, registration, people, decision.salesPersonId);
  const lead = next.find(item => normalizeLeadMobile(item.mobile) === mobile);
  if (!lead) throw new Error("CRM lead was not persisted; retry required.");
  return { leads: next, receipt: { ...receipt, crmLeadId: lead.id,
    ...(lead.assignedTo ? { crmAssignmentStatus: "assigned" as const,
      crmAssignmentReason: decision.reason, crmSalesPersonId: lead.assignedSalesPersonId,
      crmSalesPersonName: lead.assignedTo } : {}) } };
}
