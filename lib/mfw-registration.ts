import type { RegistrationEntry } from "@/lib/types";
import { getDbPool } from "@/lib/db";
import {
  mfwEnrollmentMatches,
  normalizeMfwWorkshops,
  selectMfwWorkshopMapping,
  type MfwWorkshopListResponse,
  type MfwWorkshopMapping
} from "@/lib/mfw-workshop-mapping";

export type MfwWorkshop = { id: string; title: string };
type MfwCustomerResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id?: string;
    workshopAssigned?: boolean;
    participant?: { id?: string; eventId?: string; uniqueId?: string } | null;
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
    return {};
  }
}

export async function listMfwWorkshops() {
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}/integrations/v1/workshops`, {
    cache: "no-store",
    headers: { "x-mfw-api-key": apiKey }
  });
  const result = await response.json().catch(() => ({})) as MfwWorkshopListResponse;
  const message = result && typeof result === "object" && !Array.isArray(result) && "message" in result
    ? String((result as { message?: unknown }).message ?? "")
    : "";
  if (!response.ok) throw new Error(message || "Could not load MFW workshops.");
  return normalizeMfwWorkshops(result);
}

async function resolveWorkshopMapping(registration: RegistrationEntry) {
  const result = await getDbPool()?.query(`SELECT w FROM app_state, jsonb_array_elements(workshops) w
    WHERE id = 1 AND (w->>'id' = $1 OR lower(w->>'name') = lower($2)) LIMIT 1`,
    [registration.workshopId, registration.workshopTitle]);
  const workshop = result?.rows[0]?.w as MfwWorkshopMapping | undefined;
  return selectMfwWorkshopMapping(workshop, workshopMap()[registration.workshopId]);
}

export async function syncConfirmedRegistrationToMfw(registration: RegistrationEntry) {
  let workshopEventId = "";
  try {
    const mapping = await resolveWorkshopMapping(registration);
    if (!mapping) return { mfwSyncError: undefined, mfwSyncStatus: "not_required" as const };
    workshopEventId = mapping.workshopEventId;
    if (!workshopEventId) throw new Error(`Select an MFW workshop for '${registration.workshopTitle}' before retrying enrollment.`);
    if (registration.mfwSyncStatus === "synced" && registration.mfwWorkshopEventId === workshopEventId) {
      return {
        mfwParticipantId: registration.mfwParticipantId,
        mfwSyncError: undefined,
        mfwSyncStatus: "synced" as const,
        mfwSyncedAt: registration.mfwSyncedAt,
        mfwUserId: registration.mfwUserId,
        mfwWorkshopEventId: workshopEventId
      };
    }
    if (!registration.mobile.trim()) throw new Error("Mobile number is required before confirming this registration.");
    if (!registration.registrationNumber) throw new Error("Registration number is required before syncing this registration to MFW.");
    const { apiKey, baseUrl } = config();
    const response = await fetch(`${baseUrl}/integrations/v1/customers`, {
      body: JSON.stringify({
        email: registration.email || undefined,
        mobile: registration.mobile,
        name: registration.fullName,
        notes: `Confirmed in CFL dashboard for ${registration.workshopTitle}`,
        participantStatus: "ACTIVE",
        registrationNumber: registration.registrationNumber,
        sourceRegistrationId: registration.id,
        workshopEventId
      }),
      headers: { "Content-Type": "application/json", "x-mfw-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
      method: "POST"
    });
    const result = await response.json().catch(() => ({})) as MfwCustomerResponse;
    const participant = result.data?.participant;
    if (!response.ok || !mfwEnrollmentMatches({
      participant,
      registrationNumber: registration.registrationNumber,
      workshopAssigned: result.data?.workshopAssigned,
      workshopEventId
    })) {
      throw new Error(result.message || "MFW user was not assigned to the selected workshop.");
    }
    return {
      mfwParticipantId: participant?.id,
      mfwSyncError: undefined,
      mfwSyncStatus: "synced" as const,
      mfwSyncedAt: new Date().toISOString(),
      mfwUserId: result.data?.id,
      mfwWorkshopEventId: workshopEventId
    };
  } catch (error) {
    return {
      mfwSyncError: error instanceof Error ? error.message.slice(0, 500) : "MFW enrollment failed.",
      mfwSyncStatus: "failed" as const,
      mfwWorkshopEventId: workshopEventId || undefined
    };
  }
}
