import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAdminName, verifyAuthToken } from "@/lib/auth";
import { getAppState } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { getWorkflow, getWorkflowExecutionForReplay, recordWorkflowAudit, recordWorkflowExecution } from "@/lib/workflow-db";

export async function POST(request: NextRequest) {
  if (!(await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { executionId?: unknown } | null;
  const executionId = String(body?.executionId || "");
  if (!/^[A-Z0-9-]{5,80}$/i.test(executionId)) return NextResponse.json({ error: "Valid execution ID is required." }, { status: 400 });
  try {
    const source = await getWorkflowExecutionForReplay(executionId);
    if (!source || source.status !== "failed") return NextResponse.json({ error: "Only a failed execution can be replayed." }, { status: 409 });
    const [workflow, state] = await Promise.all([getWorkflow(String(source.workflow_id)), getAppState()]);
    if (!workflow || !state) return NextResponse.json({ error: "Workflow or application state is unavailable." }, { status: 503 });
    const started = Date.now();
    const input = source.input && typeof source.input === "object" && !Array.isArray(source.input) ? source.input as Record<string, unknown> : {};
    const result = executeWorkflow({ nodes: workflow.nodes, connections: workflow.connections, registration: input, salesPeople: Array.isArray(state.salesPeople) ? state.salesPeople as Array<Record<string, unknown>> : [], leads: Array.isArray(state.leads) ? state.leads as Array<Record<string, unknown>> : [], mode: "test" });
    const id = `EXE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await recordWorkflowExecution({ id, workflowId: workflow.id, mode: "test", status: result.status, trigger: `Replay of ${executionId}`, participant: String(source.participant || "Replayed event"), registration: input, output: { summary: result.summary, replayedFrom: executionId }, steps: result.steps, durationMs: Date.now() - started });
    await recordWorkflowAudit({ workflowId: workflow.id, workflowVersion: workflow.version, action: "execution_replayed", actor: getAdminName(), detail: { sourceExecutionId: executionId, newExecutionId: id, status: result.status } });
    return NextResponse.json({ ok: true, executionId: id, status: result.status });
  } catch { return NextResponse.json({ error: "Could not replay execution." }, { status: 500 }); }
}
