import { getDbPool, ensureRegistrationRecordsTable } from "./db";
import { getActiveWorkflowAssignmentSettings } from "./workflow-db";
import { ensureRegistrationCrmAssignment, type RegistrationAssignmentSettings } from "./registration-crm-assignment";
import type { Lead, RegistrationEntry } from "./types";
import type { SalesPersonForAssignment } from "./workshop-lead-assignment";

export async function assignRegistrationToCrm(registrationId: string) {
  const db = getDbPool();
  if (!db) throw new Error("Database unavailable for CRM assignment.");
  await ensureRegistrationRecordsTable();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Same lock order as manual assignment: state first, then registration.
    const state = (await client.query(`SELECT leads,sales_people,workshops FROM app_state WHERE id=1 FOR UPDATE`)).rows[0];
    if (!state) throw new Error("CRM state is unavailable.");
    const registration = (await client.query(`SELECT payload FROM cfl_registration_records WHERE external_id=$1 FOR UPDATE`, [registrationId])).rows[0]?.payload as RegistrationEntry | undefined;
    if (!registration) throw new Error("Registration unavailable for CRM assignment.");
    const workshop = state.workshops.find((item: { id: string }) => item.id === registration.workshopId);
    if (workshop?.transferLeadToCrm !== true) {
      await client.query("COMMIT");
      return { required: false, assigned: true };
    }
    const workflow = workshop.leadAssignmentRules?.length && (workshop.assignedSalesPersonIds?.length || workshop.assignedSalesPersonId)
      ? null : await getActiveWorkflowAssignmentSettings(registration.workshopId);
    const settings: RegistrationAssignmentSettings = {
      ...workshop,
      leadAssignmentRules: workshop.leadAssignmentRules?.length ? workshop.leadAssignmentRules : workflow?.rules,
      assignedSalesPersonId: workshop.assignedSalesPersonId || workflow?.defaultSalesPersonId
    };
    const result = ensureRegistrationCrmAssignment(state.leads as Lead[], registration,
      state.sales_people as SalesPersonForAssignment[], settings);
    if (result.leads !== state.leads) {
      await client.query(`UPDATE app_state SET leads=$1::jsonb,updated_at=NOW() WHERE id=1`, [JSON.stringify(result.leads)]);
    }
    await client.query(`UPDATE cfl_registration_records SET payload=payload || $2::jsonb,updated_at=NOW() WHERE external_id=$1`,
      [registrationId, JSON.stringify(result.receipt)]);
    await client.query("COMMIT");
    return { required: true, assigned: result.receipt.crmAssignmentStatus === "assigned", status: result.receipt.crmAssignmentStatus, reason: result.receipt.crmAssignmentReason };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const reason = error instanceof Error ? error.message.slice(0, 500) : "CRM transfer failed; retry scheduled.";
    await client.query(`UPDATE cfl_registration_records SET payload=payload || $2::jsonb,updated_at=NOW() WHERE external_id=$1`,
      [registrationId, JSON.stringify({ crmAssignmentStatus: "failed", crmAssignmentReason: reason, crmAssignmentCheckedAt: new Date().toISOString() })]).catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

let recovering = false;
let lastScan = 0;
export async function recoverMissingCrmAssignments(options: { force?: boolean; workshopId?: string } = {}) {
  const db = getDbPool();
  if (!db) throw new Error("Database unavailable for CRM recovery.");
  if (recovering || (!options.force && Date.now() - lastScan < 300_000)) return { busy: true, checked: 0, assigned: 0, pending: 0, failed: 0 };
  recovering = true;
  try {
    await ensureRegistrationRecordsTable();
    // A receipt alone is insufficient: check the actual CRM record as well.
    // The scan is bounded and drained in batches; no notification/MFW calls are
    // replayed when recovering an assignment.
    const candidates = await db.query(`WITH owners AS (
      SELECT l->>'id' AS id,l->>'assignedSalesPersonId' AS owner_id,l->>'assignedTo' AS owner_name,
        CASE WHEN length(digits)=12 AND left(digits,2)='91' THEN substring(digits FROM 3) ELSE digits END AS phone
      FROM app_state, LATERAL jsonb_array_elements(leads) l,
        LATERAL (SELECT regexp_replace(COALESCE(l->>'mobile',''),'[^0-9]','','g') AS digits) p WHERE app_state.id=1
    ) SELECT r.external_id FROM cfl_registration_records r
      WHERE ($1::text IS NULL OR r.workshop_id=$1)
      AND EXISTS (SELECT 1 FROM app_state s,LATERAL jsonb_array_elements(s.workshops) w
        WHERE s.id=1 AND w->>'id'=r.workshop_id AND w->>'transferLeadToCrm'='true')
      AND ($2::boolean OR COALESCE(r.payload->>'crmAssignmentCheckedAt','')='' OR r.payload->>'crmAssignmentCheckedAt' < to_char(NOW() AT TIME ZONE 'UTC' - interval '5 minutes','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      AND (COALESCE(r.payload->>'crmAssignmentStatus','') <> 'assigned' OR NOT EXISTS (
        SELECT 1 FROM owners o WHERE o.phone=regexp_replace(r.mobile_normalized,'[^0-9]','','g')
        AND o.id=r.payload->>'crmLeadId' AND (COALESCE(o.owner_id,'')<>'' OR COALESCE(o.owner_name,'')<>'')
        AND COALESCE(o.owner_id,'')=COALESCE(r.payload->>'crmSalesPersonId','')
        AND COALESCE(o.owner_name,'')=COALESCE(r.payload->>'crmSalesPersonName','')
      )) ORDER BY COALESCE(r.payload->>'crmAssignmentCheckedAt',''),r.external_id LIMIT 100`, [options.workshopId || null, options.force === true]);
    const summary = { busy: false, checked: candidates.rows.length, assigned: 0, pending: 0, failed: 0 };
    for (const row of candidates.rows) {
      try {
        const result = await assignRegistrationToCrm(row.external_id);
        if (result.assigned) summary.assigned++;
        else if (result.status === "failed") summary.failed++;
        else summary.pending++;
      }
      catch (error) { summary.failed++; console.error("CRM assignment recovery failed", row.external_id, error instanceof Error ? error.message : "Unknown error"); }
    }
    // Continue full batches on the next worker tick, with a fresh database scan.
    lastScan = candidates.rows.length < 100 ? Date.now() : 0;
    return summary;
  } catch (error) {
    lastScan = Date.now();
    console.error("CRM assignment reconciliation failed", error instanceof Error ? error.message : "Unknown error");
    throw error;
  } finally { recovering = false; }
}
