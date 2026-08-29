export type MfwWorkshopMapping = {
  mfwEnrollmentEnabled?: boolean;
  mfwWorkshopEventId?: string;
  mfwWorkshopTitle?: string;
};

export type MfwWorkshopPayload = {
  _id?: unknown;
  eventId?: unknown;
  eventName?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
  workshopName?: unknown;
};

export type MfwWorkshopListResponse = {
  data?: MfwWorkshopPayload[] | { events?: MfwWorkshopPayload[]; workshops?: MfwWorkshopPayload[] };
  events?: MfwWorkshopPayload[];
  message?: string;
  workshops?: MfwWorkshopPayload[];
};

export function normalizeMfwWorkshops(result: MfwWorkshopListResponse) {
  const workshops = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.data?.workshops)
      ? result.data.workshops
      : Array.isArray(result.data?.events)
        ? result.data.events
        : Array.isArray(result.workshops)
          ? result.workshops
          : Array.isArray(result.events)
            ? result.events
            : [];
  return workshops
    .map((workshop) => ({
      id: String(workshop.id ?? workshop.eventId ?? workshop._id ?? "").trim(),
      title: String(workshop.title ?? workshop.name ?? workshop.eventName ?? workshop.workshopName ?? "").trim()
    }))
    .filter((workshop) => workshop.id && workshop.title);
}

export function selectMfwWorkshopMapping(workshop: MfwWorkshopMapping | undefined, legacyMappedId?: string) {
  const workshopEventId = String(workshop?.mfwWorkshopEventId ?? "").trim();
  if (workshop?.mfwEnrollmentEnabled === true) {
    return { title: String(workshop.mfwWorkshopTitle ?? "").trim(), workshopEventId };
  }
  const legacyId = String(legacyMappedId ?? "").trim();
  return legacyId ? { title: "", workshopEventId: legacyId } : null;
}
