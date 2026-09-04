import type { AttendanceEntry, AttendanceSession, RegistrationEntry } from "./types.ts";

export type AttendanceAutomationOverview = {
  counts: { checkedIn: number; late: number; completed: number; promoted: number; noShowRisk: number };
  upcomingSessions: number;
  activity: Array<{ id: string; attendeeName: string; mobile: string; status: string; sessionTitle: string; workshopName: string; createdAt: string }>;
};

function sessionStart(session: AttendanceSession) {
  const date = String(session.sessionDate || "").slice(0, 10);
  const time = /^\d{2}:\d{2}/.test(String(session.startTime || "")) ? String(session.startTime).slice(0, 5) : "00:00";
  const value = new Date(`${date}T${time}:00+05:30`).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function getAttendanceAutomationOverview(input: {
  entries: AttendanceEntry[];
  sessions: AttendanceSession[];
  registrations: RegistrationEntry[];
  now?: number;
}): AttendanceAutomationOverview {
  const now = input.now ?? Date.now();
  const sessionById = new Map(input.sessions.map((session) => [session.id, session]));
  const attendedMobiles = new Set(input.entries.map((entry) => entry.mobile.replace(/\D/g, "").slice(-10)));
  const recentCutoff = now - 24 * 60 * 60 * 1000;
  const noShowRisk = input.registrations.filter((registration) => {
    if (registration.registrationStatus === "waiting") return false;
    const created = new Date(registration.createdAt).getTime();
    return created >= recentCutoff && !attendedMobiles.has(registration.mobile.replace(/\D/g, "").slice(-10));
  }).length;
  const upcomingSessions = input.sessions.filter((session) => session.published !== false && sessionStart(session) >= now).length;
  const counts = input.entries.reduce((result, entry) => {
    if (entry.status === "late") result.late += 1;
    else result.checkedIn += 1;
    if (entry.status === "completed") result.completed += 1;
    return result;
  }, { checkedIn: 0, late: 0, completed: 0, promoted: input.registrations.filter((registration) => registration.confirmationSource === "attendance").length, noShowRisk });
  const activity = [...input.entries]
    .sort((first, second) => new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime())
    .slice(0, 20)
    .map((entry) => ({
      id: entry.id,
      attendeeName: entry.attendeeName,
      mobile: entry.mobile,
      status: entry.status || "checked_in",
      sessionTitle: sessionById.get(entry.sessionId)?.title || entry.sessionSlug,
      workshopName: entry.workshopName,
      createdAt: entry.submittedAt
    }));
  return { counts, upcomingSessions, activity };
}
