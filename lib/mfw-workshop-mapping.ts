export type MfwWorkshopMapping = {
  mfwEnrollmentEnabled?: boolean;
  mfwWorkshopEventId?: string;
  mfwWorkshopTitle?: string;
};

export type MfwWorkshopPayload = {
  _id?: unknown;
  eventId?: unknown;
  event_id?: unknown;
  eventName?: unknown;
  event_name?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
  workshopEventId?: unknown;
  workshop_event_id?: unknown;
  workshopName?: unknown;
  workshop_name?: unknown;
};

export type MfwWorkshopListResponse = unknown;

function findWorkshopArrays(value: unknown, depth = 0): MfwWorkshopPayload[][] {
  if (depth > 4) return [];
  if (Array.isArray(value)) return [value.filter((item): item is MfwWorkshopPayload => Boolean(item) && typeof item === "object" && !Array.isArray(item))];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const preferredKeys = ["data", "workshops", "events", "items", "results", "records"];
  return preferredKeys.flatMap((key) => key in record ? findWorkshopArrays(record[key], depth + 1) : []);
}

export function normalizeMfwWorkshops(result: MfwWorkshopListResponse) {
  return findWorkshopArrays(result)
    .flat()
    .map((workshop) => ({
      id: String(workshop.id ?? workshop.eventId ?? workshop.event_id ?? workshop.workshopEventId ?? workshop.workshop_event_id ?? workshop._id ?? "").trim(),
      title: String(workshop.title ?? workshop.name ?? workshop.eventName ?? workshop.event_name ?? workshop.workshopName ?? workshop.workshop_name ?? "").trim()
    }))
    .filter((workshop, index, all) => workshop.id && workshop.title && all.findIndex((candidate) => candidate.id === workshop.id) === index);
}

export function selectMfwWorkshopMapping(workshop: MfwWorkshopMapping | undefined, legacyMappedId?: string) {
  const workshopEventId = String(workshop?.mfwWorkshopEventId ?? "").trim();
  if (workshop?.mfwEnrollmentEnabled === true) {
    return { title: String(workshop.mfwWorkshopTitle ?? "").trim(), workshopEventId };
  }
  const legacyId = String(legacyMappedId ?? "").trim();
  return legacyId ? { title: "", workshopEventId: legacyId } : null;
}
