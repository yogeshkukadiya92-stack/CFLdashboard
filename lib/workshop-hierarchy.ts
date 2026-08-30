import type { AttendanceEntry, RegistrationEntry, WorkshopBatch } from "@/lib/types";

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function mobileDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function isQualifyingPastRegistration(registration: RegistrationEntry) {
  return registration.registrationStatus === "confirmed"
    || registration.confirmationStatus === "confirmed"
    || registration.status === "Paid";
}

export function findRepeaterSource(
  registrations: RegistrationEntry[],
  attendanceEntries: AttendanceEntry[],
  incoming: Pick<RegistrationEntry, "mobile" | "workshopId">
) {
  const mobile = mobileDigits(incoming.mobile);
  if (mobile.length !== 10) return undefined;

  const registrationSource = registrations
    .filter((entry) => entry.workshopId !== incoming.workshopId
      && mobileDigits(entry.mobile) === mobile
      && isQualifyingPastRegistration(entry))
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())[0];
  if (registrationSource) {
    return {
      registrationId: registrationSource.id,
      workshopId: registrationSource.workshopId,
      workshopTitle: registrationSource.workshopTitle
    };
  }

  const attendanceSource = attendanceEntries
    .filter((entry) => entry.workshopId !== incoming.workshopId && mobileDigits(entry.mobile) === mobile)
    .sort((first, second) => new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime())[0];
  if (!attendanceSource) return undefined;
  return {
    workshopId: attendanceSource.workshopId,
    workshopTitle: attendanceSource.workshopName
  };
}

export function registrationMatchesBatch(registration: Pick<RegistrationEntry, "batch" | "batchId">, batch: Pick<WorkshopBatch, "id" | "name">) {
  if (registration.batchId) return registration.batchId === batch.id;
  return normalized(registration.batch) === normalized(batch.name);
}

export function isDuplicateWorkshopRegistration(
  existing: Pick<RegistrationEntry, "workshopId" | "mobile" | "batch" | "batchId" | "introductionSessionId">,
  incoming: Pick<RegistrationEntry, "workshopId" | "mobile" | "batch" | "batchId" | "introductionSessionId">
) {
  if (existing.workshopId !== incoming.workshopId || mobileDigits(existing.mobile) !== mobileDigits(incoming.mobile)) return false;
  const sameBatch = existing.batchId || incoming.batchId
    ? Boolean(existing.batchId && incoming.batchId && existing.batchId === incoming.batchId)
    : normalized(existing.batch) === normalized(incoming.batch);
  return sameBatch && normalized(existing.introductionSessionId) === normalized(incoming.introductionSessionId);
}

export function attendanceMatchesFinalRegistration(
  attendance: Pick<AttendanceEntry, "sessionId" | "mobile">,
  registration: Pick<RegistrationEntry, "mobile">,
  requiredSessionId: string
) {
  return Boolean(requiredSessionId)
    && attendance.sessionId === requiredSessionId
    && mobileDigits(attendance.mobile) === mobileDigits(registration.mobile);
}

export function shouldAutoConfirmFromAttendance(registration: {
  attendanceMatched?: boolean;
  confirmationStatus?: string;
  registrationStatus?: string;
}) {
  return registration.attendanceMatched === true
    && registration.registrationStatus === "confirmed"
    && registration.confirmationStatus !== "confirmed";
}
