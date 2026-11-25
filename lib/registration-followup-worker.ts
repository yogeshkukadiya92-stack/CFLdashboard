import { completeMedicalBooking } from "./mfw-medical";
import { upsertLiveRegistration } from "@/lib/crm-db";
import { assignRegistrationToCrm } from "./registration-crm-recovery";
import { sendRegistrationStatusNotifications } from "@/lib/registration-confirmation";
import { syncConfirmedRegistrationToMfw } from "@/lib/mfw-registration";
import { type WorkshopLeadAssignmentRule } from "@/lib/workshop-lead-assignment";
import { getDbPool } from "./db";
import type { BuilderForm, RegistrationEntry } from "./types";

export async function runRegistrationFollowup(registrationId: string) {
  const database = getDbPool()!;
  const result = await database.query(`SELECT payload FROM cfl_registration_records WHERE external_id = $1`, [registrationId]);
  const finalRegistration = result.rows[0]?.payload as RegistrationEntry | undefined;
  if (!finalRegistration) return;
  const mfwSyncOnly = finalRegistration.mfwSyncOnly === true;
  const settings = await database.query(`SELECT
    (SELECT f FROM jsonb_array_elements(forms) f WHERE f->>'workshopId' = $1
      ORDER BY (COALESCE(f->>'batch', '') = $2) DESC LIMIT 1) AS form,
    (SELECT w FROM jsonb_array_elements(workshops) w WHERE w->>'id' = $1 LIMIT 1) AS workshop
    FROM app_state WHERE id = 1`, [finalRegistration.workshopId, finalRegistration.batch]);
  const form = settings.rows[0]?.form as Partial<BuilderForm>;
  const linkedWorkshop = settings.rows[0]?.workshop as { type?: string; assignedSalesPersonIds?: string[]; assignedSalesPersonId?: unknown; leadAssignmentRules?: WorkshopLeadAssignmentRule[]; transferLeadToCrm?: unknown } | undefined;
  async function persistPatch(updated: RegistrationEntry) {
    const patch = Object.fromEntries(Object.entries(updated).filter(([key]) =>
      key.startsWith("mfw") || key.startsWith("confirmationWhatsapp") || key.startsWith("waitingWhatsapp") || key.startsWith("referrerWaitingWhatsapp")));
    await database.query(`UPDATE cfl_registration_records SET payload = payload || $2::jsonb, updated_at = NOW() WHERE external_id = $1`, [registrationId, JSON.stringify(patch)]);
  }

  if (!mfwSyncOnly) await upsertLiveRegistration(finalRegistration as unknown as Record<string, unknown>);
  // CRM assignment has its own receipt and recovery loop. Keep provider
  // notifications progressing even when no salesperson is currently available.
  const crmAssignment = !mfwSyncOnly ? await assignRegistrationToCrm(registrationId) : undefined;
  let savedRegistration = finalRegistration;
  if (savedRegistration.registrationStatus === "confirmed" && savedRegistration.mfwSyncStatus !== "synced") {
    savedRegistration = { ...savedRegistration, ...(await syncConfirmedRegistrationToMfw(savedRegistration)) };
    if (mfwSyncOnly && savedRegistration.mfwSyncStatus !== "failed") savedRegistration.mfwSyncOnly = false;
    await persistPatch(savedRegistration);
  }
  const notificationPatch = mfwSyncOnly ? {} : await sendRegistrationStatusNotifications(savedRegistration, form, linkedWorkshop?.type);
  if (Object.keys(notificationPatch).length) {
    savedRegistration = { ...savedRegistration, ...notificationPatch };
    await persistPatch(savedRegistration);
    await upsertLiveRegistration(savedRegistration as unknown as Record<string, unknown>);
  }

  await completeMedicalBooking(savedRegistration);

  if (crmAssignment?.required && !crmAssignment.assigned) {
    throw new Error(crmAssignment.reason || "CRM assignment pending; retry scheduled");
  }
  if ((savedRegistration.registrationStatus === "confirmed" && savedRegistration.mfwSyncStatus === "failed")
    || Object.values(notificationPatch).includes("failed")) {
    throw new Error("Registration follow-up provider failed; retry scheduled");
  }
}
