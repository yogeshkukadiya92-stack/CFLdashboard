import { createLeadActivity, normalizeLeadMobile, upsertLeadFromRegistration } from "./lead-utils.ts";
import { salesPersonCodeFromId } from "./sales-person-code.ts";
import type { Lead, RegistrationEntry } from "./types.ts";

export function assignRegistrationLeads(
  current: Lead[], registrations: RegistrationEntry[],
  person: { id: string; name: string; isActive?: boolean; salesPersonCode?: string },
  now = new Date().toISOString()
) {
  if (!person.id || !person.name || person.isActive === false) throw new Error("Please select an active sales person.");
  const leads = [...current];
  const assigned = new Set<string>();
  let created = 0;
  for (const registration of registrations) {
    const mobile = normalizeLeadMobile(registration.mobile);
    if (mobile.length !== 10) throw new Error(`Please correct the mobile number for ${registration.fullName} before assigning.`);
    if (assigned.has(mobile)) continue;
    const matches = leads.filter((lead) => normalizeLeadMobile(lead.mobile) === mobile);
    if (matches.length > 1) throw new Error(`Please resolve duplicate CRM leads for ${registration.fullName} before assigning.`);
    let lead = matches[0];
    if (!lead) {
      lead = upsertLeadFromRegistration([], registration)[0];
      leads.push(lead);
      created++;
    }
    const index = leads.findIndex((item) => item.id === lead.id);
    leads[index] = {
      ...lead,
      assignedSalesPersonId: person.id,
      assignedSalesPersonCode: person.salesPersonCode || salesPersonCodeFromId(person.id),
      assignedTo: person.name,
      updatedAt: now,
      lastActivityAt: now,
      activities: [createLeadActivity("assignment", `Assigned to ${person.name} from Workshop Responses (${registration.workshopTitle || registration.workshopId}).`, "Admin", now), ...(lead.activities ?? [])]
    };
    assigned.add(mobile);
  }
  return { leads, assigned: assigned.size, created };
}
