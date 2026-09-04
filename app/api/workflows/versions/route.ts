import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAdminName, verifyAuthToken } from "@/lib/auth";
import { listWorkflowVersions, PRIMARY_WORKFLOW_ID, restoreWorkflowVersion } from "@/lib/workflow-db";

async function authorized(request: NextRequest) { return verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value); }

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workflowId = request.nextUrl.searchParams.get("workflowId") || PRIMARY_WORKFLOW_ID;
  if (!/^[a-z0-9][a-z0-9-]{0,159}$/i.test(workflowId)) return NextResponse.json({ error: "Invalid workflow ID." }, { status: 400 });
  try { return NextResponse.json({ versions: await listWorkflowVersions(workflowId) }); }
  catch { return NextResponse.json({ error: "Could not load workflow versions." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { workflowId?: unknown; version?: unknown } | null;
  const workflowId = String(body?.workflowId || PRIMARY_WORKFLOW_ID);
  const version = Number(body?.version);
  if (!/^[a-z0-9][a-z0-9-]{0,159}$/i.test(workflowId) || !Number.isInteger(version) || version < 1 || version > 1_000_000) return NextResponse.json({ error: "Valid workflow and version are required." }, { status: 400 });
  try {
    const workflow = await restoreWorkflowVersion(workflowId, version, getAdminName());
    return workflow ? NextResponse.json({ ok: true, workflow, versions: await listWorkflowVersions(workflowId) }) : NextResponse.json({ error: "Workflow version was not found." }, { status: 404 });
  } catch { return NextResponse.json({ error: "Could not restore workflow version." }, { status: 500 }); }
}
