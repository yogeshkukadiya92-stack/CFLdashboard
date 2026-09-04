import {
  Activity,
  AlarmClock,
  Bell,
  Check,
  CircleDollarSign,
  Code2,
  Eye,
  GitBranch,
  LayoutGrid,
  ListFilter,
  MessageCircle,
  RefreshCw,
  Send,
  Tag,
  UserPlus,
  UsersRound,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";

export type NodeKind = "trigger" | "condition" | "crm" | "workshop" | "attendance" | "message" | "payment" | "delay" | "webhook";
export type RunStatus = "success" | "failed" | "running";
export type ExecutionNodeStatus = "idle" | RunStatus;
export type ConfigValue = string | number | boolean;
export type WorkflowNode = {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  config: Record<string, ConfigValue>;
};
export type Connection = { id: string; from: string; to: string; label?: string; dashed?: boolean };
export type RunRow = {
  id: string;
  status: RunStatus;
  started: string;
  duration: string;
  trigger: string;
  participant: string;
  progress: string;
  detail: string;
};
export type CatalogItem = { kind: NodeKind; title: string; subtitle: string; icon: typeof Zap };
export type Snapshot = { nodes: WorkflowNode[]; connections: Connection[] };
export type PickerContext = { mode: "add" } | { mode: "connect"; fromId: string } | { mode: "insert"; connectionId: string };

export const NODE_WIDTH = 188;
export const NODE_HEIGHT = 112;
export const CANVAS_WIDTH = 1960;
export const CANVAS_HEIGHT = 820;
export const WORKFLOW_STORAGE_KEY = "cfl_visual_workflow_v2";

export const catalog: Array<{ category: string; color: string; items: CatalogItem[] }> = [
  { category: "Triggers", color: "text-emerald-700", items: [
    { kind: "trigger", title: "Registration received", subtitle: "Registration trigger", icon: UserPlus },
    { kind: "payment", title: "Payment completed", subtitle: "Payment trigger", icon: CircleDollarSign },
    { kind: "attendance", title: "Attendance submitted", subtitle: "Attendance trigger", icon: UsersRound },
    { kind: "delay", title: "Scheduled time", subtitle: "Schedule trigger", icon: AlarmClock },
  ] },
  { category: "Logic & routing", color: "text-indigo-700", items: [
    { kind: "condition", title: "Route by city / date", subtitle: "Rule branches", icon: GitBranch },
    { kind: "condition", title: "If / Else", subtitle: "Condition", icon: GitBranch },
    { kind: "condition", title: "Filter records", subtitle: "Filter", icon: ListFilter },
  ] },
  { category: "CRM & sales", color: "text-violet-700", items: [
    { kind: "crm", title: "Assign sales person", subtitle: "Smart assignment", icon: UserPlus },
    { kind: "crm", title: "Create CRM follow-up", subtitle: "CRM activity", icon: Activity },
    { kind: "crm", title: "Update lead status", subtitle: "CRM update", icon: RefreshCw },
    { kind: "crm", title: "Add lead tag", subtitle: "CRM tag", icon: Tag },
  ] },
  { category: "Workshop", color: "text-sky-700", items: [
    { kind: "workshop", title: "Assign workshop", subtitle: "Workshop action", icon: Workflow },
    { kind: "workshop", title: "Assign batch", subtitle: "Batch action", icon: LayoutGrid },
    { kind: "workshop", title: "Add to waiting list", subtitle: "Capacity action", icon: UsersRound },
  ] },
  { category: "Attendance", color: "text-teal-700", items: [
    { kind: "attendance", title: "Mark attendance", subtitle: "Attendance action", icon: Check },
    { kind: "attendance", title: "Check attendee status", subtitle: "Attendance lookup", icon: Eye },
  ] },
  { category: "Messages", color: "text-emerald-700", items: [
    { kind: "message", title: "Send WhatsApp template", subtitle: "WhatsApp Cloud API", icon: MessageCircle },
    { kind: "message", title: "Send SMS notification", subtitle: "Messaging", icon: Bell },
    { kind: "message", title: "Send internal alert", subtitle: "Team notification", icon: Send },
  ] },
  { category: "Timing & integrations", color: "text-amber-700", items: [
    { kind: "delay", title: "Wait / Delay", subtitle: "Timing", icon: AlarmClock },
    { kind: "delay", title: "Schedule for date", subtitle: "Timing", icon: AlarmClock },
    { kind: "webhook", title: "HTTP request", subtitle: "Integration", icon: Code2 },
    { kind: "webhook", title: "Webhook response", subtitle: "Integration", icon: Webhook },
  ] },
];

export const initialNodes: WorkflowNode[] = [
  { id: "registration", kind: "trigger", title: "Registration webhook", subtitle: "Registration received", x: 64, y: 310, config: { event: "New public registration", form: "All active forms", deduplicate: true } },
  { id: "validate", kind: "condition", title: "Validate registration", subtitle: "Required fields + mobile", x: 292, y: 310, config: { field: "Registration mobile", operator: "Is valid", value: "India mobile number", branchA: "Valid", branchB: "Invalid" } },
  { id: "route", kind: "condition", title: "Route by city & date", subtitle: "2 matching branches", x: 520, y: 310, config: { field: "Registration city", operator: "Equals", value: "Ahmedabad", branchA: "Ahmedabad", branchB: "Other cities" } },
  { id: "assign", kind: "crm", title: "Assign sales coach", subtitle: "City · date · workload", x: 770, y: 132, config: { strategy: "City + date + workload", fallback: "Round robin", salesperson: "Auto-select active sales person", continueOnError: true } },
  { id: "batch", kind: "workshop", title: "Assign workshop & batch", subtitle: "Business Growth Blueprint", x: 1000, y: 132, config: { workshop: "Business Growth Blueprint", batch: "Best available batch", capacity: "Respect capacity" } },
  { id: "wait", kind: "delay", title: "Wait 10 minutes", subtitle: "Business-hours aware", x: 1230, y: 132, config: { amount: 10, unit: "Minutes", businessHours: true } },
  { id: "whatsapp", kind: "message", title: "WhatsApp confirmation", subtitle: "Approved template · 4 variables", x: 1460, y: 132, config: { credential: "Meta Business · Coach For Life", template: "cfl_registration_confirmation_v3", recipient: "{{registration.mobile}}", retry: true, attempts: 3, interval: "Exponential backoff" } },
  { id: "waiting", kind: "workshop", title: "Add to waiting list", subtitle: "Preserve referral source", x: 770, y: 488, config: { workshop: "Business Growth Blueprint", batch: "Selected batch", capacity: "Waiting list" } },
  { id: "waiting-message", kind: "message", title: "Send waiting-list notice", subtitle: "Approved WhatsApp template", x: 1000, y: 488, config: { credential: "Meta Business · Coach For Life", template: "cfl_waiting_list_v2", recipient: "{{registration.mobile}}", retry: true, attempts: 3 } },
  { id: "followup", kind: "crm", title: "Create CRM follow-up", subtitle: "Owner + next action", x: 1690, y: 310, config: { action: "Create follow-up", due: "Tomorrow at 10:00 AM", continueOnError: false } },
];

export const initialConnections: Connection[] = [
  { id: "c-registration-validate", from: "registration", to: "validate" },
  { id: "c-validate-route", from: "validate", to: "route" },
  { id: "c-route-assign", from: "route", to: "assign", label: "Ahmedabad" },
  { id: "c-route-waiting", from: "route", to: "waiting", label: "Other cities" },
  { id: "c-assign-batch", from: "assign", to: "batch" },
  { id: "c-batch-wait", from: "batch", to: "wait" },
  { id: "c-wait-whatsapp", from: "wait", to: "whatsapp" },
  { id: "c-whatsapp-followup", from: "whatsapp", to: "followup" },
  { id: "c-waiting-message", from: "waiting", to: "waiting-message", dashed: true },
  { id: "c-waiting-followup", from: "waiting-message", to: "followup", dashed: true },
];

export const initialRuns: RunRow[] = [
  { id: "EXE-2418", status: "success", started: "Today, 10:42 AM", duration: "04.2s", trigger: "Registration webhook", participant: "Riya Shah · Ahmedabad", progress: "8 / 8 nodes", detail: "Sales coach assigned, batch reserved, WhatsApp delivered and CRM follow-up created." },
  { id: "EXE-2417", status: "running", started: "Today, 10:39 AM", duration: "Running", trigger: "Registration webhook", participant: "Dhruv Patel · Surat", progress: "5 / 7 nodes", detail: "Waiting for the WhatsApp provider response." },
  { id: "EXE-2416", status: "failed", started: "Today, 10:21 AM", duration: "01.8s", trigger: "Payment completed", participant: "Neha Mehta · Rajkot", progress: "4 / 8 nodes", detail: "WhatsApp template rejected the venue variable. Retry policy is scheduled." },
  { id: "EXE-2415", status: "success", started: "Today, 09:58 AM", duration: "03.7s", trigger: "Registration webhook", participant: "Aarav Desai · Ahmedabad", progress: "8 / 8 nodes", detail: "Completed without warnings." },
];

export const colorByKind: Record<NodeKind, { border: string; icon: string; soft: string; dot: string }> = {
  trigger: { border: "border-emerald-400", icon: "text-emerald-700", soft: "bg-emerald-50", dot: "bg-emerald-500" },
  condition: { border: "border-indigo-400", icon: "text-indigo-700", soft: "bg-indigo-50", dot: "bg-indigo-500" },
  crm: { border: "border-violet-400", icon: "text-violet-700", soft: "bg-violet-50", dot: "bg-violet-500" },
  workshop: { border: "border-sky-400", icon: "text-sky-700", soft: "bg-sky-50", dot: "bg-sky-500" },
  attendance: { border: "border-teal-400", icon: "text-teal-700", soft: "bg-teal-50", dot: "bg-teal-500" },
  message: { border: "border-emerald-500", icon: "text-emerald-700", soft: "bg-emerald-50", dot: "bg-emerald-500" },
  payment: { border: "border-rose-400", icon: "text-rose-700", soft: "bg-rose-50", dot: "bg-rose-500" },
  delay: { border: "border-amber-400", icon: "text-amber-700", soft: "bg-amber-50", dot: "bg-amber-500" },
  webhook: { border: "border-slate-400", icon: "text-slate-700", soft: "bg-slate-100", dot: "bg-slate-500" },
};

export function defaultConfigFor(kind: NodeKind): Record<string, ConfigValue> {
  if (kind === "message") return { credential: "Meta Business · Coach For Life", template: "Select approved template", recipient: "{{registration.mobile}}", retry: true, attempts: 3 };
  if (kind === "condition") return { field: "Registration city", operator: "Equals", value: "Ahmedabad", branchA: "Matches", branchB: "Otherwise" };
  if (kind === "crm") return { strategy: "Round robin", fallback: "Least active leads", continueOnError: true };
  if (kind === "workshop") return { workshop: "Business Growth Blueprint", batch: "Best available batch", capacity: "Respect capacity" };
  if (kind === "attendance") return { source: "Workshop attendance", status: "Present", match: "Mobile number" };
  if (kind === "delay") return { amount: 10, unit: "Minutes", businessHours: true };
  if (kind === "trigger") return { event: "New public registration", form: "All active forms", deduplicate: true };
  if (kind === "webhook") return { method: "POST", url: "https://", authentication: "Stored credential" };
  return { action: "Update record", continueOnError: false };
}

export function cloneSnapshot(nodes: WorkflowNode[], connections: Connection[]): Snapshot {
  return { nodes: nodes.map((node) => ({ ...node, config: { ...node.config } })), connections: connections.map((connection) => ({ ...connection })) };
}

export function validateWorkflow(nodes: WorkflowNode[], connections: Connection[]) {
  const issues: Array<{ level: "error" | "warning"; text: string }> = [];
  if (!nodes.some((node) => node.kind === "trigger")) issues.push({ level: "error", text: "Add at least one trigger before activation." });
  const ids = new Set(nodes.map((node) => node.id));
  if (connections.some((connection) => !ids.has(connection.from) || !ids.has(connection.to))) issues.push({ level: "error", text: "One or more connections point to a missing node." });
  const noInput = nodes.filter((node) => node.kind !== "trigger" && !connections.some((connection) => connection.to === node.id));
  if (noInput.length) issues.push({ level: "warning", text: `${noInput.length} node${noInput.length > 1 ? "s are" : " is"} not connected to an input.` });
  if (nodes.some((node) => node.kind === "message" && !String(node.config.recipient ?? "").trim())) issues.push({ level: "error", text: "A message node is missing its recipient mapping." });
  return issues;
}
