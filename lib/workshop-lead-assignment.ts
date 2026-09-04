export type WorkshopLeadAssignmentRule = {
  id: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  salesPersonId: string;
};

type RegistrationForAssignment = {
  city?: unknown;
  createdAt?: unknown;
};

function normalizedCity(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("en-IN");
}

function registrationDay(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

export function resolveWorkshopSalesPersonId(
  registration: RegistrationForAssignment,
  rules: WorkshopLeadAssignmentRule[] | undefined,
  defaultSalesPersonId?: unknown
) {
  const city = normalizedCity(registration.city);
  const day = registrationDay(registration.createdAt);
  const matched = (Array.isArray(rules) ? rules : []).find((rule) => {
    if (!rule?.salesPersonId) return false;
    if (rule.city && normalizedCity(rule.city) !== city) return false;
    if (rule.startDate && day < rule.startDate) return false;
    if (rule.endDate && day > rule.endDate) return false;
    return true;
  });
  return matched?.salesPersonId || String(defaultSalesPersonId ?? "");
}
