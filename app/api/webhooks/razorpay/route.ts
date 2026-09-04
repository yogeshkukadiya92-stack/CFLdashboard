import { after, NextResponse } from "next/server";
import { getAppState } from "@/lib/db";
import { getRazorpayConfig } from "@/lib/integrations";
import { applyCapturedPayment, parseRazorpayPaymentEvent, recordPaymentEvent, verifyRazorpayWebhookSignature, type ParsedPaymentEvent } from "@/lib/payment-automation";
import { executeWorkflow } from "@/lib/workflow-engine";
import { listActiveWorkflowsForTrigger, recordWorkflowExecution } from "@/lib/workflow-db";

export const runtime = "nodejs";
const MAX_WEBHOOK_BYTES = 1_048_576;

function workflowTrigger(eventName: string) {
  if (eventName === "payment.captured") return "Payment completed";
  if (eventName === "payment.failed") return "Payment failed";
  if (eventName === "payment.authorized") return "Payment authorized";
  return `Razorpay ${eventName}`;
}

async function runPaymentWorkflows(event: ParsedPaymentEvent) {
  const trigger = workflowTrigger(event.eventName);
  const [state, workflows] = await Promise.all([getAppState(), listActiveWorkflowsForTrigger([trigger])]);
  if (!state) return;
  await Promise.all(workflows.map(async (workflow) => {
    const started = Date.now();
    const input = { id: event.registrationId || event.paymentId, registrationId: event.registrationId, paymentId: event.paymentId, paymentStatus: event.status, paymentEvent: event.eventName, amountPaid: event.amount, amountDue: 0, paymentMethod: event.method, source: "Razorpay", createdAt: new Date().toISOString() };
    const result = executeWorkflow({ nodes: workflow.nodes, connections: workflow.connections, registration: input, salesPeople: Array.isArray(state.salesPeople) ? state.salesPeople as Array<Record<string, unknown>> : [], leads: Array.isArray(state.leads) ? state.leads as Array<Record<string, unknown>> : [], mode: "production" });
    await recordWorkflowExecution({ id: `EXE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, workflowId: workflow.id, mode: "production", status: result.status, trigger, participant: event.registrationId || event.paymentId, registration: input, output: { summary: result.summary, paymentId: event.paymentId }, steps: result.steps, durationMs: Date.now() - started });
  }));
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  const { webhookSecret: secret } = await getRazorpayConfig();
  if (!secret) return NextResponse.json({ error: "RAZORPAY_WEBHOOK_SECRET is not configured." }, { status: 503 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  if (!verifyRazorpayWebhookSignature(rawBody, request.headers.get("x-razorpay-signature") || "", secret)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }
  const event = parseRazorpayPaymentEvent(payload);
  if (!event) return NextResponse.json({ error: "Unsupported payment event." }, { status: 400 });
  const isNew = await recordPaymentEvent(event);
  const registration = await applyCapturedPayment(event);
  if (isNew) after(() => runPaymentWorkflows(event).catch(() => undefined));
  return NextResponse.json({ event: event.eventName, duplicate: !isNew, registrationUpdated: Boolean(registration), ok: true });
}
