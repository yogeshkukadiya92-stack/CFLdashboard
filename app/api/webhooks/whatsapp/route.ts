import { timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { getAppState } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { listActiveWorkflowsForTrigger, recordWorkflowExecution } from "@/lib/workflow-db";
import { parseWhatsAppWebhook, storeWhatsAppEvents, verifyWhatsAppWebhookSignature, type WhatsAppEvent } from "@/lib/whatsapp-automation";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1_000_000;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function configuredEvents(type: WhatsAppEvent["type"]) {
  if (type === "message.received") return ["whatsapp reply received", "whatsapp message received"];
  if (type === "message.delivered") return ["whatsapp message delivered"];
  if (type === "message.read") return ["whatsapp message read"];
  if (type === "message.failed") return ["whatsapp message failed"];
  return ["whatsapp message sent"];
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode") || "";
  const token = request.nextUrl.searchParams.get("hub.verify_token") || "";
  const challenge = request.nextUrl.searchParams.get("hub.challenge") || "";
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";
  if (mode !== "subscribe" || !expected || !safeEqual(token, expected) || !challenge) return new NextResponse("Verification failed", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

async function triggerWhatsAppWorkflows(events: WhatsAppEvent[]) {
  if (!events.length) return;
  const triggerNames = Array.from(new Set(events.flatMap((event) => configuredEvents(event.type))));
  const [workflows, state] = await Promise.all([listActiveWorkflowsForTrigger(triggerNames), getAppState()]);
  if (!state) return;
  const salesPeople = Array.isArray(state.salesPeople) ? state.salesPeople as Array<Record<string, unknown>> : [];
  const leads = Array.isArray(state.leads) ? state.leads as Array<Record<string, unknown>> : [];
  for (const workflow of workflows) {
    const trigger = workflow.nodes.find((node) => node.kind === "trigger" && triggerNames.includes(String(node.config.event ?? "").toLowerCase()));
    if (!trigger) continue;
    const event = events.find((candidate) => configuredEvents(candidate.type).includes(String(trigger.config.event ?? "").toLowerCase()));
    if (!event) continue;
    const normalizedMobile = event.mobile.replace(/\D/g, "").slice(-10);
    const lead = leads.find((candidate) => String(candidate.mobile ?? "").replace(/\D/g, "").slice(-10) === normalizedMobile);
    const registration = {
      id: event.providerMessageId,
      fullName: String(lead?.name ?? "WhatsApp contact"),
      mobile: normalizedMobile,
      city: String(lead?.city ?? ""),
      state: String(lead?.state ?? ""),
      source: "WhatsApp",
      messageText: event.text || "",
      whatsappEvent: event.type,
      createdAt: event.timestamp || new Date().toISOString()
    };
    const result = executeWorkflow({ nodes: workflow.nodes, connections: workflow.connections, registration, salesPeople, leads, mode: "production" });
    const executionId = `EXE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await recordWorkflowExecution({
      id: executionId,
      workflowId: workflow.id,
      mode: "production",
      status: result.status,
      trigger: String(trigger.config.event),
      participant: `${registration.fullName} · WhatsApp`,
      registration,
      output: { summary: result.summary, assignment: result.assignment, whatsappEvent: event.type },
      steps: result.steps,
      durationMs: result.durationMs
    });
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!contentType.toLowerCase().includes("application/json")) return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  if (!verifyWhatsAppWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  try {
    const events = parseWhatsAppWebhook(payload);
    const inserted = await storeWhatsAppEvents(events);
    after(async () => { await triggerWhatsAppWorkflows(inserted).catch(() => undefined); });
    return NextResponse.json({ received: true, accepted: inserted.length });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
