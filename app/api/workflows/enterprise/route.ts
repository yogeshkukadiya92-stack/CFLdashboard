import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAdminName, verifyAuthToken } from "@/lib/auth";
import { getAppState } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { generateWorkflowFromPrompt, normalizeEnterpriseSettings, type EnterpriseSettings } from "@/lib/workflow-enterprise";
import { getWorkflow, getWorkflowEnterpriseOverview, PRIMARY_WORKFLOW_ID, recordWorkflowAudit, saveWorkflowEnterpriseSettings, upsertWorkflowCredential } from "@/lib/workflow-db";

async function authorized(request: NextRequest) { return verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value); }
const WORKFLOW_ID = /^[a-zA-Z0-9_-]{1,120}$/;

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workflowId = request.nextUrl.searchParams.get("workflowId") || PRIMARY_WORKFLOW_ID;
  if (!WORKFLOW_ID.test(workflowId)) return NextResponse.json({ error: "Invalid workflow id." }, { status: 400 });
  try { return NextResponse.json({ overview: await getWorkflowEnterpriseOverview(workflowId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Enterprise settings unavailable." }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const workflowId = String(body.workflowId || PRIMARY_WORKFLOW_ID);
    const operation = String(body.operation || "");
    if (!WORKFLOW_ID.test(workflowId)) return NextResponse.json({ error: "Invalid workflow id." }, { status: 400 });
    const actor = getAdminName();
    if (operation === "saveSettings") {
      await saveWorkflowEnterpriseSettings(workflowId, normalizeEnterpriseSettings(body.settings), actor);
    } else if (operation === "addComment") {
      const text = String(body.text || "").trim().slice(0, 1000);
      if (!text) return NextResponse.json({ error: "Comment is required." }, { status: 400 });
      const current = await getWorkflowEnterpriseOverview(workflowId);
      const settings = normalizeEnterpriseSettings(current);
      settings.comments = [{ id: `comment_${crypto.randomUUID()}`, text, author: actor, createdAt: new Date().toISOString(), resolved: false }, ...settings.comments].slice(0, 100);
      await saveWorkflowEnterpriseSettings(workflowId, settings, actor);
    } else if (operation === "promote") {
      const environment = String(body.environment || "");
      if (!["staging", "production"].includes(environment)) return NextResponse.json({ error: "Invalid environment." }, { status: 400 });
      const [current, workflow] = await Promise.all([getWorkflowEnterpriseOverview(workflowId), getWorkflow(workflowId)]);
      if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
      if (environment === "production" && current.readiness.some((item) => ["approval", "credentials"].includes(item.key) && !item.ready)) return NextResponse.json({ error: "Approval and production credentials are required before production promotion." }, { status: 409 });
      const settings = normalizeEnterpriseSettings(current);
      settings.environments = settings.environments.map((item) => item.id === environment ? { ...item, version: workflow.version, promotedAt: new Date().toISOString(), promotedBy: actor } : item);
      await saveWorkflowEnterpriseSettings(workflowId, settings, actor);
      await recordWorkflowAudit({ workflowId, workflowVersion: workflow.version, action: "environment_promoted", actor, detail: { environment } });
    } else if (operation === "credential") {
      const name = String(body.name || "").trim(); const provider = String(body.provider || "").trim(); const secret = String(body.secret || ""); const environment = String(body.environment || "");
      if (!name || !provider || secret.length < 8 || secret.length > 5000 || !["development", "staging", "production"].includes(environment)) return NextResponse.json({ error: "Valid credential details are required." }, { status: 400 });
      await upsertWorkflowCredential({ workflowId, name, provider, secret, environment: environment as "development" | "staging" | "production", actor });
    } else if (operation === "generate") {
      const prompt = String(body.prompt || "").trim().slice(0, 1000);
      if (prompt.length < 5) return NextResponse.json({ error: "Describe the workflow you want." }, { status: 400 });
      return NextResponse.json({ ok: true, generated: generateWorkflowFromPrompt(prompt) });
    } else if (operation === "simulate") {
      const [workflow, state] = await Promise.all([getWorkflow(workflowId), getAppState()]);
      if (!workflow || !state) return NextResponse.json({ error: "Workflow unavailable." }, { status: 404 });
      const samples = [{ fullName: "Aarav Patel", mobile: "9876543210", city: "Ahmedabad", createdAt: new Date().toISOString() }, { fullName: "Diya Shah", mobile: "9876543211", city: "Surat", createdAt: new Date().toISOString() }, { fullName: "Payment Recovery", mobile: "9876543212", city: "Rajkot", paymentStatus: "failed", amountPaid: 0, createdAt: new Date().toISOString() }];
      const results = samples.map((registration) => executeWorkflow({ nodes: workflow.nodes, connections: workflow.connections, registration, salesPeople: Array.isArray(state.salesPeople) ? state.salesPeople as Array<Record<string, unknown>> : [], leads: Array.isArray(state.leads) ? state.leads as Array<Record<string, unknown>> : [], mode: "test" })).map((result, index) => ({ scenario: samples[index].fullName, status: result.status, steps: result.steps.length, summary: result.summary }));
      return NextResponse.json({ ok: true, simulation: results });
    } else return NextResponse.json({ error: "Unsupported enterprise operation." }, { status: 400 });
    return NextResponse.json({ ok: true, overview: await getWorkflowEnterpriseOverview(workflowId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Enterprise action failed." }, { status: 500 }); }
}
