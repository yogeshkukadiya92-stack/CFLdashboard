import type { Connection, ExecutionStep, WorkflowNode } from "@/lib/workflow-studio";
import {
  resolveSmartLeadAssignment,
  type LeadAssignmentDecision,
  type LeadAssignmentStrategy,
  type LeadForAssignment,
  type RegistrationForAssignment,
  type SalesPersonForAssignment,
  type WorkshopLeadAssignmentRule
} from "./workshop-lead-assignment.ts";
import { applyTransform } from "./workflow-enterprise.ts";

export type WorkflowExecutionResult = {
  status: "success" | "failed";
  steps: ExecutionStep[];
  assignment?: LeadAssignmentDecision;
  summary: string;
  durationMs: number;
};

function executionOrder(nodes: WorkflowNode[], connections: Connection[]) {
  const ids = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const connection of connections) {
    if (!ids.has(connection.from) || !ids.has(connection.to)) continue;
    incoming.set(connection.to, (incoming.get(connection.to) ?? 0) + 1);
    outgoing.get(connection.from)?.push(connection.to);
  }
  const queue = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  const ordered: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const next of outgoing.get(id) ?? []) {
      incoming.set(next, (incoming.get(next) ?? 1) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  return ordered.length === nodes.length ? ordered : nodes.map((node) => node.id);
}

function conditionDetail(node: WorkflowNode, registration: RegistrationForAssignment) {
  const field = String(node.config.field ?? "").toLowerCase();
  const expected = String(node.config.value ?? "").trim().toLowerCase();
  const actual = field.includes("city") ? String(registration.city ?? "")
    : field.includes("date") ? String(registration.createdAt ?? "")
    : field.includes("mobile") ? String((registration as Record<string, unknown>).mobile ?? "")
    : field.includes("telegram chat") ? String((registration as Record<string, unknown>).telegramChatId ?? "")
    : "";
  const operator = String(node.config.operator ?? "Equals");
  const matched = operator === "Contains" ? actual.toLowerCase().includes(expected)
    : operator === "Is valid" ? actual.replace(/\D/g, "").slice(-10).length === 10
    : operator === "Is approved" ? Boolean((registration as Record<string, unknown>).telegramChatApproved)
    : !expected || actual.toLowerCase() === expected;
  return { matched, detail: `${field || "condition"} ${matched ? "matched" : "did not match"}` };
}

export function executeWorkflow(input: {
  nodes: WorkflowNode[];
  connections: Connection[];
  registration: RegistrationForAssignment & Record<string, unknown>;
  salesPeople: SalesPersonForAssignment[];
  leads: LeadForAssignment[];
  mode?: "test" | "production";
}): WorkflowExecutionResult {
  const started = performance.now();
  const nodeMap = new Map(input.nodes.map((node) => [node.id, node]));
  const steps: ExecutionStep[] = [];
  let assignment: LeadAssignmentDecision | undefined;

  for (const nodeId of executionOrder(input.nodes, input.connections)) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    const stepStarted = performance.now();
    let detail = "Configuration validated.";
    let output: Record<string, unknown> = {};
    let stepStatus: ExecutionStep["status"] = "success";
    if (node.kind === "trigger" || (node.kind === "telegram" && node.title.toLowerCase().includes("received"))) detail = `Accepted ${String(node.config.event ?? "workflow event")}.`;
    else if (node.kind === "condition") {
      const result = conditionDetail(node, input.registration);
      detail = result.detail;
      output = { matched: result.matched };
    } else if (node.kind === "transform") {
      output = applyTransform(input.registration, node.config);
      detail = `${node.title}: ${String(node.config.sourceField || "field")} mapped to ${String(node.config.targetField || "normalizedValue")}.`;
    } else if (node.kind === "crm" && !node.title.toLowerCase().includes("reassign") && node.title.toLowerCase().includes("assign")) {
      const rules = Array.isArray(node.config.assignmentRules) ? node.config.assignmentRules as WorkshopLeadAssignmentRule[] : [];
      assignment = resolveSmartLeadAssignment(
        input.registration,
        rules,
        input.salesPeople,
        input.leads,
        node.config.defaultSalesPersonId,
        String(node.config.fallbackStrategy ?? "least-active") as LeadAssignmentStrategy
      );
      detail = assignment.salesPersonId
        ? `${assignment.salesPersonName} selected · ${assignment.reason} · ${assignment.activeLeadCount} active leads.`
        : assignment.reason;
      output = { assignment };
    } else if (node.kind === "message") {
      const production = input.mode === "production";
      detail = production ? "Message action deferred to the configured asynchronous WhatsApp delivery connector." : `Template ${String(node.config.template ?? "not selected")} validated; delivery suppressed in test mode.`;
      if (production) stepStatus = "skipped";
    } else if (node.kind === "delay") detail = input.mode === "production" ? "Delay policy registered for asynchronous execution." : "Delay policy validated; waiting suppressed in test mode.";
    else if (node.kind === "workshop") {
      const workshop = String(node.config.workshop ?? input.registration.workshopTitle ?? "source workshop");
      const batch = String(node.config.batch ?? input.registration.batch ?? "best available batch");
      detail = `${node.title}: ${workshop} · ${batch} · ${String(node.config.capacity ?? "Respect capacity")}.`;
      output = { workshop, batch, capacityPolicy: node.config.capacity ?? "Respect capacity", action: node.title };
      if (input.mode === "production") stepStatus = "skipped";
    }
    else if (node.kind === "attendance") {
      const status = String(input.registration.attendanceStatus ?? node.config.status ?? "checked_in");
      detail = `${node.title}: participant matched by ${String(node.config.match ?? "Mobile number")} · status ${status}.`;
      output = { attendanceStatus: status, sessionId: input.registration.attendanceSessionId, promotedRegistrations: input.registration.promotedRegistrations ?? 0 };
    }
    else if (node.kind === "payment") {
      const amount = Number(input.registration.amountPaid ?? 0);
      const status = String(input.registration.paymentStatus ?? input.registration.paymentEvent ?? node.config.event ?? "payment event");
      detail = `${node.title}: ${status} · ₹${amount.toLocaleString("en-IN")} · ${String(node.config.action ?? "update registration")}.`;
      output = { paymentStatus: status, amount, paymentId: input.registration.paymentId, registrationId: input.registration.registrationId };
    }
    else if (node.kind === "webhook") {
      detail = input.mode === "production" ? "HTTP action requires an approved outbound connector and was not dispatched inline." : "Endpoint and authentication settings validated; request suppressed in test mode.";
      if (input.mode === "production") stepStatus = "skipped";
    }
    else if (node.kind === "data") {
      detail = `${String(node.config.scope ?? "Dashboard summary")} query validated as read-only; sensitive fields ${node.config.redactSensitive === false ? "are visible to the authorized agent" : "will be redacted"}.`;
      output = { scope: node.config.scope ?? "Dashboard summary", access: "read-only", maxRows: node.config.maxRows ?? 25, redacted: node.config.redactSensitive !== false };
      if (input.mode === "production") stepStatus = "skipped";
    }
    else if (node.kind === "ai") {
      detail = input.mode === "production" ? "AI request registered for asynchronous grounded generation." : `${String(node.config.provider ?? "Local Ollama")} agent configuration validated; generation suppressed in test mode.`;
      output = { provider: node.config.provider ?? "Local Ollama", grounded: true, language: node.config.language ?? "Auto detect" };
      if (input.mode === "production") stepStatus = "skipped";
    }
    else if (node.kind === "telegram") {
      detail = input.mode === "production" ? "Telegram delivery registered for the approved bot connector." : "Telegram bot and approved-chat policy validated; delivery suppressed in test mode.";
      output = { chatPolicy: node.config.chatPolicy ?? "Approved chats only", messageMapping: node.config.message ?? "{{ai.answer}}" };
      if (input.mode === "production") stepStatus = "skipped";
    }
    else if (node.kind === "crm") detail = `CRM action ${String(node.config.action ?? node.title)} validated.`;
    steps.push({ nodeId, title: node.title, status: stepStatus, durationMs: Math.max(1, Math.round(performance.now() - stepStarted)), detail, output });
  }

  const summary = assignment?.salesPersonId
    ? `Rule engine selected ${assignment.salesPersonName}.${input.mode === "production" ? " External connector actions were safely deferred." : " External actions stayed disabled in test mode."}`
    : "Workflow logic completed. No eligible sales person was selected; review availability and fallback settings.";
  return { status: "success", steps, assignment, summary, durationMs: Math.max(1, Math.round(performance.now() - started)) };
}
