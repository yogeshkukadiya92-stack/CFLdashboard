export type MfwWorkshopMapping = {
  mfwEnrollmentEnabled?: boolean;
  mfwWorkshopEventId?: string;
  mfwWorkshopTitle?: string;
};

export function selectMfwWorkshopMapping(workshop: MfwWorkshopMapping | undefined, legacyMappedId?: string) {
  const workshopEventId = String(workshop?.mfwWorkshopEventId ?? "").trim();
  if (workshop?.mfwEnrollmentEnabled === true) {
    return { title: String(workshop.mfwWorkshopTitle ?? "").trim(), workshopEventId };
  }
  const legacyId = String(legacyMappedId ?? "").trim();
  return legacyId ? { title: "", workshopEventId: legacyId } : null;
}
