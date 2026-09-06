import {
  Activity,
  AlertCircle,
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
  Search,
  Send,
  Tag,
  UserPlus,
  UsersRound,
  Webhook,
  Workflow,
  Zap,
  Bot,
  Database,
  SendHorizontal,
} from "lucide-react";

export type NodeKind = "trigger" | "condition" | "transform" | "crm" | "workshop" | "attendance" | "message" | "payment" | "delay" | "webhook" | "ai" | "data" | "telegram";
export type RunStatus = "success" | "failed" | "running";
export type ExecutionNodeStatus = "idle" | RunStatus;
export type ConfigValue = unknown;
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
  steps?: ExecutionStep[];
};
export type ExecutionStep = {
  nodeId: string;
  title: string;
  status: "success" | "failed" | "skipped";
  durationMs: number;
  detail: string;
  output?: Record<string, unknown>;
};
export type WorkflowSalesPerson = {
  id: string;
  name: string;
  isActive: boolean;
  acceptingLeads: boolean;
  activeLeadCount: number;
  maxActiveLeads?: number;
};

export type WorkflowAttendanceSession = {
  id: string;
  label: string;
  published: boolean;
  workshopId: string;
  workshopName: string;
};
export type WorkflowWorkshop = { id: string; name: string };
export type WhatsAppAutomationOverview = {
  counts: Record<string, number>;
  retryDue: number;
  activity: Array<{ id: string; direction: "inbound" | "outbound"; mobile: string; status: string; templateName?: string; text: string; createdAt: string }>;
};
export type AttendanceAutomationOverview = {
  counts: { checkedIn: number; late: number; completed: number; promoted: number; noShowRisk: number };
  upcomingSessions: number;
  activity: Array<{ id: string; attendeeName: string; mobile: string; status: string; sessionTitle: string; workshopName: string; createdAt: string }>;
};
export type PaymentAutomationOverview = {
  counts: Record<string, number>;
  collected: number;
  outstanding: number;
  dueRegistrations: number;
  activity: Array<{ id: string; eventName: string; paymentId: string; registrationId: string; status: string; amount: number; currency: string; method: string; createdAt: string }>;
};
export type CrmAutomationOverview = {
  counts: { pending: number; overdue: number; today: number; slaRisk: number; unassigned: number };
  activity: Array<{ id: string; leadId: string; leadName: string; assignedTo: string; type: string; dueAt: string; bucket: string; note: string }>;
};
export type WorkflowVersionSummary = { version: number; createdBy: string; createdAt: string; nodeCount: number; restoredFromVersion?: number };
export type WorkflowReliabilityOverview = { total: number; success: number; failed: number; running: number; successRate: number; p95DurationMs: number; slowNodes: Array<{ title: string; averageMs: number; runs: number }> };
export type WorkflowScheduleOverview = { active: number; nextRunAt: string | null; schedules: Array<{ workflowId: string; workflowName: string; nodeId: string; title: string; frequency: string; timezone: string; nextRunAt: string | null }>; history: Array<{ workflowId: string; nodeId: string; scheduledFor: string; status: string; executionId: string; error: string; createdAt: string }> };
export type WorkflowGovernanceOverview = { currentVersion: number; approvedVersion: number | null; pending: number; approvals: Array<{ id: string; workflowVersion: number; status: "pending" | "approved" | "rejected" | "cancelled"; requestedBy: string; requestNote: string; reviewedBy: string; reviewNote: string; requestedAt: string; reviewedAt: string | null }>; audit: Array<{ id: string; workflowVersion: number | null; action: string; actor: string; detail: Record<string, unknown>; createdAt: string }> };
export type WorkflowIncidentOverview = { open: number; acknowledged: number; resolved: number; critical: number; incidents: Array<{ id: string; executionId: string; severity: "critical" | "high" | "medium" | "low"; status: "open" | "acknowledged" | "resolved"; title: string; errorMessage: string; failedNode: string; owner: string; createdAt: string; acknowledgedAt: string | null; resolvedAt: string | null }> };
export type WorkflowEnterpriseOverview = { roles: Array<{ id: string; name: string; permissions: string[]; members: number }>; environments: Array<{ id: "development" | "staging" | "production"; version: number; status: "ready" | "review" | "live"; promotedAt?: string; promotedBy?: string }>; templates: Array<{ id: string; name: string; language: string; status: "approved" | "pending" | "rejected"; variables: string[] }>; comments: Array<{ id: string; text: string; author: string; createdAt: string; resolved: boolean }>; alertRules: Array<{ id: string; name: string; severity: string; channel: string; enabled: boolean }>; folders: Array<{ id: string; name: string; color: string }>; workflowFolderId: string; tags: string[]; credentials: Array<{ id: string; name: string; provider: string; environment: string; maskedValue: string; updatedAt: string }>; workflowLibrary: Array<{ id: string; name: string; status: string; version: number; folderId: string; tags: string[]; updatedAt: string }>; analytics: { executions: number; successRate: number; averageDurationMs: number; estimatedConversions: number; revenueAttributed: number }; readiness: Array<{ key: string; label: string; ready: boolean }> };
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
    { kind: "payment", title: "Payment failed", subtitle: "Payment recovery trigger", icon: AlertCircle },
    { kind: "payment", title: "Part payment received", subtitle: "Installment trigger", icon: CircleDollarSign },
    { kind: "attendance", title: "Attendance submitted", subtitle: "Attendance trigger", icon: UsersRound },
    { kind: "attendance", title: "Late check-in detected", subtitle: "Attendance status trigger", icon: AlarmClock },
    { kind: "attendance", title: "No-show detected", subtitle: "Session follow-up trigger", icon: AlertCircle },
    { kind: "trigger", title: "Lead SLA breached", subtitle: "CRM risk trigger", icon: AlertCircle },
    { kind: "trigger", title: "Follow-up overdue", subtitle: "CRM task trigger", icon: AlarmClock },
    { kind: "delay", title: "Scheduled time", subtitle: "Schedule trigger", icon: AlarmClock },
    { kind: "trigger", title: "WhatsApp reply received", subtitle: "Inbound message trigger", icon: MessageCircle },
    { kind: "trigger", title: "WhatsApp message failed", subtitle: "Delivery status trigger", icon: AlertCircle },
  ] },
  { category: "Logic & routing", color: "text-indigo-700", items: [
    { kind: "condition", title: "Route by city / date", subtitle: "Rule branches", icon: GitBranch },
    { kind: "condition", title: "If / Else", subtitle: "Condition", icon: GitBranch },
    { kind: "condition", title: "Filter records", subtitle: "Filter", icon: ListFilter },
    { kind: "transform", title: "Map fields", subtitle: "Rename or copy values", icon: Code2 },
    { kind: "transform", title: "Format text", subtitle: "Trim or change case", icon: Code2 },
    { kind: "transform", title: "Convert to number", subtitle: "Safe numeric conversion", icon: Code2 },
  ] },
  { category: "CRM & sales", color: "text-violet-700", items: [
    { kind: "crm", title: "Assign sales person", subtitle: "Smart assignment", icon: UserPlus },
    { kind: "crm", title: "Create CRM follow-up", subtitle: "CRM activity", icon: Activity },
    { kind: "crm", title: "Update lead status", subtitle: "CRM update", icon: RefreshCw },
    { kind: "crm", title: "Add lead tag", subtitle: "CRM tag", icon: Tag },
    { kind: "crm", title: "Escalate to sales manager", subtitle: "SLA escalation", icon: AlertCircle },
    { kind: "crm", title: "Reassign inactive lead", subtitle: "Workload recovery", icon: RefreshCw },
  ] },
  { category: "Workshop", color: "text-sky-700", items: [
    { kind: "workshop", title: "Find workshop repeater", subtitle: "Search repeaters in one workshop", icon: Search },
    { kind: "workshop", title: "Find waiting registration", subtitle: "Match existing or new registration", icon: Search },
    { kind: "workshop", title: "Confirm waiting registration", subtitle: "Attendance-qualified promotion", icon: Check },
    { kind: "workshop", title: "Assign workshop", subtitle: "Workshop action", icon: Workflow },
    { kind: "workshop", title: "Assign batch", subtitle: "Batch action", icon: LayoutGrid },
    { kind: "workshop", title: "Add to waiting list", subtitle: "Capacity action", icon: UsersRound },
    { kind: "workshop", title: "Move to another batch", subtitle: "Batch transfer action", icon: RefreshCw },
  ] },
  { category: "AI & data", color: "text-fuchsia-700", items: [
    { kind: "data", title: "Query dashboard data", subtitle: "Permission-aware read-only lookup", icon: Database },
    { kind: "ai", title: "AI data agent", subtitle: "Understand question and compose answer", icon: Bot },
  ] },
  { category: "Telegram", color: "text-blue-700", items: [
    { kind: "telegram", title: "Telegram message received", subtitle: "Bot command trigger", icon: SendHorizontal },
    { kind: "telegram", title: "Send Telegram reply", subtitle: "Reply to authorized chat", icon: SendHorizontal },
  ] },
  { category: "Attendance", color: "text-teal-700", items: [
    { kind: "attendance", title: "Mark attendance", subtitle: "Attendance action", icon: Check },
    { kind: "attendance", title: "Check attendee status", subtitle: "Attendance lookup", icon: Eye },
    { kind: "attendance", title: "Mark no-show", subtitle: "Attendance status action", icon: AlertCircle },
    { kind: "crm", title: "Create no-show follow-up", subtitle: "Sales recovery action", icon: Activity },
  ] },
  { category: "Messages", color: "text-emerald-700", items: [
    { kind: "message", title: "Send WhatsApp template", subtitle: "WhatsApp Cloud API", icon: MessageCircle },
    { kind: "message", title: "Send SMS notification", subtitle: "Messaging", icon: Bell },
    { kind: "message", title: "Send internal alert", subtitle: "Team notification", icon: Send },
    { kind: "message", title: "Send interactive WhatsApp", subtitle: "Buttons or list message", icon: MessageCircle },
    { kind: "crm", title: "Hand off to sales inbox", subtitle: "Human conversation handoff", icon: UserPlus },
  ] },
  { category: "Payments", color: "text-rose-700", items: [
    { kind: "payment", title: "Update payment status", subtitle: "Registration finance action", icon: RefreshCw },
    { kind: "payment", title: "Create payment follow-up", subtitle: "Outstanding recovery action", icon: Activity },
    { kind: "payment", title: "Send payment receipt", subtitle: "Receipt notification action", icon: Send },
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
  { id: "assign", kind: "crm", title: "Assign sales coach", subtitle: "City · date · workload", x: 770, y: 132, config: { strategy: "City + date + workload", fallbackStrategy: "least-active", defaultSalesPersonId: "", assignmentRules: [], continueOnError: true } },
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
  transform: { border: "border-cyan-400", icon: "text-cyan-700", soft: "bg-cyan-50", dot: "bg-cyan-500" },
  crm: { border: "border-violet-400", icon: "text-violet-700", soft: "bg-violet-50", dot: "bg-violet-500" },
  workshop: { border: "border-sky-400", icon: "text-sky-700", soft: "bg-sky-50", dot: "bg-sky-500" },
  attendance: { border: "border-teal-400", icon: "text-teal-700", soft: "bg-teal-50", dot: "bg-teal-500" },
  message: { border: "border-emerald-500", icon: "text-emerald-700", soft: "bg-emerald-50", dot: "bg-emerald-500" },
  payment: { border: "border-rose-400", icon: "text-rose-700", soft: "bg-rose-50", dot: "bg-rose-500" },
  delay: { border: "border-amber-400", icon: "text-amber-700", soft: "bg-amber-50", dot: "bg-amber-500" },
  webhook: { border: "border-slate-400", icon: "text-slate-700", soft: "bg-slate-100", dot: "bg-slate-500" },
  ai: { border: "border-fuchsia-400", icon: "text-fuchsia-700", soft: "bg-fuchsia-50", dot: "bg-fuchsia-500" },
  data: { border: "border-cyan-500", icon: "text-cyan-700", soft: "bg-cyan-50", dot: "bg-cyan-500" },
  telegram: { border: "border-blue-400", icon: "text-blue-700", soft: "bg-blue-50", dot: "bg-blue-500" },
};

export function defaultConfigFor(kind: NodeKind): Record<string, ConfigValue> {
  if (kind === "message") return { credential: "Meta Business · Coach For Life", template: "Select approved template", recipient: "{{registration.mobile}}", retry: true, attempts: 3 };
  if (kind === "condition") return { field: "Registration city", operator: "Equals", value: "Ahmedabad", branchA: "Matches", branchB: "Otherwise" };
  if (kind === "transform") return { sourceField: "fullName", targetField: "normalizedName", operation: "trim" };
  if (kind === "crm") return { strategy: "City + date + workload", fallbackStrategy: "least-active", defaultSalesPersonId: "", assignmentRules: [], continueOnError: true };
  if (kind === "workshop") return { workshop: "Business Growth Blueprint", batch: "Best available batch", capacity: "Respect capacity" };
  if (kind === "attendance") return { source: "Workshop attendance", status: "Present", match: "Mobile number" };
  if (kind === "payment") return { provider: "Razorpay", event: "Payment completed", action: "Update registration payment", reconcile: true };
  if (kind === "delay") return { amount: 10, unit: "Minutes", businessHours: true };
  if (kind === "trigger") return { event: "New public registration", form: "All active forms", deduplicate: true };
  if (kind === "webhook") return { method: "POST", url: "https://", authentication: "Stored credential" };
  if (kind === "data") return { scope: "Dashboard summary", access: "Read only", maxRows: 25, redactSensitive: true };
  if (kind === "ai") return { provider: "Local Ollama", model: "From server settings", instruction: "Answer only from the connected dashboard data.", language: "Auto detect", citations: true };
  if (kind === "telegram") return { credential: "Telegram bot · Primary", chatPolicy: "Approved chats only", message: "{{ai.answer}}" };
  return { action: "Update record", continueOnError: false };
}

export function defaultConfigForItem(item: Pick<CatalogItem, "kind" | "title">) {
  const config = defaultConfigFor(item.kind);
  if (item.title === "WhatsApp reply received") return { ...config, event: "WhatsApp reply received", deduplicate: true };
  if (item.title === "Convert to number") return { ...config, sourceField: "amount", targetField: "amountNumber", operation: "number" };
  if (item.title === "Format text") return { ...config, sourceField: "fullName", targetField: "formattedName", operation: "uppercase" };
  if (item.title === "WhatsApp message failed") return { ...config, event: "WhatsApp message failed", deduplicate: true };
  if (item.title === "Send interactive WhatsApp") return { ...config, messageType: "buttons", button1: "Confirm", button2: "Talk to sales", template: "Select approved template" };
  if (item.title === "Hand off to sales inbox") return { action: "Create conversation task", priority: "High", due: "Immediately", continueOnError: false };
  if (item.title === "Attendance submitted") return { ...config, event: "Attendance submitted", source: "All active attendance forms", deduplicate: true };
  if (item.title === "Late check-in detected") return { ...config, event: "Late attendance submitted", source: "All active attendance forms", deduplicate: true };
  if (item.title === "No-show detected") return { ...config, event: "Attendance no-show detected", graceMinutes: 30, deduplicate: true };
  if (item.title === "Mark no-show") return { ...config, action: "Mark no-show", status: "Absent", createFollowUp: true };
  if (item.title === "Create no-show follow-up") return { action: "Create no-show follow-up", priority: "High", due: "Today", reason: "Workshop no-show", continueOnError: true };
  if (item.title === "Move to another batch") return { ...config, batch: "Best available future batch", capacity: "Respect capacity", preserveSource: true };
  if (item.title === "Payment completed") return { event: "Payment completed", provider: "Razorpay", deduplicate: true };
  if (item.title === "Payment failed") return { event: "Payment failed", provider: "Razorpay", deduplicate: true };
  if (item.title === "Part payment received") return { event: "Payment authorized", paymentType: "Part payment", deduplicate: true };
  if (item.title === "Update payment status") return { action: "Update registration payment", status: "Paid when due is zero", reconcile: true };
  if (item.title === "Create payment follow-up") return { action: "Create payment follow-up", due: "Today", priority: "High", assignTo: "Registration owner" };
  if (item.title === "Send payment receipt") return { action: "Send payment receipt", channel: "WhatsApp", template: "cfl_payment_receipt", includeBalance: true };
  if (item.title === "Lead SLA breached") return { event: "Lead SLA breached", risk: "Any SLA risk", deduplicate: true };
  if (item.title === "Follow-up overdue") return { event: "Follow-up overdue", overdueMinutes: 1, deduplicate: true };
  if (item.title === "Escalate to sales manager") return { action: "Escalate lead", priority: "Urgent", notify: "Sales manager", due: "Immediately" };
  if (item.title === "Reassign inactive lead") return { action: "Reassign lead", inactivityHours: 24, strategy: "Least active leads", preserveHistory: true };
  if (item.title === "Scheduled time") return { scheduleEnabled: true, frequency: "daily", time: "09:00", timezone: "Asia/Kolkata", weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"] };
  if (item.title === "Schedule for date") return { scheduleEnabled: true, frequency: "once", scheduledAt: "", timezone: "Asia/Kolkata" };
  if (item.title === "Find waiting registration") return { ...config, workshop: "Healthy Forever", match: "Mobile number", registrationMode: "Existing or new", status: "Waiting only" };
  if (item.title === "Find workshop repeater") return { workshopId: "", workshop: "", match: "Mobile number", repeaterOnly: true };
  if (item.title === "Confirm waiting registration") return { ...config, workshop: "Healthy Forever", capacity: "Respect capacity", action: "Confirm registration", confirmationSource: "Attendance" };
  if (item.title === "Telegram message received") return { ...config, event: "Telegram message received", chatPolicy: "Approved chats only", deduplicate: true };
  if (item.title === "Send Telegram reply") return { ...config, message: "{{ai.answer}}", parseMode: "Plain text", splitLongMessages: true };
  return config;
}

export function cloneSnapshot(nodes: WorkflowNode[], connections: Connection[]): Snapshot {
  return { nodes: nodes.map((node) => ({ ...node, config: { ...node.config } })), connections: connections.map((connection) => ({ ...connection })) };
}

export function validateWorkflow(nodes: WorkflowNode[], connections: Connection[]) {
  const issues: Array<{ level: "error" | "warning"; text: string }> = [];
  const isEventTrigger = (node: WorkflowNode) => node.kind === "trigger"
    || (node.kind === "attendance" && Boolean(node.config.event))
    || (node.kind === "payment" && Boolean(node.config.event))
    || (node.kind === "telegram" && node.title.toLowerCase().includes("received"))
    || (node.kind === "delay" && node.config.scheduleEnabled === true);
  if (!nodes.some(isEventTrigger)) issues.push({ level: "error", text: "Add at least one trigger before activation." });
  const ids = new Set(nodes.map((node) => node.id));
  if (connections.some((connection) => !ids.has(connection.from) || !ids.has(connection.to))) issues.push({ level: "error", text: "One or more connections point to a missing node." });
  const noInput = nodes.filter((node) => !isEventTrigger(node) && !connections.some((connection) => connection.to === node.id));
  if (noInput.length) issues.push({ level: "warning", text: `${noInput.length} node${noInput.length > 1 ? "s are" : " is"} not connected to an input.` });
  if (nodes.some((node) => node.kind === "message" && !String(node.config.recipient ?? "").trim())) issues.push({ level: "error", text: "A message node is missing its recipient mapping." });
  if (nodes.some((node) => node.kind === "workshop" && node.config.repeaterOnly === true && !String(node.config.workshopId ?? "").trim())) issues.push({ level: "error", text: "Select a workshop for the repeater lookup node." });
  return issues;
}
