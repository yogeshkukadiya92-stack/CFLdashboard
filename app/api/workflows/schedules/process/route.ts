import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAppState } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { claimDueWorkflowSchedules, finishWorkflowSchedule, getWorkflowScheduleOverview, recordWorkflowExecution } from "@/lib/workflow-db";

function secretMatches(received: string, expected: string) {
  if (!received || !expected || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

async function authorized(request: NextRequest) {
  if (await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)) return true;
  const expected = process.env.WORKFLOW_CRON_SECRET?.trim() || "";
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return secretMatches(received, expected);
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    const claimed = await claimDueWorkflowSchedules();
    const results = [];
    for (const item of claimed) {
      const started = Date.now();
      const executionId = `EXE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      try {
        const input = { id: `schedule-${item.node.id}-${item.scheduledFor}`, source: "Workflow scheduler", scheduledFor: item.scheduledFor, scheduleNodeId: item.node.id, createdAt: new Date().toISOString() };
        const result = executeWorkflow({ nodes: item.workflow.nodes, connections: item.workflow.connections, registration: input, salesPeople: Array.isArray(state.salesPeople) ? state.salesPeople as Array<Record<string, unknown>> : [], leads: Array.isArray(state.leads) ? state.leads as Array<Record<string, unknown>> : [], mode: "production" });
        await recordWorkflowExecution({ id: executionId, workflowId: item.workflow.id, mode: "production", status: result.status, trigger: "Scheduled time", participant: item.workflow.name, registration: input, output: { summary: result.summary, scheduleNodeId: item.node.id }, steps: result.steps, durationMs: Date.now() - started });
        await finishWorkflowSchedule({ workflowId: item.workflow.id, nodeId: item.node.id, scheduledFor: item.scheduledFor, success: true, executionId });
        results.push({ workflowId: item.workflow.id, executionId, success: true });
      } catch (error) {
        await finishWorkflowSchedule({ workflowId: item.workflow.id, nodeId: item.node.id, scheduledFor: item.scheduledFor, success: false, executionId, error: error instanceof Error ? error.message.slice(0, 500) : "Schedule execution failed." });
        results.push({ workflowId: item.workflow.id, executionId, success: false });
      }
    }
    return NextResponse.json({ ok: true, processed: results.length, succeeded: results.filter((item) => item.success).length, overview: await getWorkflowScheduleOverview() });
  } catch { return NextResponse.json({ error: "Could not process workflow schedules." }, { status: 500 }); }
}
