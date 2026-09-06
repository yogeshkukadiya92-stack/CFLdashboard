import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAppState } from "@/lib/db";
import { getWorkflow, recordWorkflowExecution } from "@/lib/workflow-db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { confirmWorkflowWaiting } from "@/lib/workflow-waiting-confirmation";
import type { AttendanceEntry } from "@/lib/types";
import { createHash } from "node:crypto";

export async function POST(request: NextRequest) {
  if (!await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const workflow = await getWorkflow(String(body.id || ""));
    if (!workflow || workflow.status !== "active") return NextResponse.json({ error: "Save and activate this workflow before processing existing attendance." }, { status: 400 });
    const sources = workflow.nodes.filter(node => node.kind === "attendance" && Boolean(node.config.event));
    const fingerprint = createHash("sha256").update(JSON.stringify({ nodes: workflow.nodes, connections: workflow.connections })).digest("hex");
    if (body.fingerprint && body.fingerprint !== fingerprint) return NextResponse.json({ error: "Workflow changed during processing. Review the saved settings and start again." }, { status: 409 });
    if (sources.some(node => !Array.isArray(node.config.sessionIds) || !node.config.sessionIds.length)) return NextResponse.json({ error: "Select specific Intro attendance forms before processing existing attendance." }, { status: 400 });
    if (!sources.length || !workflow.nodes.some(node => node.kind === "workshop" && (node.config.action === "Confirm registration" || node.title === "Confirm waiting registration"))) return NextResponse.json({ error: "Connect an attendance trigger to a waiting confirmation node first." }, { status: 400 });
    const state = await getAppState();
    if (!state) throw new Error("Database unavailable.");
    const cutoff = String(body.cutoff || new Date().toISOString());
    if (!Number.isFinite(Date.parse(cutoff))) throw new Error("Invalid processing cutoff.");
    const entries = (state.attendanceEntries as AttendanceEntry[]).filter(entry => entry.submittedAt <= cutoff && sources.some(node =>
      (!node.config.workshopId || node.config.workshopId === entry.workshopId) &&
      (!Array.isArray(node.config.sessionIds) || !node.config.sessionIds.length || node.config.sessionIds.includes(entry.sessionId))
    )).sort((a,b) => a.id.localeCompare(b.id));
    const cursor = String(body.cursor || "");
    const pending = entries.filter(entry => !cursor || entry.id.localeCompare(cursor) > 0);
    const batch = pending.slice(0, 20);
    let confirmed = 0;
    for (const attendance of batch) {
      const started = Date.now();
      const registration = { ...attendance, fullName: attendance.attendeeName, attendanceSessionId: attendance.sessionId, attendanceStatus: attendance.status || "checked_in", workshopTitle: attendance.workshopName, createdAt: attendance.submittedAt };
      const result = executeWorkflow({ nodes: workflow.nodes, connections: workflow.connections, registration, salesPeople: [], leads: [], mode: "production" });
      confirmed += await confirmWorkflowWaiting({ nodes: workflow.nodes, connections: workflow.connections, attendance, result, workflowId: workflow.id });
      await recordWorkflowExecution({ id: `EXE-${crypto.randomUUID().slice(0,8).toUpperCase()}`, workflowId: workflow.id, mode: "production", status: result.status, trigger: "Process existing attendance", participant: attendance.attendeeName, registration, output: { summary: result.summary }, steps: result.steps, durationMs: Date.now() - started });
      if (result.status === "failed") return NextResponse.json({ error: result.steps.find(step => step.status === "failed")?.detail || result.summary, confirmed }, { status: 409 });
    }
    return NextResponse.json({ confirmed, processed: batch.length, total: entries.length, cutoff, fingerprint, cursor: batch.at(-1)?.id || cursor, hasMore: pending.length > batch.length });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not process attendance." }, { status: 500 }); }
}
