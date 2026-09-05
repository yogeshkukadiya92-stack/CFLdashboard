import { upsertLiveRegistration } from "@/lib/crm-db";
import { upsertLeadFromRegistration } from "@/lib/lead-utils";
import { sendRegistrationStatusNotifications } from "@/lib/registration-confirmation";
import { syncConfirmedRegistrationToMfw } from "@/lib/mfw-registration";
import { resolveWorkshopSalesPersonId, type WorkshopLeadAssignmentRule } from "@/lib/workshop-lead-assignment";
import { getActiveWorkflowAssignmentSettings } from "@/lib/workflow-db";
import { getDbPool } from "./db";
import type { BuilderForm, RegistrationEntry } from "./types";

export async function runRegistrationFollowup(registrationId: string) {
  const database = getDbPool()!;
  const result = await database.query(`SELECT payload FROM cfl_registration_records WHERE external_id = $1`, [registrationId]);
  const finalRegistration = result.rows[0]?.payload as RegistrationEntry | undefined;
  if (!finalRegistration) return;
  const settings = await database.query(`SELECT
    (SELECT f FROM jsonb_array_elements(forms) f WHERE f->>'workshopId' = $1
      ORDER BY (COALESCE(f->>'batch', '') = $2) DESC LIMIT 1) AS form,
    (SELECT w FROM jsonb_array_elements(workshops) w WHERE w->>'id' = $1 LIMIT 1) AS workshop
    FROM app_state WHERE id = 1`, [finalRegistration.workshopId, finalRegistration.batch]);
  const form = settings.rows[0]?.form as Partial<BuilderForm>;
  const linkedWorkshop = settings.rows[0]?.workshop as { assignedSalesPersonId?: unknown; leadAssignmentRules?: WorkshopLeadAssignmentRule[]; transferLeadToCrm?: unknown } | undefined;
  async function persistPatch(updated: RegistrationEntry) {
    const patch = Object.fromEntries(Object.entries(updated).filter(([key]) =>
      key.startsWith("mfw") || key.startsWith("confirmationWhatsapp") || key.startsWith("waitingWhatsapp") || key.startsWith("referrerWaitingWhatsapp")));
    await database.query(`UPDATE cfl_registration_records SET payload = payload || $2::jsonb, updated_at = NOW() WHERE external_id = $1`, [registrationId, JSON.stringify(patch)]);
  }

  await upsertLiveRegistration(finalRegistration as unknown as Record<string, unknown>);
  if (linkedWorkshop?.transferLeadToCrm === true) {
    const workflowAssignment = await getActiveWorkflowAssignmentSettings(finalRegistration.workshopId).catch(() => null);
    const crmClient = await database.connect();
    try {
      await crmClient.query("BEGIN");
      const crmResult = await crmClient.query(`SELECT leads, sales_people FROM app_state WHERE id = 1 FOR UPDATE`);
      const crmState = crmResult.rows[0] ?? {};
      const assignmentRules = linkedWorkshop?.leadAssignmentRules?.length ? linkedWorkshop.leadAssignmentRules : workflowAssignment?.rules;
      const salesPeople = Array.isArray(crmState.sales_people) ? crmState.sales_people : [];
      const currentLeads = Array.isArray(crmState.leads) ? crmState.leads : [];
      const assignedSalesPersonId = resolveWorkshopSalesPersonId(
        finalRegistration,
        assignmentRules,
        linkedWorkshop?.assignedSalesPersonId || workflowAssignment?.defaultSalesPersonId,
        salesPeople as Array<Record<string, unknown>>,
        currentLeads as Array<Record<string, unknown>>,
        workflowAssignment?.fallbackStrategy ?? "unassigned"
      );
      const leads = linkedWorkshop?.transferLeadToCrm === true
        ? upsertLeadFromRegistration(
            currentLeads,
            finalRegistration,
            salesPeople,
            assignedSalesPersonId
          )
        : currentLeads;

      await crmClient.query(`UPDATE app_state SET leads = $1::jsonb, updated_at = NOW() WHERE id = 1`, [JSON.stringify(leads)]);
      await crmClient.query("COMMIT");
    } catch (error) {
      await crmClient.query("ROLLBACK");
      throw error;
    } finally {
      crmClient.release();
    }
  }
  let savedRegistration = finalRegistration;
  if (savedRegistration.registrationStatus === "confirmed" && savedRegistration.mfwSyncStatus !== "synced") {
    savedRegistration = { ...savedRegistration, ...(await syncConfirmedRegistrationToMfw(savedRegistration)) };
    await persistPatch(savedRegistration);
  }
  const notificationPatch = await sendRegistrationStatusNotifications(savedRegistration, form);
  if (Object.keys(notificationPatch).length) {
    savedRegistration = { ...savedRegistration, ...notificationPatch };
    await persistPatch(savedRegistration);
    await upsertLiveRegistration(savedRegistration as unknown as Record<string, unknown>);
  }

  if ((savedRegistration.registrationStatus === "confirmed" && savedRegistration.mfwSyncStatus === "failed")
    || Object.values(notificationPatch).includes("failed")) {
    throw new Error("Registration follow-up provider failed; retry scheduled");
  }
}
