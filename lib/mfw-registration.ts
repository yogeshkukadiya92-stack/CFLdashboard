import type { RegistrationEntry } from "@/lib/types";

type MfwWorkshop = { id: string; title: string };
type MfwCustomerResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id?: string;
    workshopAssigned?: boolean;
    participant?: { id?: string; eventId?: string } | null;
  };
};

function config() {
  const baseUrl = String(process.env.MFW_API_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = String(process.env.MFW_INTEGRATION_API_KEY || "").trim();
  if (!baseUrl || !apiKey) throw new Error("MFW integration is not configured. Add MFW_API_BASE_URL and MFW_INTEGRATION_API_KEY.");
  return { apiKey, baseUrl };
}

function workshopMap() {
  try {
    return JSON.parse(process.env.MFW_WORKSHOP_MAP || "{}") as Record<string, string>;
  } catch {
    throw new Error("MFW_WORKSHOP_MAP must be valid JSON.");
  }
}

async function resolveWorkshopEventId(registration: RegistrationEntry) {
  const mapped = workshopMap()[registration.workshopId];
  if (mapped) return mapped;
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}/integrations/v1/workshops`, {
    cache: "no-store",
    headers: { "x-mfw-api-key": apiKey }
  });
  const result = await response.json().catch(() => ({})) as { data?: MfwWorkshop[]; message?: string };
  if (!response.ok) throw new Error(result.message || "Could not load MFW workshops.");
  const title = registration.workshopTitle.trim().toLocaleLowerCase();
  const matches = (result.data || []).filter((workshop) => workshop.title.trim().toLocaleLowerCase() === title);
  if (matches.length !== 1) {
    throw new Error(`Map CFL workshop '${registration.workshopTitle}' to its MFW workshop ID in MFW_WORKSHOP_MAP.`);
  }
  return matches[0].id;
}

export async function syncConfirmedRegistrationToMfw(registration: RegistrationEntry) {
  if (!registration.mobile.trim()) throw new Error("Mobile number is required before confirming this registration.");
  const workshopEventId = await resolveWorkshopEventId(registration);
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}/integrations/v1/customers`, {
    body: JSON.stringify({
      email: registration.email || undefined,
      mobile: registration.mobile,
      name: registration.fullName,
      notes: `Confirmed in CFL dashboard for ${registration.workshopTitle}`,
      participantStatus: "ACTIVE",
      sourceRegistrationId: registration.id,
      workshopEventId
    }),
    headers: { "Content-Type": "application/json", "x-mfw-api-key": apiKey },
    method: "POST"
  });
  const result = await response.json().catch(() => ({})) as MfwCustomerResponse;
  const participant = result.data?.participant;
  if (!response.ok || !result.data?.workshopAssigned || participant?.eventId !== workshopEventId) {
    throw new Error(result.message || "MFW user was not assigned to the selected workshop.");
  }
  return {
    mfwParticipantId: participant.id,
    mfwSyncStatus: "synced" as const,
    mfwSyncedAt: new Date().toISOString(),
    mfwUserId: result.data.id,
    mfwWorkshopEventId: workshopEventId
  };
}
