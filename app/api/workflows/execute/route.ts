import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAppState } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import type { Connection, RunRow, WorkflowNode } from "@/lib/workflow-studio";
import { PRIMARY_WORKFLOW_ID, recordWorkflowExecution, saveWorkflow } from "@/lib/workflow-db";

export async function POST(request: NextRequest) {
  if (!(await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  try {
    const body = await request.json() as Record<string, unknown>;
    const nodes = Array.isArray(body.nodes) ? body.nodes as WorkflowNode[] : [];
    const connections = Array.isArray(body.connections) ? body.connections as Connection[] : [];
    if (!nodes.length || nodes.length > 100 || connections.length > 250) return NextResponse.json({ error: "Add a valid workflow before testing." }, { status: 400 });
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    const registration = body.registration && typeof body.registration === "object" && !Array.isArray(body.registration)
      ? body.registration as Record<string, unknown>
      : { id: `sample-${Date.now()}`, fullName: "Sample Lead", mobile: "9876543210", city: "Ahmedabad", state: "Gujarat", pincode: "380015", source: "Registration Link", workshopId: "business-growth-blueprint", workshopTitle: "Business Growth Blueprint", createdAt: new Date().toISOString() };
    const workflowId = String(body.id || PRIMARY_WORKFLOW_ID);
    await saveWorkflow({ id: workflowId, name: String(body.name || "Workflow test"), status: body.status === "active" ? "active" : "draft", nodes, connections, note: String(body.note || "") });
    const result = executeWorkflow({
      nodes,
      connections,
      registration,
      salesPeople: Array.isArray(state.salesPeople) ? state.salesPeople as Array<Record<string, unknown>> : [],
      leads: Array.isArray(state.leads) ? state.leads as Array<Record<string, unknown>> : []
      , registrations: Array.isArray(state.registrations) ? state.registrations as Array<Record<string, unknown>> : []
    });
    const id = `EXE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const participant = `${String(registration.fullName || registration.name || "Sample Lead")} · ${String(registration.city || "Unknown city")}`;
    await recordWorkflowExecution({ id, workflowId, mode: "test", status: result.status, trigger: "Manual rule test", participant, registration, output: { summary: result.summary, assignment: result.assignment }, steps: result.steps, durationMs: Date.now() - started });
    const run: RunRow = {
      id,
      status: result.status,
      started: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date()),
      duration: `${((Date.now() - started) / 1000).toFixed(1)}s`,
      trigger: "Manual rule test",
      participant,
      progress: `${result.steps.length} / ${result.steps.length} nodes`,
      detail: result.summary,
      steps: result.steps
    };
    return NextResponse.json({ ok: true, run, assignment: result.assignment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow execution failed." }, { status: 500 });
  }
}
