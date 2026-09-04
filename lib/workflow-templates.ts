import type { Connection, NodeKind, WorkflowNode } from "./workflow-studio.ts";

export type WorkflowTemplate = { id: string; name: string; description: string; category: string; accent: string; nodes: WorkflowNode[]; connections: Connection[] };

const allowedKinds = new Set<NodeKind>(["trigger", "condition", "crm", "workshop", "attendance", "message", "payment", "delay", "webhook"]);
const node = (id: string, kind: NodeKind, title: string, x: number, config: Record<string, unknown>, subtitle = "Ready to configure"): WorkflowNode => ({ id, kind, title, subtitle, x, y: 280, config });
const connect = (ids: string[]) => ids.slice(1).map((id, index) => ({ id: `c-${ids[index]}-${id}`, from: ids[index], to: id }));

export const workflowTemplates: WorkflowTemplate[] = [
  { id: "smart-registration", name: "Smart registration routing", description: "Validate a registration, assign the best salesperson, reserve a batch and send confirmation.", category: "Registration", accent: "emerald", nodes: [node("trigger", "trigger", "Registration received", 80, { event: "New public registration", deduplicate: true }), node("validate", "condition", "Validate mobile", 340, { field: "Registration mobile", operator: "Is valid" }), node("assign", "crm", "Assign sales person", 600, { fallbackStrategy: "least-active", assignmentRules: [] }), node("batch", "workshop", "Assign workshop & batch", 860, { batch: "Best available batch", capacity: "Respect capacity" }), node("confirm", "message", "Send WhatsApp confirmation", 1120, { template: "cfl_registration_confirmation_v3", retry: true })], connections: connect(["trigger", "validate", "assign", "batch", "confirm"]) },
  { id: "attendance-recovery", name: "Attendance & no-show recovery", description: "React to attendance, promote eligible participants and create no-show recovery tasks.", category: "Attendance", accent: "teal", nodes: [node("attendance", "attendance", "Attendance submitted", 120, { event: "Attendance submitted", deduplicate: true }), node("status", "attendance", "Check attendee status", 400, { match: "Mobile number" }), node("promote", "workshop", "Promote waiting registration", 680, { capacity: "Respect capacity" }), node("followup", "crm", "Create no-show follow-up", 960, { action: "Create follow-up", taskType: "Call", due: "Today" })], connections: connect(["attendance", "status", "promote", "followup"]) },
  { id: "payment-recovery", name: "Payment recovery", description: "Reconcile captured payments and route failed payments into a sales recovery sequence.", category: "Payments", accent: "rose", nodes: [node("payment", "payment", "Payment failed", 160, { event: "Payment failed", provider: "Razorpay" }), node("delay", "delay", "Wait 15 minutes", 450, { amount: 15, unit: "Minutes" }), node("message", "message", "Send payment reminder", 740, { template: "cfl_payment_reminder", retry: true }), node("task", "crm", "Create payment follow-up", 1030, { taskType: "Payment Follow-up", priority: "High", due: "Today" })], connections: connect(["payment", "delay", "message", "task"]) },
  { id: "whatsapp-handoff", name: "WhatsApp sales handoff", description: "Detect a reply, classify intent and hand the conversation to the assigned salesperson.", category: "Messaging", accent: "sky", nodes: [node("reply", "trigger", "WhatsApp reply received", 160, { event: "WhatsApp reply received", deduplicate: true }), node("intent", "condition", "Check reply intent", 460, { field: "Message text", operator: "Contains", value: "call" }), node("handoff", "crm", "Hand off to sales inbox", 760, { action: "Create conversation task", priority: "High", due: "Immediately" }), node("ack", "message", "Send handoff acknowledgement", 1060, { messageType: "buttons", template: "cfl_sales_handoff" })], connections: connect(["reply", "intent", "handoff", "ack"]) },
  { id: "sla-rescue", name: "Lead SLA rescue", description: "Escalate missed first-response SLAs and automatically create urgent recovery actions.", category: "CRM", accent: "violet", nodes: [node("sla", "trigger", "Lead SLA breached", 180, { event: "Lead SLA breached", deduplicate: true }), node("priority", "condition", "Check lead priority", 480, { field: "Lead priority", operator: "Equals", value: "Hot" }), node("escalate", "crm", "Escalate to sales manager", 780, { action: "Escalate lead", priority: "Urgent", notifyManager: true }), node("followup", "crm", "Create CRM follow-up", 1080, { action: "Create follow-up", taskType: "Call", due: "Immediately" })], connections: connect(["sla", "priority", "escalate", "followup"]) }
];

export function parseWorkflowImport(text: string) {
  if (new TextEncoder().encode(text).length > 1_048_576) throw new Error("Workflow file exceeds the 1 MB import limit.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("Choose a valid workflow JSON file."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Workflow JSON must be an object.");
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.connections) || !value.nodes.length || value.nodes.length > 100 || value.connections.length > 250) throw new Error("Workflow must contain 1–100 nodes and no more than 250 connections.");
  const ids = new Set<string>();
  const nodes = value.nodes.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Every workflow node must be an object.");
    const candidate = item as Record<string, unknown>; const id = String(candidate.id || "").slice(0, 160); const kind = String(candidate.kind || "") as NodeKind;
    if (!id || ids.has(id) || !allowedKinds.has(kind)) throw new Error("Workflow contains an invalid or duplicate node.");
    ids.add(id);
    return { id, kind, title: String(candidate.title || "Untitled node").slice(0, 160), subtitle: String(candidate.subtitle || "Imported node").slice(0, 200), x: Math.max(0, Math.min(4000, Number(candidate.x) || 0)), y: Math.max(0, Math.min(2400, Number(candidate.y) || 0)), config: candidate.config && typeof candidate.config === "object" && !Array.isArray(candidate.config) ? candidate.config as Record<string, unknown> : {} } satisfies WorkflowNode;
  });
  const connectionIds = new Set<string>();
  const connections = value.connections.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Every connection must be an object.");
    const candidate = item as Record<string, unknown>; const id = String(candidate.id || "").slice(0, 160); const from = String(candidate.from || ""); const to = String(candidate.to || "");
    if (!id || connectionIds.has(id) || !ids.has(from) || !ids.has(to) || from === to) throw new Error("Workflow contains an invalid connection.");
    connectionIds.add(id);
    return { id, from, to, label: candidate.label ? String(candidate.label).slice(0, 80) : undefined, dashed: candidate.dashed === true } satisfies Connection;
  });
  return { name: String(value.name || "Imported workflow").slice(0, 160), active: false, note: String(value.note || "").slice(0, 10_000), nodes, connections };
}
