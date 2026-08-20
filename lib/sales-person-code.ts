export function salesPersonCodeFromId(id: string) {
  const compact = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `SP-${compact.slice(-8).padStart(8, "0")}`;
}

export function normalizeSalesPersonCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function findSalesPersonByCode<T extends { id: string; salesPersonCode?: string }>(people: T[], code: unknown) {
  const normalized = normalizeSalesPersonCode(code);
  if (!normalized) return undefined;
  return people.find((person) => normalizeSalesPersonCode(person.salesPersonCode || salesPersonCodeFromId(person.id)) === normalized);
}
