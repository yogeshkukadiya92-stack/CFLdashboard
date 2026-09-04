import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAdminName, verifyAuthToken } from "@/lib/auth";
import { getWorkflowGovernanceOverview, PRIMARY_WORKFLOW_ID, requestWorkflowApproval, reviewWorkflowApproval } from "@/lib/workflow-db";

async function authorized(request: NextRequest) {
  return verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

function validWorkflowId(value: string) {
  return /^[a-zA-Z0-9_-]{1,120}$/.test(value);
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workflowId = request.nextUrl.searchParams.get("workflowId") || PRIMARY_WORKFLOW_ID;
  if (!validWorkflowId(workflowId)) return NextResponse.json({ error: "Invalid workflow id." }, { status: 400 });
  try {
    return NextResponse.json({ governance: await getWorkflowGovernanceOverview(workflowId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Governance data unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const workflowId = String(body.workflowId || PRIMARY_WORKFLOW_ID);
    const operation = String(body.operation || "");
    const note = String(body.note || "").slice(0, 1000);
    if (!validWorkflowId(workflowId)) return NextResponse.json({ error: "Invalid workflow id." }, { status: 400 });
    if (operation === "request") {
      const approval = await requestWorkflowApproval(workflowId, getAdminName(), note);
      if (!approval) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    } else if (operation === "approve" || operation === "reject") {
      const approvalId = String(body.approvalId || "");
      if (!/^apr_[a-f0-9-]{36}$/.test(approvalId)) return NextResponse.json({ error: "Invalid approval id." }, { status: 400 });
      const approval = await reviewWorkflowApproval(approvalId, operation === "approve" ? "approved" : "rejected", getAdminName(), note);
      if (!approval) return NextResponse.json({ error: "Pending approval not found." }, { status: 409 });
    } else return NextResponse.json({ error: "Unsupported governance operation." }, { status: 400 });
    return NextResponse.json({ ok: true, governance: await getWorkflowGovernanceOverview(workflowId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Governance action failed." }, { status: 500 });
  }
}
