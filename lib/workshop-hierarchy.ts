import type { AttendanceEntry, RegistrationEntry, WorkshopBatch } from "@/lib/types";

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function mobileDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
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
