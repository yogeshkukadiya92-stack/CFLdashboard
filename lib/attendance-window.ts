import type { AttendanceSession } from "./types.ts";

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function sessionTimestamp(session: AttendanceSession, time?: string) {
  if (!session.sessionDate || !time) return null;
  const timestamp = new Date(`${session.sessionDate}T${time}:00+05:30`).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function attendanceWindow(session: AttendanceSession, now = Date.now()) {
  const start = sessionTimestamp(session, session.startTime);
  const end = sessionTimestamp(session, session.endTime);
  const openDays = cleanNumber(session.openDaysBefore, 0, 0, 30);
  const openMinutes = cleanNumber(session.openMinutesBefore, 60, 0, 1440);
  const lateMinutes = cleanNumber(session.lateAfterMinutes, 15, 0, 1440);
  const closeMinutes = cleanNumber(session.closeMinutesAfter, 120, 0, 2880);
  const openingLeadMinutes = openDays * 24 * 60 + openMinutes;

  if (start && now < start - openingLeadMinutes * 60_000) {
    return { allowed: false, reason: "Attendance has not opened yet.", late: false };
  }
  const closeAt = end ?? (start ? start + 4 * 60 * 60_000 : null);
  if (closeAt && now > closeAt + closeMinutes * 60_000) {
    return { allowed: false, reason: "Attendance for this session is closed.", late: false };
  }
  return { allowed: true, reason: "", late: Boolean(start && now > start + lateMinutes * 60_000) };
}
