import type { Lead, RegistrationEntry } from "./types.ts";

const phone = (value: string) => value.replace(/\D/g, "").slice(-10);

export function introductionInvitations(state: { workshops: unknown[]; registrations: unknown[] }, leads: Lead[]) {
  const workshops = state.workshops as Array<{ id: string; batches?: Array<{ introductionSessions?: Array<{ id: string; title: string; sessionDate: string }> }> }>;
  return (state.registrations as RegistrationEntry[]).filter(reg => reg.introductionSessionId).flatMap(reg => {
    const mobile = phone(reg.mobile);
    if (mobile.length !== 10) return [];
    const session = workshops.find(workshop => workshop.id === reg.workshopId)?.batches?.flatMap(batch => batch.introductionSessions || []).find(session => session.id === reg.introductionSessionId);
    return leads.filter(lead => phone(lead.mobile) === mobile).map(lead => ({ registrationId: reg.id, leadId: lead.id, sessionId: `${reg.workshopId}:${reg.introductionSessionId}`, sessionTitle: session?.title || "Introduction session", sessionDate: session?.sessionDate || "", workshopTitle: reg.workshopTitle, status: reg.confirmationStatus || "pending" }));
  });
}
