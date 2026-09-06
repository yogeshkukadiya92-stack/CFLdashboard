import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAdminName, verifyAuthToken } from "@/lib/auth";
import { getAppState } from "@/lib/db";
import { initialConnections, initialNodes, type Connection, type WorkflowNode, type WorkflowSalesPerson } from "@/lib/workflow-studio";
import { listWorkflowLibrary, getWorkflow, getWorkflowEnterpriseOverview, getWorkflowGovernanceOverview, getWorkflowIncidentOverview, getWorkflowReliabilityOverview, getWorkflowScheduleOverview, listWorkflowExecutions, listWorkflowVersions, PRIMARY_WORKFLOW_ID, saveWorkflow } from "@/lib/workflow-db";
import { getWhatsAppAutomationOverview } from "@/lib/whatsapp-automation";
import { getAttendanceAutomationOverview } from "@/lib/attendance-automation";
import { getPaymentAutomationOverview } from "@/lib/payment-automation";
import type { AttendanceEntry, AttendanceSession, RegistrationEntry } from "@/lib/types";
import type { Lead } from "@/lib/types";
import { getCrmAutomationOverview } from "@/lib/crm-automation";

async function isAdmin(request: NextRequest) {
  return verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

function validGraph(nodes: unknown, connections: unknown): nodes is WorkflowNode[] {
  if (!Array.isArray(nodes) || !Array.isArray(connections) || nodes.length > 100 || connections.length > 250) return false;
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    const value = node as Partial<WorkflowNode>;
    if (!value.id || !value.title || !value.kind || typeof value.x !== "number" || typeof value.y !== "number" || !value.config || typeof value.config !== "object") return false;
    ids.add(value.id);
  }
  return (connections as Partial<Connection>[]).every((connection) => Boolean(connection?.id && connection.from && connection.to && ids.has(connection.from) && ids.has(connection.to)));
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (request.nextUrl.searchParams.get("view") === "library") {
      const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);
      const status = request.nextUrl.searchParams.get("status") || "all";
      return NextResponse.json(await listWorkflowLibrary(Math.floor(offset), request.nextUrl.searchParams.get("q") || "", ["active", "draft"].includes(status) ? status : "all"));
    }
    const workflowId = request.nextUrl.searchParams.get("id") || PRIMARY_WORKFLOW_ID;
    const [workflow, executions, state, whatsapp, paymentEvents, versions, reliability, schedules, governance, incidents, enterprise] = await Promise.all([
      getWorkflow(workflowId),
      listWorkflowExecutions(workflowId),
      getAppState(),
      getWhatsAppAutomationOverview(),
      getPaymentAutomationOverview([]),
      listWorkflowVersions(workflowId),
      getWorkflowReliabilityOverview(workflowId),
      getWorkflowScheduleOverview(new Date(), workflowId),
      getWorkflowGovernanceOverview(workflowId),
      getWorkflowIncidentOverview(workflowId),
      getWorkflowEnterpriseOverview(workflowId)
    ]);
    if (!workflow && request.nextUrl.searchParams.has("id")) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    const people = Array.isArray(state?.salesPeople) ? state.salesPeople as Array<Record<string, unknown>> : [];
    const leads = Array.isArray(state?.leads) ? state.leads as Array<Record<string, unknown>> : [];
    const salesPeople: WorkflowSalesPerson[] = people.map((person) => {
      const id = String(person.id ?? "");
      const name = String(person.name ?? "Unnamed sales person");
      const activeLeadCount = leads.filter((lead) => !["Won", "Lost"].includes(String(lead.stage ?? "")) && (String(lead.assignedSalesPersonId ?? "") === id || String(lead.assignedTo ?? "") === name)).length;
      return {
        id,
        name,
        isActive: person.isActive !== false,
        acceptingLeads: person.acceptingLeads !== false,
        activeLeadCount,
        maxActiveLeads: Number(person.maxActiveLeads ?? 0) || undefined
      };
    }).filter((person) => person.id);
    const attendance = getAttendanceAutomationOverview({
      entries: Array.isArray(state?.attendanceEntries) ? state.attendanceEntries as AttendanceEntry[] : [],
      sessions: Array.isArray(state?.attendanceSessions) ? state.attendanceSessions as AttendanceSession[] : [],
      registrations: Array.isArray(state?.registrations) ? state.registrations as RegistrationEntry[] : []
    });
    const attendanceSessions = (Array.isArray(state?.attendanceSessions) ? state.attendanceSessions as AttendanceSession[] : [])
      .map((session) => ({
        id: session.id,
        label: `${session.workshopName} · ${session.title}${session.sessionDate ? ` · ${session.sessionDate}` : ""}`,
        published: session.published !== false
      }));
    const registrations = Array.isArray(state?.registrations) ? state.registrations as RegistrationEntry[] : [];
    const payment = {
      ...paymentEvents,
      outstanding: registrations.reduce((sum, registration) => sum + Math.max(0, Number(registration.amountDue || 0)), 0),
      dueRegistrations: registrations.filter((registration) => Number(registration.amountDue || 0) > 0).length
    };
    const crm = getCrmAutomationOverview(Array.isArray(state?.leads) ? state.leads as Lead[] : []);
    return NextResponse.json({
      workflow: workflow ?? { id: PRIMARY_WORKFLOW_ID, name: "Workshop Registration & Onboarding", status: "draft", version: 0, nodes: initialNodes, connections: initialConnections, note: "", updatedAt: "" },
      executions,
      salesPeople,
      whatsapp,
      attendance,
      attendanceSessions,
      payment,
      crm,
      versions,
      reliability,
      schedules,
      governance,
      incidents,
      enterprise
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow storage unavailable." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!validGraph(body.nodes, body.connections)) return NextResponse.json({ error: "Workflow graph is invalid." }, { status: 400 });
    const workflow = await saveWorkflow({
      id: String(body.id || PRIMARY_WORKFLOW_ID),
      name: String(body.name || "Untitled workflow").slice(0, 160),
      status: body.status === "active" ? "active" : "draft",
      nodes: body.nodes,
      connections: body.connections as Connection[],
      note: String(body.note || "").slice(0, 10_000),
      actor: getAdminName(),
      createVersion: body.createVersion === true
    });
    return NextResponse.json({ ok: true, workflow });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save workflow." }, { status: 500 });
  }
}
