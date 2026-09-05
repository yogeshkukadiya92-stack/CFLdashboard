import type { AttendanceEntry, RegistrationEntry, WorkshopBatch } from "@/lib/types";
import type { AttendanceSession, BuilderForm } from "@/lib/types";

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
  incoming: Pick<RegistrationEntry, "mobile" | "workshopId">,
  sourceWorkshopIds: string[]
) {
  const mobile = mobileDigits(incoming.mobile);
  const allowedWorkshops = new Set(sourceWorkshopIds.filter((id) => id && id !== incoming.workshopId));
  if (mobile.length !== 10 || !allowedWorkshops.size) return undefined;

  const registrationSource = registrations
    .filter((entry) => allowedWorkshops.has(entry.workshopId)
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
    .filter((entry) => allowedWorkshops.has(entry.workshopId) && mobileDigits(entry.mobile) === mobile)
    .sort((first, second) => new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime())[0];
  if (!attendanceSource) return undefined;
  return {
    workshopId: attendanceSource.workshopId,
    workshopTitle: attendanceSource.workshopName
  };
}

export function shouldSendRepeaterToWaiting(form: Pick<BuilderForm, "repeaterWaitingMode"> | undefined) {
  return form?.repeaterWaitingMode !== false;
}

export function registrationMatchesBatch(registration: Pick<RegistrationEntry, "batch" | "batchId">, batch: Pick<WorkshopBatch, "id" | "name">) {
  if (registration.batchId) return registration.batchId === batch.id;
  return normalized(registration.batch) === normalized(batch.name);
}

export function isDuplicateWorkshopRegistration(
  existing: Pick<RegistrationEntry, "workshopId" | "mobile" | "batch" | "batchId" | "introductionSessionId">,
  incoming: Pick<RegistrationEntry, "workshopId" | "mobile" | "batch" | "batchId" | "introductionSessionId">
) {
  return existing.workshopId === incoming.workshopId
    && mobileDigits(existing.mobile) === mobileDigits(incoming.mobile);
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

export function attendanceCanConfirmWaitingRegistration(
  attendance: Pick<AttendanceEntry, "mobile" | "sessionId" | "workshopId">,
  registration: Pick<RegistrationEntry, "mobile" | "workshopId">,
  form: Pick<BuilderForm, "requireAttendanceForConfirmation" | "requiredAttendanceSessionId"> | undefined,
  session: Pick<AttendanceSession, "id" | "workshopId" | "published"> | undefined
) {
  if (!form?.requireAttendanceForConfirmation) return false;
  if (mobileDigits(attendance.mobile) !== mobileDigits(registration.mobile)) return false;
  const exactRequiredAttendance = Boolean(form.requiredAttendanceSessionId) && form.requiredAttendanceSessionId === attendance.sessionId;
  const sameWorkshopIntroAttendance = attendance.workshopId === registration.workshopId
    && session?.id === attendance.sessionId
    && session.workshopId === registration.workshopId
    && session.published !== false;
  return exactRequiredAttendance || sameWorkshopIntroAttendance;
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
