import type { AttendanceEntry, RegistrationEntry } from "./types.ts";

type CsvExportOptions = {
  attendanceEntries: AttendanceEntry[];
  registrations: RegistrationEntry[];
  sessionIds: string[];
  workshopId: string;
  include: string;
  redactSensitive?: boolean;
};

function mobileKey(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function safeCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildAttendanceRegistrationCsv(options: CsvExportOptions) {
  if (!options.sessionIds.length) throw new Error("Select at least one attendance form before downloading CSV.");
  if (!options.workshopId) throw new Error("Select a workshop in the registration match node before downloading CSV.");

  const registrationsByMobile = new Map(options.registrations
    .filter((entry) => entry.workshopId === options.workshopId)
    .map((entry) => [mobileKey(entry.mobile), entry]));
  const selectedSessions = new Set(options.sessionIds);
  const matched = options.attendanceEntries
    .filter((entry) => selectedSessions.has(entry.sessionId))
    .map((entry) => ({ attendance: entry, registration: registrationsByMobile.get(mobileKey(entry.mobile)) }));
  const include = options.include.toLowerCase();
  const rows = matched.filter(({ registration }) => include.includes("not registered only") ? !registration : include.includes("registered only") ? Boolean(registration) : true);
  const headers = ["Attendance Form", "Name", "Mobile", "Email", "City", "Attendance Status", "Registration Status", "Registration ID", "Submitted At"];
  const lines = rows.map(({ attendance, registration }) => [
    attendance.sessionSlug || attendance.sessionId,
    attendance.attendeeName,
    options.redactSensitive ? "Hidden" : attendance.mobile,
    options.redactSensitive ? "Hidden" : attendance.email || "",
    attendance.city || "",
    attendance.status || "checked_in",
    registration ? "Registered" : "Not registered",
    registration?.id || "",
    attendance.submittedAt
  ].map(safeCell).join(","));
  return { content: `\uFEFF${[headers.map(safeCell).join(","), ...lines].join("\r\n")}`, rowCount: rows.length };
}
