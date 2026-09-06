import { ensurePersistenceTable, ensureRegistrationRecordsTable, getDbPool, reserveRegistrationNumber, upsertRegistrationRecord } from "./db";
import type { AttendanceEntry, RegistrationEntry, WorkshopBatch } from "./types";
import type { WorkflowNode, Connection } from "./workflow-studio";
import type { WorkflowExecutionResult } from "./workflow-engine";
import { registrationMatchesBatch } from "./workshop-hierarchy";

/** Executes only connected, scope-matched attendance confirmation actions. */
export async function confirmWorkflowWaiting(input: { nodes: WorkflowNode[]; connections: Connection[]; attendance: AttendanceEntry; result: WorkflowExecutionResult; workflowId: string }) {
  const db = getDbPool();
  if (!db) throw new Error("Database unavailable for workflow confirmation.");
  await ensurePersistenceTable();
  await ensureRegistrationRecordsTable();
  const reachable = new Set(input.nodes.filter(node => node.kind === "attendance" && Boolean(node.config.event) && input.result.steps.some(step => step.nodeId === node.id && step.status === "success")).map(node => node.id));
  for (let i = 0; i < input.nodes.length; i++) for (const edge of input.connections) {
    const step = input.result.steps.find(item => item.nodeId === edge.to);
    if (reachable.has(edge.from) && step?.output && step.status !== "failed") reachable.add(edge.to);
  }
  let promoted = 0;
  for (const node of input.nodes.filter(node => reachable.has(node.id) && node.kind === "workshop" && (node.config.action === "Confirm registration" || node.title === "Confirm waiting registration"))) {
    const step = input.result.steps.find(item => item.nodeId === node.id)!;
    const client = await db.connect();
    try {
      const workshopId = String(node.config.workshopId || "");
      if (!workshopId) throw new Error("Select the target workshop for confirmation.");
      const mobile = input.attendance.mobile.replace(/\D/g, "").slice(-10);
      if (mobile.length !== 10) throw new Error("Attendance mobile is invalid.");
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`registration-workshop:${workshopId}`]);
      const state = (await client.query("SELECT workshops,forms FROM app_state WHERE id=1")).rows[0];
      const workshop = state?.workshops?.find((item: { id: string }) => item.id === workshopId);
      if (!workshop) throw new Error("Target workshop no longer exists.");
      const batchId = String(node.config.batchId || "");
      const batch = (workshop.batches || []).find((item: WorkshopBatch) => item.id === batchId) as WorkshopBatch | undefined;
      if (batchId && !batch) throw new Error("Selected batch no longer exists.");
      const records = (await client.query<{ payload: RegistrationEntry }>("SELECT payload FROM cfl_registration_records WHERE workshop_id=$1 FOR UPDATE", [workshopId])).rows.map(row => row.payload);
      const scoped = records.filter(record => !batch || registrationMatchesBatch(record, batch));
      const form = state.forms?.find((item: { workshopId: string }) => item.workshopId === workshopId);
      const capacity = Math.max(0, Number(batch?.capacity ?? form?.registrationCapacity ?? 0) || 0);
      let confirmed = scoped.filter(record => record.registrationStatus !== "waiting").length;
      const ids: string[] = [];
      for (const record of scoped.filter(record => record.registrationStatus === "waiting" && record.mobile.replace(/\D/g, "").slice(-10) === mobile)) {
        if (node.config.capacity !== "Allow overbooking" && capacity > 0 && confirmed >= capacity) continue;
        await upsertRegistrationRecord(client, { ...record, registrationStatus: "confirmed", confirmationStatus: "confirmed", attendanceMatched: true, confirmationSource: "attendance", confirmationUpdatedAt: new Date().toISOString(), confirmationUpdatedBy: `Workflow ${input.workflowId}`, waitingPosition: undefined, waitingReason: undefined, registrationNumber: record.registrationNumber || await reserveRegistrationNumber(client) });
        ids.push(record.id); confirmed++;
      }
      if (ids.length) await client.query(`WITH positions AS (
        SELECT external_id,row_number() OVER(ORDER BY created_at,external_id) position FROM cfl_registration_records
        WHERE workshop_id=$1 AND payload->>'registrationStatus'='waiting')
        UPDATE cfl_registration_records r SET payload=jsonb_set(r.payload,'{waitingPosition}',to_jsonb(p.position)),updated_at=NOW()
        FROM positions p WHERE r.external_id=p.external_id`, [workshopId]);
      await client.query("COMMIT");
      promoted += ids.length;
      step.status = "success";
      step.detail = ids.length ? `${ids.length} waiting registration(s) confirmed in the selected workshop and batch.` : "No eligible waiting registration, already confirmed, or capacity full. No changes made.";
      step.output = { promoted: ids.length, registrationIds: ids, workshopId, batchId };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      step.status = "failed";
      step.detail = error instanceof Error ? error.message : "Confirmation failed.";
      input.result.status = "failed";
    } finally { client.release(); }
  }
  input.result.summary = input.result.status === "failed" ? "Workflow confirmation failed; review the node log." : `${promoted} waiting registration(s) confirmed by attendance workflow.`;
  return promoted;
}
