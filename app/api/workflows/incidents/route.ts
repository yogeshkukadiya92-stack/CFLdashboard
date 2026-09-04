import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAdminName, verifyAuthToken } from "@/lib/auth";
import { getWorkflowIncidentOverview, PRIMARY_WORKFLOW_ID, updateWorkflowIncident } from "@/lib/workflow-db";

async function authorized(request: NextRequest) {
  return verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

const WORKFLOW_ID = /^[a-zA-Z0-9_-]{1,120}$/;
const INCIDENT_ID = /^inc_[a-f0-9-]{36}$/;

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workflowId = request.nextUrl.searchParams.get("workflowId") || PRIMARY_WORKFLOW_ID;
  if (!WORKFLOW_ID.test(workflowId)) return NextResponse.json({ error: "Invalid workflow id." }, { status: 400 });
  try { return NextResponse.json({ overview: await getWorkflowIncidentOverview(workflowId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Incident data unavailable." }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const workflowId = String(body.workflowId || PRIMARY_WORKFLOW_ID);
    const incidentId = String(body.incidentId || "");
    const operation = String(body.operation || "");
    if (!WORKFLOW_ID.test(workflowId) || !INCIDENT_ID.test(incidentId) || !["acknowledge", "resolve"].includes(operation)) return NextResponse.json({ error: "Invalid incident action." }, { status: 400 });
    const incident = await updateWorkflowIncident({ workflowId, incidentId, operation: operation as "acknowledge" | "resolve", actor: getAdminName() });
    if (!incident) return NextResponse.json({ error: "Active incident not found." }, { status: 409 });
    return NextResponse.json({ ok: true, overview: await getWorkflowIncidentOverview(workflowId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Incident action failed." }, { status: 500 }); }
}
