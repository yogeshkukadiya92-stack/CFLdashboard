import type { AttendanceEntry, AttendanceSession, Lead, RegistrationEntry } from "./types.ts";

export const attendanceStatuses = ["checked_in", "late", "joined_zoom", "completed", "absent"] as const;
export type AttendanceStatus = typeof attendanceStatuses[number];
export type AttendancePerson = { id: string; name: string; isActive?: boolean; salesPersonCode?: string };
export type AttendanceState = { leads: Lead[]; registrations: RegistrationEntry[]; attendanceEntries: AttendanceEntry[]; attendanceSessions: AttendanceSession[]; salesPeople: AttendancePerson[] };
export const attendancePhone = (value: string) => String(value || "").replace(/\D/g, "").slice(-10);
export function ownsAttendanceLead(lead: Lead, personId: string, name: string) {
  return lead.assignedSalesPersonId ? lead.assignedSalesPersonId === personId : Boolean(name) && lead.assignedTo === name;
}
export function registrationMatchesSession(reg: RegistrationEntry, session: AttendanceSession) {
  if (reg.workshopId !== session.workshopId) return false;
  if (reg.attendanceSessionId) return reg.attendanceSessionId === session.id;
  if (session.introductionSessionId) return reg.introductionSessionId === session.introductionSessionId && (!session.batchId || reg.batchId === session.batchId);
  if (reg.introductionSessionId) return false;
  return session.batchId ? reg.batchId === session.batchId : !session.batch || reg.batch === session.batch;
}
export function workshopAttendanceRows(state: AttendanceState, leads: Lead[]) {
  const registrationsByPhone = new Map<string, RegistrationEntry[]>();
  for (const registration of state.registrations) {
    const key = attendancePhone(registration.mobile);
    const rows = registrationsByPhone.get(key) || [];
    rows.push(registration); registrationsByPhone.set(key, rows);
  }
  const entriesBySessionPhone = new Map<string, AttendanceEntry[]>();
  for (const entry of state.attendanceEntries) {
    const key = `${entry.sessionId}:${attendancePhone(entry.mobile)}`;
    const rows = entriesBySessionPhone.get(key) || [];
    rows.push(entry); entriesBySessionPhone.set(key, rows);
  }
  return leads.flatMap(lead => {
    const mobile = attendancePhone(lead.mobile);
    if (mobile.length !== 10) return [];
    return state.attendanceSessions.flatMap(session => {
      const registration = (registrationsByPhone.get(mobile) || []).find(reg => registrationMatchesSession(reg, session));
      const entries = entriesBySessionPhone.get(`${session.id}:${mobile}`) || [];
      const entry = [...entries].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
      if (!registration && !entry) return [];
      return [{ leadId: lead.id, leadName: lead.name, mobile: lead.mobile, registrationId: registration?.id || "", sessionId: session.id, sessionTitle: session.title, sessionDate: session.sessionDate, workshopTitle: session.workshopName, introduction: Boolean(session.introductionSessionId), status: entry?.status || (entry ? "checked_in" : registration?.attendanceBySession?.[session.id]?.status || "not_marked"), registered: Boolean(registration), assignedSalesPersonId: lead.assignedSalesPersonId || "", assignedTo: lead.assignedTo || "", updatedAt: registration?.attendanceBySession?.[session.id]?.updatedAt || entry?.submittedAt || registration?.createdAt || "" }];
    });
  });
}
export function registerAttendanceLead(state: AttendanceState, lead: Lead, session: AttendanceSession, now: string, id: string) {
  const mobile = attendancePhone(lead.mobile);
  if (mobile.length !== 10) throw new Error("Lead needs a valid mobile number.");
  const existing = state.registrations.find(reg => attendancePhone(reg.mobile) === mobile && registrationMatchesSession(reg, session));
  if (existing) return existing;
  const registration: RegistrationEntry = { id, workshopId: session.workshopId, workshopSlug: session.workshopSlug, workshopTitle: session.workshopName, fullName: lead.name, mobile, email: lead.email || "", city: lead.city || "", paymentMode: "Full", amountPaid: 0, amountDue: 0, status: "Due", source: "manual", createdAt: now, batch: session.batch, batchId: session.batchId, introductionSessionId: session.introductionSessionId, attendanceSessionId: session.id, assignedSalesPersonId: lead.assignedSalesPersonId, assignedTo: lead.assignedTo, confirmationStatus: "pending", registrationStatus: "confirmed" };
  state.registrations = [registration, ...state.registrations];
  return registration;
}
export function updateWorkshopAttendance(state: AttendanceState, lead: Lead, session: AttendanceSession, status: AttendanceStatus, actor: string, now: string, id: string) {
  const registration = registerAttendanceLead(state, lead, session, now, `registration-${id}`);
  const matching = state.attendanceEntries.filter(entry => entry.sessionId === session.id && attendancePhone(entry.mobile) === attendancePhone(lead.mobile));
  const previous = matching[0];
  const previousStatus = previous ? previous.status || "checked_in" : registration.attendanceBySession?.[session.id]?.status || "not_marked";
  if (previousStatus === status) return;
  const updated: RegistrationEntry = { ...registration, attendanceBySession: { ...registration.attendanceBySession, [session.id]: { status, updatedAt: now, updatedBy: actor } }, attendanceHistory: [{ id, sessionId: session.id, status, previousStatus, updatedAt: now, updatedBy: actor, previousEntries: matching }, ...(registration.attendanceHistory || [])] };
  state.registrations = state.registrations.map(reg => reg.id === updated.id ? updated : reg);
  // Absent is a correction, not a check-in. Preserve previous responses in the audit.
  state.attendanceEntries = state.attendanceEntries.filter(entry => !matching.some(item => item.id === entry.id));
  const historyLabel = `${session.workshopName} · ${session.title} · ${session.sessionDate}`;
  const history = (lead.workshopsAttended || []).filter(value => value !== historyLabel);
  state.leads = state.leads.map(row => row.id === lead.id ? { ...row, workshopsAttended: status === "absent" ? history : [...history, historyLabel], updatedAt: now } : row);
  if (status !== "absent") state.attendanceEntries.push({ ...previous, id: previous?.id || `attendance-${id}`, sessionId: session.id, sessionSlug: session.slug, workshopId: session.workshopId, workshopName: session.workshopName, attendeeName: lead.name, mobile: attendancePhone(lead.mobile), email: lead.email, city: lead.city, submittedAt: previous?.submittedAt || now, checkInAt: previous?.checkInAt || now, status, batch: session.batch, batchId: session.batchId, introductionSessionId: session.introductionSessionId, source: "manual", joinedZoomAt: status === "joined_zoom" ? previous?.joinedZoomAt || now : previous?.joinedZoomAt, leftZoomAt: status === "completed" ? previous?.leftZoomAt || now : previous?.leftZoomAt });
}
export function assignAttendanceLead(state: AttendanceState, lead: Lead, personId: string, actor: string, now: string, id: string) {
  const person = state.salesPeople.find(person => person.id === personId && person.isActive !== false);
  if (!person) throw new Error("Select an active salesperson.");
  const previousId = lead.assignedSalesPersonId || state.salesPeople.find(item => item.name === lead.assignedTo)?.id;
  const previousSalesPersonIds = [...new Set([...(lead.previousSalesPersonIds || []), ...(previousId && previousId !== person.id ? [previousId] : [])])];
  const updated = { ...lead, previousSalesPersonIds, assignedSalesPersonId: person.id, assignedTo: person.name, assignedSalesPersonCode: person.salesPersonCode, updatedAt: now, activities: [{ id, type: "assignment" as const, message: `${actor} assigned workshop follow-up to ${person.name}.`, createdAt: now }, ...(lead.activities || [])] };
  state.leads = state.leads.map(row => row.id === lead.id ? updated : row);
  state.registrations = state.registrations.map(reg => attendancePhone(reg.mobile) === attendancePhone(lead.mobile) ? { ...reg, assignedSalesPersonId: person.id, assignedTo: person.name } : reg);
}
