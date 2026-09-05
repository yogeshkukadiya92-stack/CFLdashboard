import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDbPool } from "./db.ts";
import type { Connection, ExecutionStep, RunRow, WorkflowNode } from "@/lib/workflow-studio";
import type { LeadAssignmentStrategy, WorkshopLeadAssignmentRule } from "@/lib/workshop-lead-assignment";
import { nextScheduleAt, scheduleDefinition, scheduleIsDue } from "./workflow-scheduler.ts";
import { defaultEnterpriseSettings, decryptCredential, encryptCredential, maskCredential, normalizeEnterpriseSettings, type EnterpriseOverview, type EnterpriseSettings } from "./workflow-enterprise.ts";

export const PRIMARY_WORKFLOW_ID = "workshop-registration-onboarding";

export type PersistedWorkflow = {
  id: string;
  name: string;
  status: "draft" | "active";
  version: number;
  nodes: WorkflowNode[];
  connections: Connection[];
  note: string;
  updatedAt: string;
};
export type WorkflowVersion = { version: number; createdBy: string; createdAt: string; nodeCount: number; restoredFromVersion?: number };
export type WorkflowReliabilityOverview = { total: number; success: number; failed: number; running: number; successRate: number; p95DurationMs: number; slowNodes: Array<{ title: string; averageMs: number; runs: number }> };
export type WorkflowApproval = { id: string; workflowVersion: number; status: "pending" | "approved" | "rejected" | "cancelled"; requestedBy: string; requestNote: string; reviewedBy: string; reviewNote: string; requestedAt: string; reviewedAt: string | null };
export type WorkflowAuditEntry = { id: string; workflowVersion: number | null; action: string; actor: string; detail: Record<string, unknown>; createdAt: string };
export type WorkflowGovernanceOverview = { currentVersion: number; approvedVersion: number | null; pending: number; approvals: WorkflowApproval[]; audit: WorkflowAuditEntry[] };
export type WorkflowIncident = { id: string; executionId: string; severity: "critical" | "high" | "medium" | "low"; status: "open" | "acknowledged" | "resolved"; title: string; errorMessage: string; failedNode: string; owner: string; createdAt: string; acknowledgedAt: string | null; resolvedAt: string | null };
export type WorkflowIncidentOverview = { open: number; acknowledged: number; resolved: number; critical: number; incidents: WorkflowIncident[] };

let schemaReady: Promise<void> | null = null;

async function database() {
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  if (!schemaReady) {
    schemaReady = readFile(join(process.cwd(), "database", "workflow_automation.sql"), "utf8")
      .then((sql) => pool.query(sql))
      .then(() => undefined)
      .catch((error) => { schemaReady = null; throw error; });
  }
  await schemaReady;
  return pool;
}

function mapWorkflow(row: Record<string, unknown>): PersistedWorkflow {
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status === "active" ? "active" : "draft",
    version: Number(row.version || 1),
    nodes: Array.isArray(row.nodes) ? row.nodes as WorkflowNode[] : [],
    connections: Array.isArray(row.connections) ? row.connections as Connection[] : [],
    note: String(row.note || ""),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

export async function listWorkflowLibrary(offset = 0, query = "", status = "all") {
  const db = await database();
  const result = await db.query(`SELECT id, name, status, version, updated_at,
    jsonb_array_length(nodes) AS node_count
    FROM cfl_automation_workflows
    WHERE ($1 = '' OR strpos(lower(name), lower($1)) > 0)
      AND ($2 = 'all' OR status = $2)
    ORDER BY updated_at DESC, id ASC LIMIT 51 OFFSET $3`, [query.slice(0, 160), status, offset]);
  return {
    workflows: result.rows.slice(0, 50).map(row => ({ id: String(row.id), name: String(row.name),
      status: row.status === "active" ? "active" : "draft", version: Number(row.version),
      nodeCount: Number(row.node_count), updatedAt: new Date(row.updated_at).toISOString() })),
    hasMore: result.rows.length > 50
  };
}

export async function getWorkflow(workflowId = PRIMARY_WORKFLOW_ID) {
  const db = await database();
  const result = await db.query(`SELECT * FROM cfl_automation_workflows WHERE id=$1 LIMIT 1`, [workflowId]);
  return result.rows[0] ? mapWorkflow(result.rows[0]) : null;
}

export async function saveWorkflow(input: {
  id?: string;
  name: string;
  status: "draft" | "active";
  nodes: WorkflowNode[];
  connections: Connection[];
  note?: string;
  actor?: string;
  createVersion?: boolean;
}) {
  const db = await database();
  const workflowId = input.id || PRIMARY_WORKFLOW_ID;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`SELECT version,status FROM cfl_automation_workflows WHERE id=$1 FOR UPDATE`, [workflowId]);
    const currentVersion = Number(current.rows[0]?.version || 0);
    const nextVersion = input.createVersion ? Math.max(1, currentVersion + 1) : Math.max(1, currentVersion);
    const result = await client.query(
      `INSERT INTO cfl_automation_workflows (id,name,status,version,nodes,connections,note,updated_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,version=$4,
         nodes=EXCLUDED.nodes,connections=EXCLUDED.connections,note=EXCLUDED.note,
         updated_by=EXCLUDED.updated_by,updated_at=NOW()
       RETURNING *`,
      [workflowId, input.name, input.status, nextVersion, JSON.stringify(input.nodes), JSON.stringify(input.connections), input.note || "", input.actor || "Admin User"]
    );
    if (input.createVersion || !current.rows[0]) {
      await client.query(
        `INSERT INTO cfl_automation_workflow_versions (workflow_id,version,snapshot,created_by)
         VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (workflow_id,version) DO NOTHING`,
        [workflowId, nextVersion, JSON.stringify({ name: input.name, status: input.status, nodes: input.nodes, connections: input.connections, note: input.note || "" }), input.actor || "Admin User"]
      );
    }
    const action = input.status === "active" && current.rows[0]?.status !== "active" ? "workflow_activated" : input.createVersion ? "version_created" : current.rows[0] ? "workflow_saved" : "workflow_created";
    await client.query(`INSERT INTO cfl_automation_audit_log (workflow_id,workflow_version,action,actor,detail) VALUES ($1,$2,$3,$4,$5::jsonb)`, [workflowId, nextVersion, action, input.actor || "Admin User", JSON.stringify({ status: input.status, nodeCount: input.nodes.length })]);
    await client.query("COMMIT");
    return mapWorkflow(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listWorkflowExecutions(workflowId = PRIMARY_WORKFLOW_ID, limit = 25): Promise<RunRow[]> {
  const db = await database();
  const result = await db.query(
    `SELECT id,status,trigger_name,participant,steps,error_message,started_at,duration_ms,output
     FROM cfl_automation_executions WHERE workflow_id=$1 ORDER BY started_at DESC LIMIT $2`,
    [workflowId, Math.max(1, Math.min(100, limit))]
  );
  return result.rows.map((row) => {
    const steps = Array.isArray(row.steps) ? row.steps as ExecutionStep[] : [];
    const output = row.output && typeof row.output === "object" ? row.output as Record<string, unknown> : {};
    return {
      id: String(row.id),
      status: row.status,
      started: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(row.started_at)),
      duration: `${(Number(row.duration_ms || 0) / 1000).toFixed(1)}s`,
      trigger: String(row.trigger_name),
      participant: String(row.participant || ""),
      progress: `${steps.filter((step) => step.status === "success").length} / ${steps.length} nodes`,
      detail: String(row.error_message || output.summary || "Execution completed."),
      steps
    } satisfies RunRow;
  });
}

export async function recordWorkflowExecution(input: {
  id: string;
  workflowId: string;
  mode: "test" | "production";
  status: "success" | "failed";
  trigger: string;
  participant: string;
  registration: Record<string, unknown>;
  output: Record<string, unknown>;
  steps: ExecutionStep[];
  durationMs: number;
  error?: string;
}) {
  const db = await database();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO cfl_automation_executions
      (id,workflow_id,mode,status,trigger_name,participant,input,output,steps,error_message,started_at,finished_at,duration_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,NOW(),NOW(),$11)`,
      [input.id, input.workflowId, input.mode, input.status, input.trigger, input.participant, JSON.stringify(input.registration), JSON.stringify(input.output), JSON.stringify(input.steps), input.error || null, input.durationMs]
    );
    if (input.status === "failed") {
      const failedStep = input.steps.find((step) => step.status === "failed");
      const severity = deriveIncidentSeverity(failedStep?.title || "", input.error || failedStep?.detail || "");
      const incidentId = `inc_${crypto.randomUUID()}`;
      const incident = await client.query(`INSERT INTO cfl_automation_incidents (id,workflow_id,execution_id,severity,title,error_message,failed_node) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (execution_id) DO NOTHING RETURNING id`, [incidentId, input.workflowId, input.id, severity, `${input.trigger} failed`, (input.error || failedStep?.detail || "Execution failed").slice(0, 2000), (failedStep?.title || "Unknown node").slice(0, 200)]);
      if (incident.rows[0]) await client.query(`INSERT INTO cfl_automation_alert_outbox (workflow_id,incident_id,channel,payload) VALUES ($1,$2,'dashboard',$3::jsonb) ON CONFLICT DO NOTHING`, [input.workflowId, incidentId, JSON.stringify({ severity, executionId: input.id, title: `${input.trigger} failed` })]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}

export function deriveIncidentSeverity(nodeTitle: string, errorMessage: string): WorkflowIncident["severity"] {
  const value = `${nodeTitle} ${errorMessage}`.toLowerCase();
  if (/payment|razorpay|unauthori[sz]ed|credential|signature/.test(value)) return "critical";
  if (/webhook|whatsapp|assign|database|timeout/.test(value)) return "high";
  if (/validat|condition|attendance|workshop/.test(value)) return "medium";
  return "low";
}

function mapIncident(row: Record<string, unknown>): WorkflowIncident {
  return { id: String(row.id), executionId: String(row.execution_id), severity: String(row.severity) as WorkflowIncident["severity"], status: String(row.status) as WorkflowIncident["status"], title: String(row.title), errorMessage: String(row.error_message || ""), failedNode: String(row.failed_node || ""), owner: String(row.owner || ""), createdAt: new Date(String(row.created_at)).toISOString(), acknowledgedAt: row.acknowledged_at ? new Date(String(row.acknowledged_at)).toISOString() : null, resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null };
}

export async function getWorkflowIncidentOverview(workflowId = PRIMARY_WORKFLOW_ID): Promise<WorkflowIncidentOverview> {
  const db = await database();
  const result = await db.query(`SELECT * FROM cfl_automation_incidents WHERE workflow_id=$1 ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,created_at DESC LIMIT 50`, [workflowId]);
  const incidents = result.rows.map(mapIncident);
  return { open: incidents.filter((item) => item.status === "open").length, acknowledged: incidents.filter((item) => item.status === "acknowledged").length, resolved: incidents.filter((item) => item.status === "resolved").length, critical: incidents.filter((item) => item.status !== "resolved" && item.severity === "critical").length, incidents };
}

export async function updateWorkflowIncident(input: { workflowId: string; incidentId: string; operation: "acknowledge" | "resolve"; actor: string }) {
  const db = await database();
  const nextStatus = input.operation === "acknowledge" ? "acknowledged" : "resolved";
  const result = await db.query(`UPDATE cfl_automation_incidents SET status=$3,owner=CASE WHEN $3='acknowledged' THEN $4 ELSE owner END,acknowledged_by=CASE WHEN $3='acknowledged' THEN $4 ELSE acknowledged_by END,acknowledged_at=CASE WHEN $3='acknowledged' THEN NOW() ELSE acknowledged_at END,resolved_by=CASE WHEN $3='resolved' THEN $4 ELSE resolved_by END,resolved_at=CASE WHEN $3='resolved' THEN NOW() ELSE resolved_at END WHERE id=$1 AND workflow_id=$2 AND status <> 'resolved' RETURNING *`, [input.incidentId, input.workflowId, nextStatus, input.actor]);
  if (!result.rows[0]) return null;
  await recordWorkflowAudit({ workflowId: input.workflowId, action: `incident_${nextStatus}`, actor: input.actor, detail: { incidentId: input.incidentId, executionId: result.rows[0].execution_id } });
  return mapIncident(result.rows[0]);
}

export async function getActiveWorkflowAssignmentSettings(workshopId?: string) {
  const db = await database();
  const result = await db.query(`SELECT nodes FROM cfl_automation_workflows WHERE status='active' ORDER BY updated_at DESC LIMIT 20`);
  for (const row of result.rows) {
    const nodes = Array.isArray(row.nodes) ? row.nodes as WorkflowNode[] : [];
    const node = nodes.find((candidate) => candidate.kind === "crm" && candidate.title.toLowerCase().includes("assign"));
    if (!node) continue;
    const scopedWorkshop = String(node.config.workshopId ?? "");
    if (scopedWorkshop && workshopId && scopedWorkshop !== workshopId) continue;
    return {
      rules: Array.isArray(node.config.assignmentRules) ? node.config.assignmentRules as WorkshopLeadAssignmentRule[] : [],
      defaultSalesPersonId: String(node.config.defaultSalesPersonId ?? ""),
      fallbackStrategy: String(node.config.fallbackStrategy ?? "least-active") as LeadAssignmentStrategy
    };
  }
  return null;
}

export async function listActiveWorkflowsForTrigger(events: string[]) {
  const db = await database();
  const result = await db.query(`SELECT * FROM cfl_automation_workflows WHERE status='active' ORDER BY updated_at DESC LIMIT 50`);
  return result.rows.map(mapWorkflow).filter((workflow) => workflowMatchesTriggers(workflow.nodes, events));
}

export function workflowMatchesTriggers(nodes: WorkflowNode[], events: string[]) {
  const accepted = new Set(events.map((event) => event.toLowerCase()));
  return nodes.some((node) => {
    if (!["trigger", "attendance", "payment"].includes(node.kind)) return false;
    const configured = String(node.config.event ?? "").toLowerCase();
    return accepted.has(configured);
  });
}

export async function listWorkflowVersions(workflowId = PRIMARY_WORKFLOW_ID, limit = 25): Promise<WorkflowVersion[]> {
  const db = await database();
  const result = await db.query(`SELECT version,snapshot,created_by,created_at FROM cfl_automation_workflow_versions WHERE workflow_id=$1 ORDER BY version DESC LIMIT $2`, [workflowId, Math.max(1, Math.min(100, limit))]);
  return result.rows.map((row) => {
    const snapshot = row.snapshot && typeof row.snapshot === "object" ? row.snapshot as Record<string, unknown> : {};
    return { version: Number(row.version), createdBy: String(row.created_by), createdAt: new Date(row.created_at).toISOString(), nodeCount: Array.isArray(snapshot.nodes) ? snapshot.nodes.length : 0, restoredFromVersion: Number(snapshot.restoredFromVersion || 0) || undefined };
  });
}

export async function restoreWorkflowVersion(workflowId: string, version: number, actor: string) {
  const db = await database();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`SELECT * FROM cfl_automation_workflows WHERE id=$1 FOR UPDATE`, [workflowId]);
    const source = await client.query(`SELECT snapshot FROM cfl_automation_workflow_versions WHERE workflow_id=$1 AND version=$2`, [workflowId, version]);
    if (!current.rows[0] || !source.rows[0]) { await client.query("ROLLBACK"); return null; }
    const snapshot = source.rows[0].snapshot as Record<string, unknown>;
    const nextVersion = Number(current.rows[0].version || 0) + 1;
    const restoredSnapshot = { ...snapshot, restoredFromVersion: version };
    const updated = await client.query(`UPDATE cfl_automation_workflows SET name=$2,status=$3,version=$4,nodes=$5::jsonb,connections=$6::jsonb,note=$7,updated_by=$8,updated_at=NOW() WHERE id=$1 RETURNING *`, [workflowId, String(snapshot.name || current.rows[0].name), snapshot.status === "active" ? "active" : "draft", nextVersion, JSON.stringify(Array.isArray(snapshot.nodes) ? snapshot.nodes : []), JSON.stringify(Array.isArray(snapshot.connections) ? snapshot.connections : []), String(snapshot.note || ""), actor]);
    await client.query(`INSERT INTO cfl_automation_workflow_versions (workflow_id,version,snapshot,created_by) VALUES ($1,$2,$3::jsonb,$4)`, [workflowId, nextVersion, JSON.stringify(restoredSnapshot), actor]);
    await client.query(`INSERT INTO cfl_automation_audit_log (workflow_id,workflow_version,action,actor,detail) VALUES ($1,$2,'version_restored',$3,$4::jsonb)`, [workflowId, nextVersion, actor, JSON.stringify({ sourceVersion: version })]);
    await client.query("COMMIT");
    return mapWorkflow(updated.rows[0]);
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}

function mapApproval(row: Record<string, unknown>): WorkflowApproval {
  return { id: String(row.id), workflowVersion: Number(row.workflow_version), status: String(row.status) as WorkflowApproval["status"], requestedBy: String(row.requested_by), requestNote: String(row.request_note || ""), reviewedBy: String(row.reviewed_by || ""), reviewNote: String(row.review_note || ""), requestedAt: new Date(String(row.requested_at)).toISOString(), reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : null };
}

export async function recordWorkflowAudit(input: { workflowId: string; workflowVersion?: number; action: string; actor: string; detail?: Record<string, unknown> }) {
  const db = await database();
  await db.query(`INSERT INTO cfl_automation_audit_log (workflow_id,workflow_version,action,actor,detail) VALUES ($1,$2,$3,$4,$5::jsonb)`, [input.workflowId, input.workflowVersion || null, input.action.slice(0, 80), input.actor.slice(0, 160), JSON.stringify(input.detail || {})]);
}

export async function requestWorkflowApproval(workflowId: string, actor: string, note = "") {
  const db = await database();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const workflow = await client.query(`SELECT version FROM cfl_automation_workflows WHERE id=$1 FOR UPDATE`, [workflowId]);
    if (!workflow.rows[0]) { await client.query("ROLLBACK"); return null; }
    const version = Number(workflow.rows[0].version);
    const existing = await client.query(`SELECT * FROM cfl_automation_approvals WHERE workflow_id=$1 AND workflow_version=$2 AND status='pending' LIMIT 1`, [workflowId, version]);
    if (existing.rows[0]) { await client.query("COMMIT"); return mapApproval(existing.rows[0]); }
    const id = `apr_${crypto.randomUUID()}`;
    const inserted = await client.query(`INSERT INTO cfl_automation_approvals (id,workflow_id,workflow_version,requested_by,request_note) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [id, workflowId, version, actor, note.slice(0, 1000)]);
    await client.query(`INSERT INTO cfl_automation_audit_log (workflow_id,workflow_version,action,actor,detail) VALUES ($1,$2,'approval_requested',$3,$4::jsonb)`, [workflowId, version, actor, JSON.stringify({ approvalId: id })]);
    await client.query("COMMIT");
    return mapApproval(inserted.rows[0]);
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}

export async function reviewWorkflowApproval(approvalId: string, decision: "approved" | "rejected", actor: string, note = "") {
  const db = await database();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`SELECT * FROM cfl_automation_approvals WHERE id=$1 FOR UPDATE`, [approvalId]);
    if (!current.rows[0] || current.rows[0].status !== "pending") { await client.query("ROLLBACK"); return null; }
    const updated = await client.query(`UPDATE cfl_automation_approvals SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=NOW() WHERE id=$1 RETURNING *`, [approvalId, decision, actor, note.slice(0, 1000)]);
    const row = updated.rows[0];
    await client.query(`INSERT INTO cfl_automation_audit_log (workflow_id,workflow_version,action,actor,detail) VALUES ($1,$2,$3,$4,$5::jsonb)`, [row.workflow_id, row.workflow_version, `approval_${decision}`, actor, JSON.stringify({ approvalId })]);
    await client.query("COMMIT");
    return mapApproval(row);
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}

export async function getWorkflowGovernanceOverview(workflowId = PRIMARY_WORKFLOW_ID): Promise<WorkflowGovernanceOverview> {
  const db = await database();
  const [workflow, approvals, audit] = await Promise.all([
    db.query(`SELECT version FROM cfl_automation_workflows WHERE id=$1 LIMIT 1`, [workflowId]),
    db.query(`SELECT * FROM cfl_automation_approvals WHERE workflow_id=$1 ORDER BY requested_at DESC LIMIT 25`, [workflowId]),
    db.query(`SELECT * FROM cfl_automation_audit_log WHERE workflow_id=$1 ORDER BY created_at DESC LIMIT 50`, [workflowId])
  ]);
  const mapped = approvals.rows.map(mapApproval);
  return { currentVersion: Number(workflow.rows[0]?.version || 0), approvedVersion: mapped.find((item) => item.status === "approved")?.workflowVersion ?? null, pending: mapped.filter((item) => item.status === "pending").length, approvals: mapped, audit: audit.rows.map((row) => ({ id: String(row.id), workflowVersion: row.workflow_version == null ? null : Number(row.workflow_version), action: String(row.action), actor: String(row.actor), detail: row.detail && typeof row.detail === "object" ? row.detail as Record<string, unknown> : {}, createdAt: new Date(row.created_at).toISOString() })) };
}

export async function getWorkflowExecutionForReplay(executionId: string) {
  const db = await database();
  const result = await db.query(`SELECT id,workflow_id,mode,status,trigger_name,participant,input FROM cfl_automation_executions WHERE id=$1 LIMIT 1`, [executionId]);
  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function getWorkflowReliabilityOverview(workflowId = PRIMARY_WORKFLOW_ID): Promise<WorkflowReliabilityOverview> {
  const db = await database();
  const result = await db.query(`SELECT status,duration_ms,steps FROM cfl_automation_executions WHERE workflow_id=$1 ORDER BY started_at DESC LIMIT 200`, [workflowId]);
  return buildWorkflowReliabilityOverview(result.rows);
}

export function buildWorkflowReliabilityOverview(rows: Array<{ status?: unknown; duration_ms?: unknown; steps?: unknown }>): WorkflowReliabilityOverview {
  const durations = rows.map((row) => Number(row.duration_ms || 0)).sort((a, b) => a - b);
  const success = rows.filter((row) => row.status === "success").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  const running = rows.filter((row) => row.status === "running").length;
  const nodeStats = new Map<string, { total: number; runs: number }>();
  for (const row of rows) for (const step of Array.isArray(row.steps) ? row.steps as ExecutionStep[] : []) {
    const stat = nodeStats.get(step.title) || { total: 0, runs: 0 };
    stat.total += Math.max(0, Number(step.durationMs || 0)); stat.runs += 1; nodeStats.set(step.title, stat);
  }
  const slowNodes = [...nodeStats].map(([title, stat]) => ({ title, averageMs: Math.round(stat.total / stat.runs), runs: stat.runs })).sort((a, b) => b.averageMs - a.averageMs).slice(0, 5);
  return { total: rows.length, success, failed, running, successRate: rows.length ? Math.round(success / rows.length * 1000) / 10 : 100, p95DurationMs: durations.length ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * .95) - 1)] : 0, slowNodes };
}

export async function claimDueWorkflowSchedules(now = new Date()) {
  const db = await database();
  const result = await db.query(`SELECT * FROM cfl_automation_workflows WHERE status='active' ORDER BY updated_at DESC LIMIT 50`);
  const scheduledFor = new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString();
  const claimed: Array<{ workflow: PersistedWorkflow; node: WorkflowNode; scheduledFor: string }> = [];
  for (const workflow of result.rows.map(mapWorkflow)) for (const node of workflow.nodes.filter((candidate) => scheduleIsDue(candidate, now)).slice(0, 20)) {
    const inserted = await db.query(`INSERT INTO cfl_automation_schedule_runs (workflow_id,node_id,scheduled_for) VALUES ($1,$2,$3) ON CONFLICT (workflow_id,node_id,scheduled_for) DO NOTHING RETURNING id`, [workflow.id, node.id, scheduledFor]);
    if (inserted.rowCount === 1) claimed.push({ workflow, node, scheduledFor });
  }
  return claimed.slice(0, 100);
}

export async function finishWorkflowSchedule(input: { workflowId: string; nodeId: string; scheduledFor: string; success: boolean; executionId?: string; error?: string }) {
  const db = await database();
  await db.query(`UPDATE cfl_automation_schedule_runs SET status=$4,execution_id=$5,error_message=$6,finished_at=NOW() WHERE workflow_id=$1 AND node_id=$2 AND scheduled_for=$3`, [input.workflowId, input.nodeId, input.scheduledFor, input.success ? "success" : "failed", input.executionId || null, input.error || null]);
}

export async function getWorkflowScheduleOverview(now = new Date(), workflowId?: string) {
  const db = await database();
  const [workflows, history] = await Promise.all([
    db.query(`SELECT * FROM cfl_automation_workflows WHERE status='active' AND ($1::text IS NULL OR id=$1) ORDER BY updated_at DESC LIMIT 50`, [workflowId ?? null]),
    db.query(`SELECT workflow_id,node_id,scheduled_for,status,execution_id,error_message,created_at FROM cfl_automation_schedule_runs WHERE ($1::text IS NULL OR workflow_id=$1) ORDER BY created_at DESC LIMIT 20`, [workflowId ?? null])
  ]);
  const schedules = workflows.rows.flatMap((row) => { const workflow = mapWorkflow(row); return workflow.nodes.flatMap((node) => { const definition = scheduleDefinition(node); return definition ? [{ workflowId: workflow.id, workflowName: workflow.name, nodeId: node.id, title: node.title, frequency: definition.frequency, timezone: definition.timezone, nextRunAt: nextScheduleAt(node, now) }] : []; }); }).slice(0, 100);
  return { active: schedules.length, nextRunAt: schedules.map((item) => item.nextRunAt).filter((value): value is string => Boolean(value)).sort()[0] || null, schedules, history: history.rows.map((row) => ({ workflowId: String(row.workflow_id), nodeId: String(row.node_id), scheduledFor: new Date(row.scheduled_for).toISOString(), status: String(row.status), executionId: String(row.execution_id || ""), error: String(row.error_message || ""), createdAt: new Date(row.created_at).toISOString() })) };
}

export async function getWorkflowEnterpriseOverview(workflowId = PRIMARY_WORKFLOW_ID): Promise<EnterpriseOverview> {
  const db = await database();
  const [stored, credentials, executions, workflow, approval, library] = await Promise.all([
    db.query(`SELECT settings FROM cfl_automation_enterprise_settings WHERE workflow_id=$1 LIMIT 1`, [workflowId]),
    db.query(`SELECT id,name,provider,environment,encrypted_value,updated_at FROM cfl_automation_credentials WHERE workflow_id=$1 ORDER BY environment,name LIMIT 100`, [workflowId]),
    db.query(`SELECT status,duration_ms,output FROM cfl_automation_executions WHERE workflow_id=$1 ORDER BY started_at DESC LIMIT 500`, [workflowId]),
    db.query(`SELECT version,status FROM cfl_automation_workflows WHERE id=$1 LIMIT 1`, [workflowId]),
    db.query(`SELECT workflow_version FROM cfl_automation_approvals WHERE workflow_id=$1 AND status='approved' ORDER BY reviewed_at DESC LIMIT 1`, [workflowId]),
    db.query(`SELECT w.id,w.name,w.status,w.version,w.updated_at,e.settings FROM cfl_automation_workflows w LEFT JOIN cfl_automation_enterprise_settings e ON e.workflow_id=w.id ORDER BY w.updated_at DESC LIMIT 100`)
  ]);
  const settings = normalizeEnterpriseSettings(stored.rows[0]?.settings || defaultEnterpriseSettings);
  const success = executions.rows.filter((row) => row.status === "success").length;
  const durations = executions.rows.map((row) => Number(row.duration_ms || 0));
  const version = Number(workflow.rows[0]?.version || 0);
  const approved = Number(approval.rows[0]?.workflow_version || 0) === version && version > 0;
  return { ...settings, credentials: credentials.rows.map((row) => { let maskedValue = "••••"; try { maskedValue = maskCredential(decryptCredential(String(row.encrypted_value))); } catch { maskedValue = "Unavailable"; } return { id: String(row.id), name: String(row.name), provider: String(row.provider), environment: String(row.environment), maskedValue, updatedAt: new Date(row.updated_at).toISOString() }; }), workflowLibrary: library.rows.map((row) => { const metadata = normalizeEnterpriseSettings(row.settings); return { id: String(row.id), name: String(row.name), status: String(row.status), version: Number(row.version), folderId: metadata.workflowFolderId, tags: metadata.tags, updatedAt: new Date(row.updated_at).toISOString() }; }), analytics: { executions: executions.rows.length, successRate: executions.rows.length ? Math.round(success / executions.rows.length * 1000) / 10 : 100, averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0, estimatedConversions: success, revenueAttributed: executions.rows.reduce((sum, row) => { const output = row.output && typeof row.output === "object" ? row.output as Record<string, unknown> : {}; return sum + Math.max(0, Number(output.amount || 0)); }, 0) }, readiness: [{ key: "workflow", label: "Workflow saved", ready: Boolean(workflow.rows[0]) }, { key: "approval", label: "Current version approved", ready: approved }, { key: "credentials", label: "Production credentials configured", ready: credentials.rows.some((row) => row.environment === "production") }, { key: "alerts", label: "Failure alerts enabled", ready: settings.alertRules.some((rule) => rule.enabled) }, { key: "production", label: "Production workflow active", ready: workflow.rows[0]?.status === "active" }] };
}

export async function saveWorkflowEnterpriseSettings(workflowId: string, settings: EnterpriseSettings, actor: string) {
  const db = await database();
  const normalized = normalizeEnterpriseSettings(settings);
  await db.query(`INSERT INTO cfl_automation_enterprise_settings (workflow_id,settings,updated_by) VALUES ($1,$2::jsonb,$3) ON CONFLICT (workflow_id) DO UPDATE SET settings=EXCLUDED.settings,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, [workflowId, JSON.stringify(normalized), actor]);
  await recordWorkflowAudit({ workflowId, action: "enterprise_settings_updated", actor, detail: { roles: normalized.roles.length, alerts: normalized.alertRules.length } });
  return normalized;
}

export async function upsertWorkflowCredential(input: { workflowId: string; name: string; provider: string; environment: "development" | "staging" | "production"; secret: string; actor: string }) {
  const db = await database();
  const id = `cred_${crypto.randomUUID()}`;
  await db.query(`INSERT INTO cfl_automation_credentials (id,workflow_id,name,provider,environment,encrypted_value,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (workflow_id,name,environment) DO UPDATE SET provider=EXCLUDED.provider,encrypted_value=EXCLUDED.encrypted_value,updated_at=NOW()`, [id, input.workflowId, input.name.slice(0, 100), input.provider.slice(0, 80), input.environment, encryptCredential(input.secret), input.actor]);
  await recordWorkflowAudit({ workflowId: input.workflowId, action: "credential_saved", actor: input.actor, detail: { name: input.name, provider: input.provider, environment: input.environment } });
}
