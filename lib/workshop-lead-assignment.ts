export type LeadAssignmentStrategy = "fixed" | "least-active" | "round-robin" | "unassigned";

export type WorkshopLeadAssignmentRule = {
  id: string;
  enabled?: boolean;
  priority?: number;
  city?: string;
  state?: string;
  pincode?: string;
  source?: string;
  workshopId?: string;
  startDate?: string;
  endDate?: string;
  salesPersonId?: string;
  strategy?: LeadAssignmentStrategy;
  maxActiveLeads?: number;
};

export type RegistrationForAssignment = {
  id?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
  postalCode?: unknown;
  source?: unknown;
  workshopId?: unknown;
  workshopTitle?: unknown;
  createdAt?: unknown;
};

export type SalesPersonForAssignment = {
  id?: unknown;
  name?: unknown;
  isActive?: unknown;
  acceptingLeads?: unknown;
  activeLeadCount?: unknown;
  maxActiveLeads?: unknown;
};

export type LeadForAssignment = {
  assignedSalesPersonId?: unknown;
  assignedTo?: unknown;
  stage?: unknown;
};

export type LeadAssignmentDecision = {
  salesPersonId: string;
  salesPersonName: string;
  ruleId?: string;
  strategy: LeadAssignmentStrategy;
  reason: string;
  activeLeadCount: number;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("en-IN");
}

function normalizePincode(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-6);
}

function registrationDay(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function stableNumber(value: unknown) {
  const source = String(value ?? "");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  return hash;
}

function activeLeadCounts(leads: LeadForAssignment[], salesPeople: SalesPersonForAssignment[]) {
  const names = new Map(salesPeople.map((person) => [normalize(person.name), String(person.id ?? "")]));
  const counts = new Map<string, number>(salesPeople.map((person) => [String(person.id ?? ""), Math.max(0, Number(person.activeLeadCount ?? 0) || 0)]));
  for (const lead of leads) {
    if (["won", "lost"].includes(normalize(lead.stage))) continue;
    const id = String(lead.assignedSalesPersonId ?? "") || names.get(normalize(lead.assignedTo)) || "";
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function ruleMatches(registration: RegistrationForAssignment, rule: WorkshopLeadAssignmentRule) {
  if (rule.enabled === false) return false;
  const day = registrationDay(registration.createdAt);
  if (rule.city && normalize(rule.city) !== normalize(registration.city)) return false;
  if (rule.state && normalize(rule.state) !== normalize(registration.state)) return false;
  if (rule.pincode && normalizePincode(rule.pincode) !== normalizePincode(registration.pincode ?? registration.postalCode)) return false;
  if (rule.source && normalize(rule.source) !== normalize(registration.source)) return false;
  if (rule.workshopId && ![registration.workshopId, registration.workshopTitle].some((value) => normalize(value) === normalize(rule.workshopId))) return false;
  if (rule.startDate && day < rule.startDate) return false;
  if (rule.endDate && day > rule.endDate) return false;
  return true;
}

function eligiblePeople(salesPeople: SalesPersonForAssignment[], counts: Map<string, number>, maxActiveLeads?: number) {
  return salesPeople.filter((person) => {
    const id = String(person.id ?? "");
    if (!id || person.isActive === false || person.acceptingLeads === false) return false;
    const limit = Number(maxActiveLeads ?? person.maxActiveLeads ?? 0);
    return !Number.isFinite(limit) || limit <= 0 || (counts.get(id) ?? 0) < limit;
  });
}

function chooseByStrategy(
  strategy: LeadAssignmentStrategy,
  registration: RegistrationForAssignment,
  people: SalesPersonForAssignment[],
  counts: Map<string, number>
) {
  if (!people.length || strategy === "unassigned") return undefined;
  if (strategy === "least-active") {
    return [...people].sort((left, right) => {
      const load = (counts.get(String(left.id ?? "")) ?? 0) - (counts.get(String(right.id ?? "")) ?? 0);
      return load || normalize(left.name).localeCompare(normalize(right.name));
    })[0];
  }
  const ordered = [...people].sort((left, right) => String(left.id ?? "").localeCompare(String(right.id ?? "")));
  return ordered[stableNumber(registration.id ?? `${registrationDay(registration.createdAt)}:${registration.city}`) % ordered.length];
}

export function resolveSmartLeadAssignment(
  registration: RegistrationForAssignment,
  rules: WorkshopLeadAssignmentRule[] | undefined,
  salesPeople: SalesPersonForAssignment[] = [],
  leads: LeadForAssignment[] = [],
  defaultSalesPersonId?: unknown,
  fallbackStrategy: LeadAssignmentStrategy = "least-active"
): LeadAssignmentDecision {
  const counts = activeLeadCounts(leads, salesPeople);
  const orderedRules = (Array.isArray(rules) ? rules : [])
    .map((rule, index) => ({ rule, index }))
    .sort((left, right) => (left.rule.priority ?? left.index) - (right.rule.priority ?? right.index));

  for (const { rule } of orderedRules) {
    if (!ruleMatches(registration, rule)) continue;
    const eligible = eligiblePeople(salesPeople, counts, rule.maxActiveLeads);
    const strategy = rule.strategy ?? (rule.salesPersonId ? "fixed" : "least-active");
    const selected = rule.salesPersonId
      ? eligible.find((person) => String(person.id ?? "") === rule.salesPersonId)
      : chooseByStrategy(strategy, registration, eligible, counts);
    if (selected) {
      const id = String(selected.id ?? "");
      return {
        salesPersonId: id,
        salesPersonName: String(selected.name ?? ""),
        ruleId: rule.id,
        strategy,
        reason: `Matched priority rule ${rule.id}`,
        activeLeadCount: counts.get(id) ?? 0
      };
    }
  }

  const defaultId = String(defaultSalesPersonId ?? "");
  const available = eligiblePeople(salesPeople, counts);
  const defaultPerson = available.find((person) => String(person.id ?? "") === defaultId);
  const selected = defaultPerson ?? chooseByStrategy(fallbackStrategy, registration, available, counts);
  if (!selected) return { salesPersonId: "", salesPersonName: "", strategy: "unassigned", reason: "No available sales person matched", activeLeadCount: 0 };
  const id = String(selected.id ?? "");
  return {
    salesPersonId: id,
    salesPersonName: String(selected.name ?? ""),
    strategy: defaultPerson ? "fixed" : fallbackStrategy,
    reason: defaultPerson ? "Used default sales person" : `Used ${fallbackStrategy} fallback`,
    activeLeadCount: counts.get(id) ?? 0
  };
}

export function resolveWorkshopSalesPersonId(
  registration: RegistrationForAssignment,
  rules: WorkshopLeadAssignmentRule[] | undefined,
  defaultSalesPersonId?: unknown,
  salesPeople: SalesPersonForAssignment[] = [],
  leads: LeadForAssignment[] = [],
  fallbackStrategy: LeadAssignmentStrategy = "unassigned"
) {
  if (!salesPeople.length) {
    const matched = (Array.isArray(rules) ? rules : []).find((rule) => rule.salesPersonId && ruleMatches(registration, rule));
    return matched?.salesPersonId || String(defaultSalesPersonId ?? "");
  }
  return resolveSmartLeadAssignment(registration, rules, salesPeople, leads, defaultSalesPersonId, fallbackStrategy).salesPersonId;
}
