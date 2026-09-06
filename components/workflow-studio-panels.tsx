"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Braces,
  Check,
  CheckCircle2,
  Copy,
  History,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode, type RefObject } from "react";
import {
  colorByKind,
  type CatalogItem,
  type ConfigValue,
  type ExecutionNodeStatus,
  type PickerContext,
  type RunRow,
  type RunStatus,
  type WorkflowSalesPerson,
  type WorkflowAttendanceSession,
  type WorkflowNode,
  type WorkflowVersionSummary,
} from "@/lib/workflow-studio";
import { resolveSmartLeadAssignment, type LeadAssignmentStrategy, type WorkshopLeadAssignmentRule } from "@/lib/workshop-lead-assignment";

export type InspectorTab = "parameters" | "settings" | "output";

export function ParametersPanel({ node, onChange, onRename, onTest, salesPeople = [], attendanceSessions = [] }: {
  node: WorkflowNode;
  onChange: (key: string, value: ConfigValue) => void;
  onRename: (value: string) => void;
  onTest: () => void;
  salesPeople?: WorkflowSalesPerson[];
  attendanceSessions?: WorkflowAttendanceSession[];
}) {
  const workshops = useMemo(() => Array.from(new Map(attendanceSessions
    .filter((session) => session.workshopId && session.workshopName)
    .map((session) => [session.workshopId, { id: session.workshopId, name: session.workshopName }])).values()), [attendanceSessions]);
  const isAssignNode = node.kind === "crm" && !node.title.toLowerCase().includes("reassign") && node.title.toLowerCase().includes("assign");
  const isCrmAction = node.kind === "crm" && !isAssignNode;
  const isScheduleNode = node.kind === "delay" && (node.config.scheduleEnabled === true || ["Scheduled time", "Schedule for date"].includes(node.title));
  const handled = ["message", "condition", "workshop", "attendance", "payment", "delay", "trigger", "webhook", "ai", "data", "telegram"].includes(node.kind) || isAssignNode || isCrmAction;
  return <div className="space-y-4">
    <Field label="Node name"><input className="workflow-input" onChange={(event) => onRename(event.target.value)} value={node.title} /></Field>

    {node.kind === "message" ? <>
      <Field hint="Settings → Integrations" label="WhatsApp credential"><select className="workflow-input" onChange={(event) => onChange("credential", event.target.value)} value={String(node.config.credential ?? "")}><option>Meta Business · Coach For Life</option><option>OpenWA · Primary</option><option>Choose credential</option></select></Field>
      <Field hint="Approved templates only" label="Message template"><select className="workflow-input" onChange={(event) => onChange("template", event.target.value)} value={String(node.config.template ?? "")}><option>cfl_registration_confirmation_v3</option><option>cfl_waiting_list_v2</option><option>cfl_workshop_reminder_v4</option><option>Select approved template</option></select></Field>
      <Field label="Recipient mapping"><div className="relative"><Braces className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-indigo-500" /><input className="workflow-input pl-9 font-mono text-[10px]" onChange={(event) => onChange("recipient", event.target.value)} value={String(node.config.recipient ?? "")} /></div></Field>
      <Field label="Message experience"><select className="workflow-input" onChange={(event) => onChange("messageType", event.target.value)} value={String(node.config.messageType ?? "template")}><option value="template">Approved template</option><option value="buttons">Interactive buttons</option><option value="list">Interactive list</option></select></Field>
      {node.config.messageType === "buttons" ? <div className="grid grid-cols-2 gap-2"><Field label="Primary button"><input className="workflow-input" maxLength={20} onChange={(event) => onChange("button1", event.target.value)} value={String(node.config.button1 ?? "Confirm")} /></Field><Field label="Secondary button"><input className="workflow-input" maxLength={20} onChange={(event) => onChange("button2", event.target.value)} value={String(node.config.button2 ?? "Talk to sales")} /></Field></div> : null}
      <ToggleField checked={node.config.trackDelivery !== false} label="Track sent, delivered, read and failed" onChange={(value) => onChange("trackDelivery", value)} />
      <Field label="Failure path"><select className="workflow-input" onChange={(event) => onChange("failureAction", event.target.value)} value={String(node.config.failureAction ?? "retry")}><option value="retry">Retry with exponential backoff</option><option value="sales-task">Create salesperson task</option><option value="continue">Continue without delivery</option></select></Field>
      <Field label="Template variables"><div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">{[
        ["1 · First name", "{{registration.first_name}}"],
        ["2 · Workshop", "{{workshop.title}}"],
        ["3 · Date", "{{workshop.date}}"],
        ["4 · Venue", "{{workshop.venue}}"],
      ].map(([label, value]) => <div className="grid grid-cols-[88px_1fr] items-center gap-2" key={label}><span className="text-[9px] font-black text-slate-500">{label}</span><code className="truncate rounded-lg bg-white px-2 py-1.5 text-[9px] font-bold text-indigo-700">{value}</code></div>)}</div></Field>
      <Field label="Live preview"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><div className="rounded-xl bg-white p-3 text-[10px] font-semibold leading-4 text-slate-600 shadow-sm">Hi Riya 👋<br /><br />Your seat for <strong>Business Growth Blueprint</strong> is confirmed.<br />12 Sep · Ahmedabad<br /><br /><span className="text-emerald-700">View workshop details</span></div><p className="mt-2 text-[8px] font-bold text-emerald-700">Simulated preview · no message sent</p></div></Field>
    </> : null}

    {node.kind === "condition" ? <>
      <Field label="Field"><select className="workflow-input" onChange={(event) => onChange("field", event.target.value)} value={String(node.config.field ?? "")}><option>Registration mobile</option><option>Registration city</option><option>Registration date</option><option>Payment status</option><option>Attendance status</option><option>Workshop capacity</option></select></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Operator"><select className="workflow-input" onChange={(event) => onChange("operator", event.target.value)} value={String(node.config.operator ?? "")}><option>Equals</option><option>Contains</option><option>Is valid</option><option>Is approved</option><option>Is after</option><option>Is before</option></select></Field><Field label="Value"><input className="workflow-input" onChange={(event) => onChange("value", event.target.value)} value={String(node.config.value ?? "")} /></Field></div>
      <div className="grid grid-cols-2 gap-2"><Field label="Branch A"><input className="workflow-input" onChange={(event) => onChange("branchA", event.target.value)} value={String(node.config.branchA ?? "Matches")} /></Field><Field label="Branch B"><input className="workflow-input" onChange={(event) => onChange("branchB", event.target.value)} value={String(node.config.branchB ?? "Otherwise")} /></Field></div>
    </> : null}
    {node.kind === "transform" ? <><Field label="Source field"><input className="workflow-input" onChange={(event) => onChange("sourceField", event.target.value)} value={String(node.config.sourceField ?? "fullName")} /></Field><Field label="Target field"><input className="workflow-input" onChange={(event) => onChange("targetField", event.target.value)} value={String(node.config.targetField ?? "normalizedName")} /></Field><Field label="Operation"><select className="workflow-input" onChange={(event) => onChange("operation", event.target.value)} value={String(node.config.operation ?? "trim")}><option value="trim">Trim whitespace</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option><option value="number">Convert to number</option></select></Field></> : null}

    {isAssignNode ? <>
      <Field hint="First matching rule wins" label="Assignment strategy"><select className="workflow-input" onChange={(event) => onChange("strategy", event.target.value)} value={String(node.config.strategy ?? "Round robin")}><option>City + date + workload</option><option>City-based rules</option><option>Date-based rules</option><option>Round robin</option><option>Least active leads</option><option>Fixed sales person</option></select></Field>
      <Field label="Default sales person"><select className="workflow-input" onChange={(event) => onChange("defaultSalesPersonId", event.target.value)} value={String(node.config.defaultSalesPersonId ?? "")}><option value="">Auto-select available sales person</option>{salesPeople.map((person) => <option disabled={!person.isActive || !person.acceptingLeads} key={person.id} value={person.id}>{person.name} · {person.activeLeadCount} active{!person.acceptingLeads ? " · paused" : ""}</option>)}</select></Field>
      <Field label="Fallback rule"><select className="workflow-input" onChange={(event) => onChange("fallbackStrategy", event.target.value)} value={String(node.config.fallbackStrategy ?? "least-active")}><option value="least-active">Least active leads</option><option value="round-robin">Round robin</option><option value="unassigned">Keep unassigned</option></select></Field>
      <LeadAssignmentRuleBuilder node={node} onChange={onChange} salesPeople={salesPeople} />
    </> : null}

    {isCrmAction ? <>
      <Field label="CRM action"><select className="workflow-input" onChange={(event) => onChange("action", event.target.value)} value={String(node.config.action ?? "Create follow-up")}><option>Create follow-up</option><option>Update lead status</option><option>Add lead tag</option><option>Escalate lead</option><option>Reassign lead</option><option>Create conversation task</option></select></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Priority"><select className="workflow-input" onChange={(event) => onChange("priority", event.target.value)} value={String(node.config.priority ?? "High")}><option>Normal</option><option>High</option><option>Urgent</option></select></Field><Field label="Due"><select className="workflow-input" onChange={(event) => onChange("due", event.target.value)} value={String(node.config.due ?? "Today")}><option>Immediately</option><option>Today</option><option>Tomorrow</option><option>In 3 days</option></select></Field></div>
      <Field label="Task type"><select className="workflow-input" onChange={(event) => onChange("taskType", event.target.value)} value={String(node.config.taskType ?? "Call")}><option>Call</option><option>WhatsApp</option><option>Meeting</option><option>Payment Follow-up</option><option>Send Information</option></select></Field>
      <Field label="Reason / note"><textarea className="workflow-input min-h-20 resize-y" onChange={(event) => onChange("reason", event.target.value.slice(0, 500))} placeholder="What should the salesperson do?" value={String(node.config.reason ?? "")} /></Field>
      <ToggleField checked={node.config.preserveHistory !== false} label="Preserve previous owner and activity history" onChange={(value) => onChange("preserveHistory", value)} />
      <ToggleField checked={Boolean(node.config.notifyManager)} label="Notify sales manager for missed SLA" onChange={(value) => onChange("notifyManager", value)} />
    </> : null}

    {node.kind === "workshop" ? <>
      <Field label="Workshop"><select className="workflow-input" onChange={(event) => onChange("workshop", event.target.value)} value={String(node.config.workshop ?? "")}><option>Business Growth Blueprint</option><option>Healthy Forever</option><option>From registration source</option></select></Field>
      <Field label="Batch"><select className="workflow-input" onChange={(event) => onChange("batch", event.target.value)} value={String(node.config.batch ?? "")}><option>Best available batch</option><option>Selected batch</option><option>Main Batch</option><option>From registration link</option></select></Field>
      <Field label="Capacity behaviour"><select className="workflow-input" onChange={(event) => onChange("capacity", event.target.value)} value={String(node.config.capacity ?? "")}><option>Respect capacity</option><option>Waiting list</option><option>Allow overbooking</option></select></Field>
      <ToggleField checked={node.config.preserveSource !== false} label="Preserve registration source and sales owner" onChange={(value) => onChange("preserveSource", value)} />
      <ToggleField checked={Boolean(node.config.notifyParticipant)} label="Notify participant after assignment" onChange={(value) => onChange("notifyParticipant", value)} />
      {node.title.toLowerCase().includes("waiting registration") ? <><Field label="Match participant by"><select className="workflow-input" onChange={(event) => onChange("match", event.target.value)} value={String(node.config.match ?? "Mobile number")}><option>Mobile number</option><option>Registration ID</option><option>Email</option></select></Field><Field label="Registration handling"><select className="workflow-input" onChange={(event) => onChange("registrationMode", event.target.value)} value={String(node.config.registrationMode ?? "Existing or new")}><option>Existing or new</option><option>Existing only</option><option>Create when missing</option></select></Field></> : null}
    </> : null}

    {node.kind === "attendance" ? <>
      {node.title.toLowerCase().includes("select attendance forms") ? <Field hint="You can select more than one form" label="Workshop attendance forms"><div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">{attendanceSessions.length ? attendanceSessions.map((session) => { const selected = Array.isArray(node.config.sessionIds) && node.config.sessionIds.map(String).includes(session.id); return <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${selected ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"}`} key={session.id}><input checked={selected} className="mt-0.5 size-4 accent-teal-600" onChange={() => { const current = Array.isArray(node.config.sessionIds) ? node.config.sessionIds.map(String) : []; onChange("sessionIds", selected ? current.filter((id) => id !== session.id) : [...current, session.id]); }} type="checkbox" /><span className="text-[10px] font-bold text-slate-700">{session.label}{session.published ? "" : " · Draft"}</span></label>; }) : <p className="px-2 py-6 text-center text-[10px] font-bold text-slate-500">No attendance forms found. Create and publish an attendance form first.</p>}</div></Field> : <Field label="Attendance source"><select className="workflow-input" onChange={(event) => onChange("source", event.target.value)} value={String(node.config.source ?? "Workshop attendance")}><option>Workshop attendance</option><option>Introduction session</option><option>Selected attendance form</option></select></Field>}
      <Field label="Match participant by"><select className="workflow-input" onChange={(event) => onChange("match", event.target.value)} value={String(node.config.match ?? "Mobile number")}><option>Mobile number</option><option>Registration ID</option><option>Email</option></select></Field>
      <Field label="Set status"><select className="workflow-input" onChange={(event) => onChange("status", event.target.value)} value={String(node.config.status ?? "Present")}><option>Present</option><option>Absent</option><option>Late</option></select></Field>
      <div className="grid grid-cols-2 gap-2"><Field hint="For no-show rules" label="Grace period"><input className="workflow-input" min="0" onChange={(event) => onChange("graceMinutes", Math.min(1440, Math.max(0, Number(event.target.value))))} type="number" value={Number(node.config.graceMinutes ?? 30)} /></Field><Field label="Minimum duration"><input className="workflow-input" min="0" onChange={(event) => onChange("minimumDurationMinutes", Math.min(1440, Math.max(0, Number(event.target.value))))} type="number" value={Number(node.config.minimumDurationMinutes ?? 0)} /></Field></div>
      {node.title.toLowerCase().includes("count") ? <Field hint="Across sessions of the source workshop" label="Minimum attended sessions"><input className="workflow-input" min="1" max="100" onChange={(event) => onChange("minimumSessions", Math.min(100, Math.max(1, Number(event.target.value))))} type="number" value={Number(node.config.minimumSessions ?? 1)} /></Field> : null}
      <ToggleField checked={Boolean(node.config.createFollowUp)} label="Create CRM follow-up for absent participants" onChange={(value) => onChange("createFollowUp", value)} />
      <ToggleField checked={Boolean(node.config.promoteWaiting)} label="Promote attendance-matched waiting registration" onChange={(value) => onChange("promoteWaiting", value)} />
    </> : null}

    {node.kind === "payment" ? <>
      <Field label="Payment event"><select className="workflow-input" onChange={(event) => onChange("event", event.target.value)} value={String(node.config.event ?? "Payment completed")}><option>Payment completed</option><option>Payment failed</option><option>Payment authorized</option><option>Part payment received</option><option>Payment overdue</option></select></Field>
      <Field label="Provider"><select className="workflow-input" onChange={(event) => onChange("provider", event.target.value)} value={String(node.config.provider ?? "Razorpay")}><option>Razorpay</option><option>Manual payment</option><option>Any provider</option></select></Field>
      <Field label="Action"><select className="workflow-input" onChange={(event) => onChange("action", event.target.value)} value={String(node.config.action ?? "Update registration payment")}><option>Update registration payment</option><option>Create payment follow-up</option><option>Send payment receipt</option><option>Notify sales owner</option></select></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Minimum amount"><input className="workflow-input" min="0" onChange={(event) => onChange("minimumAmount", Math.max(0, Number(event.target.value)))} type="number" value={Number(node.config.minimumAmount ?? 0)} /></Field><Field label="Follow-up due"><select className="workflow-input" onChange={(event) => onChange("due", event.target.value)} value={String(node.config.due ?? "Today")}><option>Immediately</option><option>Today</option><option>Tomorrow</option><option>In 3 days</option></select></Field></div>
      <ToggleField checked={node.config.reconcile !== false} label="Reconcile amount with registration balance" onChange={(value) => onChange("reconcile", value)} />
      <ToggleField checked={Boolean(node.config.includeBalance)} label="Include remaining balance in receipt" onChange={(value) => onChange("includeBalance", value)} />
    </> : null}

    {node.kind === "delay" && !isScheduleNode ? <><div className="grid grid-cols-2 gap-2"><Field label="Wait for"><input className="workflow-input" min="0" onChange={(event) => onChange("amount", Number(event.target.value))} type="number" value={Number(node.config.amount ?? 10)} /></Field><Field label="Unit"><select className="workflow-input" onChange={(event) => onChange("unit", event.target.value)} value={String(node.config.unit ?? "Minutes")}><option>Minutes</option><option>Hours</option><option>Days</option></select></Field></div><ToggleField checked={Boolean(node.config.businessHours)} label="Respect business hours" onChange={(value) => onChange("businessHours", value)} /></> : null}

    {isScheduleNode ? <>
      <Field label="Frequency"><select className="workflow-input" onChange={(event) => onChange("frequency", event.target.value)} value={String(node.config.frequency ?? (node.title === "Schedule for date" ? "once" : "daily"))}><option value="hourly">Every hour</option><option value="daily">Every day</option><option value="weekly">Selected weekdays</option><option value="once">One time</option></select></Field>
      {String(node.config.frequency ?? (node.title === "Schedule for date" ? "once" : "daily")) === "once" ? <Field label="Run at"><input className="workflow-input" onChange={(event) => onChange("scheduledAt", event.target.value ? new Date(event.target.value).toISOString() : "")} type="datetime-local" value={node.config.scheduledAt ? new Date(String(node.config.scheduledAt)).toISOString().slice(0, 16) : ""} /></Field> : <div className="grid grid-cols-2 gap-2"><Field label="Time"><input className="workflow-input" onChange={(event) => onChange("time", event.target.value)} type="time" value={String(node.config.time ?? "09:00")} /></Field><Field label="Timezone"><select className="workflow-input" onChange={(event) => onChange("timezone", event.target.value)} value={String(node.config.timezone ?? "Asia/Kolkata")}><option value="Asia/Kolkata">India · IST</option><option value="UTC">UTC</option></select></Field></div>}
      {node.config.frequency === "weekly" ? <Field label="Weekdays"><div className="grid grid-cols-4 gap-1">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => { const selected = Array.isArray(node.config.weekdays) && node.config.weekdays.includes(day); return <button className={`rounded-lg border px-2 py-1.5 text-[9px] font-black ${selected ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`} key={day} onClick={() => { const current = Array.isArray(node.config.weekdays) ? node.config.weekdays.map(String) : []; onChange("weekdays", selected ? current.filter((item) => item !== day) : [...current, day]); }} type="button">{day}</button>; })}</div></Field> : null}
      <ToggleField checked={node.config.deduplicate !== false} label="Prevent duplicate run in the same minute" onChange={(value) => onChange("deduplicate", value)} />
    </> : null}

    {node.kind === "trigger" ? <>
      <Field label="Event"><select className="workflow-input" onChange={(event) => onChange("event", event.target.value)} value={String(node.config.event ?? "New public registration")}><option>New public registration</option><option>Registration confirmed</option><option>Waiting-list registration</option><option>Lead SLA breached</option><option>Follow-up overdue</option><option>Payment completed</option><option>Payment failed</option><option>Payment authorized</option><option>Attendance submitted</option><option>Late attendance submitted</option><option>Attendance no-show detected</option><option>WhatsApp reply received</option><option>WhatsApp message delivered</option><option>WhatsApp message read</option><option>WhatsApp message failed</option></select></Field>
      <Field label="Registration form"><select className="workflow-input" onChange={(event) => onChange("form", event.target.value)} value={String(node.config.form ?? "All active forms")}><option>All active forms</option><option>Business Growth Blueprint</option><option>Healthy Forever</option></select></Field>
      <ToggleField checked={Boolean(node.config.deduplicate)} label="Ignore duplicate webhook events" onChange={(value) => onChange("deduplicate", value)} />
    </> : null}

    {node.kind === "webhook" && node.title.toLowerCase().includes("download csv") ? <>
      <Field label="File format"><select className="workflow-input" onChange={(event) => onChange("format", event.target.value)} value={String(node.config.format ?? "CSV")}><option>CSV</option></select></Field>
      <Field label="Include records"><select className="workflow-input" onChange={(event) => onChange("include", event.target.value)} value={String(node.config.include ?? "Registered and not registered")}><option>Registered and not registered</option><option>Not registered only</option><option>Registered only</option></select></Field>
      <p className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-[10px] font-bold leading-4 text-teal-800">Run “Test workflow” after selecting forms. The matched output will be prepared as a CSV download.</p>
    </> : node.kind === "webhook" ? <>
      <div className="grid grid-cols-[90px_1fr] gap-2"><Field label="Method"><select className="workflow-input" onChange={(event) => onChange("method", event.target.value)} value={String(node.config.method ?? "POST")}><option>POST</option><option>GET</option><option>PATCH</option></select></Field><Field label="Endpoint"><input className="workflow-input font-mono text-[10px]" onChange={(event) => onChange("url", event.target.value)} value={String(node.config.url ?? "https://")} /></Field></div>
      <Field label="Authentication"><select className="workflow-input" onChange={(event) => onChange("authentication", event.target.value)} value={String(node.config.authentication ?? "Stored credential")}><option>Stored credential</option><option>Bearer token</option><option>None</option></select></Field>
    </> : null}

    {node.kind === "data" ? <>
      <Field label="Allowed data"><select className="workflow-input" onChange={(event) => onChange("scope", event.target.value)} value={String(node.config.scope ?? "Dashboard summary")}><option>Dashboard summary</option><option>Workshop registrations</option><option>Attendance analytics</option><option>CRM pipeline</option><option>Payment summary</option></select></Field>
      {String(node.config.scope ?? "Dashboard summary") === "Workshop registrations" ? <Field hint="Limit matching and export to one workshop" label="Workshop"><select className="workflow-input" onChange={(event) => onChange("workshopId", event.target.value)} value={String(node.config.workshopId ?? "")}><option value="">All selected workshops</option>{workshops.map((workshop) => <option key={workshop.id} value={workshop.id}>{workshop.name}</option>)}</select></Field> : null}
      <div className="grid grid-cols-2 gap-2"><Field label="Access"><select className="workflow-input" onChange={(event) => onChange("access", event.target.value)} value={String(node.config.access ?? "Read only")}><option>Read only</option></select></Field><Field label="Maximum rows"><input className="workflow-input" min="1" max="100" onChange={(event) => onChange("maxRows", Math.min(100, Math.max(1, Number(event.target.value))))} type="number" value={Number(node.config.maxRows ?? 25)} /></Field></div>
      <ToggleField checked={node.config.redactSensitive !== false} label="Hide phone, email and payment identifiers" onChange={(value) => onChange("redactSensitive", value)} />
    </> : null}

    {node.kind === "ai" ? <>
      <Field label="AI provider"><select className="workflow-input" onChange={(event) => onChange("provider", event.target.value)} value={String(node.config.provider ?? "Local Ollama")}><option>Local Ollama</option><option>OpenAI (stored credential)</option></select></Field>
      <Field label="Instruction"><textarea className="workflow-input min-h-24 resize-y" maxLength={1200} onChange={(event) => onChange("instruction", event.target.value)} value={String(node.config.instruction ?? "")} /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Language"><select className="workflow-input" onChange={(event) => onChange("language", event.target.value)} value={String(node.config.language ?? "Auto detect")}><option>Auto detect</option><option>Gujarati</option><option>English</option><option>Hindi</option></select></Field><ToggleField checked={node.config.citations !== false} label="Include data source labels" onChange={(value) => onChange("citations", value)} /></div>
    </> : null}

    {node.kind === "telegram" ? <>
      <Field label="Bot credential"><select className="workflow-input" onChange={(event) => onChange("credential", event.target.value)} value={String(node.config.credential ?? "Telegram bot · Primary")}><option>Telegram bot · Primary</option><option>Choose credential</option></select></Field>
      <Field label="Chat access"><select className="workflow-input" onChange={(event) => onChange("chatPolicy", event.target.value)} value={String(node.config.chatPolicy ?? "Approved chats only")}><option>Approved chats only</option><option>Private chats only</option></select></Field>
      {node.title.toLowerCase().includes("reply") ? <><Field label="Reply text"><textarea className="workflow-input min-h-20 resize-y font-mono text-[10px]" onChange={(event) => onChange("message", event.target.value)} value={String(node.config.message ?? "{{ai.answer}}")} /></Field><ToggleField checked={node.config.splitLongMessages !== false} label="Split messages longer than Telegram limit" onChange={(value) => onChange("splitLongMessages", value)} /></> : <ToggleField checked={node.config.deduplicate !== false} label="Ignore duplicate Telegram updates" onChange={(value) => onChange("deduplicate", value)} />}
    </> : null}

    {!handled ? <><Field label="Action"><select className="workflow-input" onChange={(event) => onChange("action", event.target.value)} value={String(node.config.action ?? node.title)}><option>{node.title}</option><option>Update existing record</option><option>Create a new record</option></select></Field><Field label="Due / schedule"><input className="workflow-input" onChange={(event) => onChange("due", event.target.value)} value={String(node.config.due ?? "Tomorrow at 10:00 AM")} /></Field></> : null}
    <button className="workflow-button-primary w-full justify-center" onClick={onTest} type="button"><Play className="size-4" />Test with mock data</button>
  </div>;
}

function LeadAssignmentRuleBuilder({ node, onChange, salesPeople }: { node: WorkflowNode; onChange: (key: string, value: ConfigValue) => void; salesPeople: WorkflowSalesPerson[] }) {
  const rules = Array.isArray(node.config.assignmentRules) ? node.config.assignmentRules as WorkshopLeadAssignmentRule[] : [];
  const [city, setCity] = useState("Ahmedabad");
  const [state, setState] = useState("Gujarat");
  const [pincode, setPincode] = useState("");
  const [source, setSource] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [strategy, setStrategy] = useState<LeadAssignmentStrategy>("fixed");
  const [maxActiveLeads, setMaxActiveLeads] = useState("");
  const [sampleCity, setSampleCity] = useState("Ahmedabad");
  const [samplePincode, setSamplePincode] = useState("380015");
  const [sampleSource, setSampleSource] = useState("Registration Link");

  const decision = useMemo(() => resolveSmartLeadAssignment(
    { id: "rule-preview", city: sampleCity, state: "Gujarat", pincode: samplePincode, source: sampleSource, createdAt: new Date().toISOString() },
    rules,
    salesPeople,
    [],
    node.config.defaultSalesPersonId,
    String(node.config.fallbackStrategy ?? "least-active") as LeadAssignmentStrategy
  ), [node.config.defaultSalesPersonId, node.config.fallbackStrategy, rules, salesPeople, sampleCity, samplePincode, sampleSource]);

  function saveRules(next: WorkshopLeadAssignmentRule[]) {
    onChange("assignmentRules", next.map((rule, index) => ({ ...rule, priority: index + 1 })));
  }

  function addRule() {
    if (strategy === "fixed" && !salesPersonId) return;
    if (![city, state, pincode, source, startDate, endDate].some((value) => value.trim())) return;
    saveRules([...rules, {
      id: `rule-${crypto.randomUUID().slice(0, 8)}`,
      enabled: true,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      pincode: pincode.trim() || undefined,
      source: source.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      salesPersonId: strategy === "fixed" ? salesPersonId : undefined,
      strategy,
      maxActiveLeads: Number(maxActiveLeads) || undefined
    }]);
    setCity(""); setState(""); setPincode(""); setSource(""); setStartDate(""); setEndDate(""); setSalesPersonId(""); setMaxActiveLeads("");
  }

  return <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black text-indigo-950">Assignment rule builder</p><p className="mt-0.5 text-[9px] font-semibold leading-4 text-indigo-700">City, state, pincode, source and date conditions run top to bottom.</p></div><span className="rounded-lg bg-white px-2 py-1 text-[9px] font-black text-indigo-700">{rules.length} RULES</span></div>
    {rules.length ? <div className="space-y-1.5">{rules.map((rule, index) => {
      const person = salesPeople.find((item) => item.id === rule.salesPersonId);
      const conditions = [rule.city && `City ${rule.city}`, rule.state && `State ${rule.state}`, rule.pincode && `PIN ${rule.pincode}`, rule.source && `Source ${rule.source}`, (rule.startDate || rule.endDate) && `${rule.startDate || "Any"} → ${rule.endDate || "Any"}`].filter(Boolean);
      return <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white p-2" key={rule.id}><span className="grid size-6 shrink-0 place-items-center rounded-lg bg-indigo-50 text-[9px] font-black text-indigo-700">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-black text-slate-800">{conditions.join(" · ")}</span><span className="mt-0.5 block text-[8px] font-semibold text-slate-400">→ {person?.name || (rule.strategy === "least-active" ? "Least active salesperson" : rule.strategy === "round-robin" ? "Round robin" : "Unavailable salesperson")}{rule.maxActiveLeads ? ` · max ${rule.maxActiveLeads}` : ""}</span></span><div className="flex shrink-0"><button aria-label="Move rule up" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-25" disabled={index === 0} onClick={() => { const next = [...rules]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; saveRules(next); }} type="button"><ArrowUp className="size-3" /></button><button aria-label="Move rule down" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-25" disabled={index === rules.length - 1} onClick={() => { const next = [...rules]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; saveRules(next); }} type="button"><ArrowDown className="size-3" /></button><button aria-label="Delete rule" className="rounded-md p-1 text-rose-500 hover:bg-rose-50" onClick={() => saveRules(rules.filter((item) => item.id !== rule.id))} type="button"><Trash2 className="size-3" /></button></div></div>;
    })}</div> : <div className="rounded-xl border border-dashed border-indigo-200 bg-white/70 px-3 py-4 text-center text-[9px] font-bold text-indigo-500">No priority rules yet. Fallback strategy will handle every lead.</div>}
    <div className="grid grid-cols-2 gap-2"><Field label="City"><input className="workflow-input" onChange={(event) => setCity(event.target.value)} placeholder="Ahmedabad" value={city} /></Field><Field label="State"><input className="workflow-input" onChange={(event) => setState(event.target.value)} placeholder="Gujarat" value={state} /></Field><Field label="Pincode"><input className="workflow-input" inputMode="numeric" maxLength={6} onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="380015" value={pincode} /></Field><Field label="Source"><select className="workflow-input" onChange={(event) => setSource(event.target.value)} value={source}><option value="">Any source</option><option>Registration Link</option><option>Landing Page</option><option>Referral</option><option>Manual</option></select></Field><Field label="From date"><input className="workflow-input" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></Field><Field label="To date"><input className="workflow-input" min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></Field></div>
    <Field label="Assignment action"><select className="workflow-input" onChange={(event) => setStrategy(event.target.value as LeadAssignmentStrategy)} value={strategy}><option value="fixed">Fixed salesperson</option><option value="least-active">Least active salesperson</option><option value="round-robin">Round robin</option></select></Field>
    {strategy === "fixed" ? <Field label="Assign to"><select className="workflow-input" onChange={(event) => setSalesPersonId(event.target.value)} value={salesPersonId}><option value="">Select available salesperson</option>{salesPeople.filter((person) => person.isActive && person.acceptingLeads).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.activeLeadCount} active</option>)}</select></Field> : null}
    <Field hint="Optional safety cap" label="Max active leads"><input className="workflow-input" min="1" onChange={(event) => setMaxActiveLeads(event.target.value)} placeholder="No rule-specific limit" type="number" value={maxActiveLeads} /></Field>
    <button className="workflow-button-primary w-full justify-center" disabled={(strategy === "fixed" && !salesPersonId) || ![city, state, pincode, source, startDate, endDate].some((value) => value.trim()) || Boolean(startDate && endDate && endDate < startDate)} onClick={addRule} type="button"><Plus className="size-4" />Add priority rule</button>
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black text-emerald-900">Live rule preview</span><span className="rounded-md bg-white px-1.5 py-0.5 text-[8px] font-black text-emerald-700">NO DATA CHANGED</span></div><div className="mt-2 grid grid-cols-3 gap-1.5"><input aria-label="Sample city" className="workflow-input" onChange={(event) => setSampleCity(event.target.value)} placeholder="City" value={sampleCity} /><input aria-label="Sample pincode" className="workflow-input" onChange={(event) => setSamplePincode(event.target.value)} placeholder="Pincode" value={samplePincode} /><select aria-label="Sample source" className="workflow-input" onChange={(event) => setSampleSource(event.target.value)} value={sampleSource}><option>Registration Link</option><option>Landing Page</option><option>Referral</option><option>Manual</option></select></div><p className={`mt-2 text-[9px] font-black ${decision.salesPersonId ? "text-emerald-800" : "text-amber-800"}`}>{decision.salesPersonId ? `${decision.salesPersonName} · ${decision.activeLeadCount} active leads` : "No eligible salesperson · lead stays unassigned"}</p><p className="mt-0.5 text-[8px] font-semibold text-emerald-700">{decision.reason}</p></div>
  </div>;
}

export function SettingsPanel({ node, onChange }: { node: WorkflowNode; onChange: (key: string, value: ConfigValue) => void }) {
  return <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Execution behaviour</p><p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">Choose how this action handles temporary failures.</p></div>
    <ToggleField checked={Boolean(node.config.continueOnError)} label="Continue workflow on error" onChange={(value) => onChange("continueOnError", value)} />
    <ToggleField checked={Boolean(node.config.retry)} label="Retry automatically" onChange={(value) => onChange("retry", value)} />
    {node.config.retry ? <div className="grid grid-cols-2 gap-2"><Field label="Attempts"><select className="workflow-input" onChange={(event) => onChange("attempts", Number(event.target.value))} value={Number(node.config.attempts ?? 3)}><option>2</option><option>3</option><option>5</option></select></Field><Field label="Backoff"><select className="workflow-input" onChange={(event) => onChange("interval", event.target.value)} value={String(node.config.interval ?? "Exponential backoff")}><option>Exponential backoff</option><option>5 minutes</option><option>15 minutes</option></select></Field></div> : null}
    <Field label="Timeout"><select className="workflow-input" onChange={(event) => onChange("timeout", event.target.value)} value={String(node.config.timeout ?? "30 seconds")}><option>10 seconds</option><option>30 seconds</option><option>2 minutes</option></select></Field>
    <Field hint="Visible in logs" label="Internal note"><textarea className="workflow-input min-h-24 resize-y" onChange={(event) => onChange("note", event.target.value)} placeholder="Explain this node for your team…" value={String(node.config.note ?? "")} /></Field>
  </div>;
}

export function OutputPanel({ node, onTest, status }: { node: WorkflowNode; onTest: () => void; status: ExecutionNodeStatus }) {
  const output = { node: node.id, status: status === "idle" ? "ready" : status, participant_id: "mock_10428", workshop: "Business Growth Blueprint", assigned_owner: node.kind === "crm" ? "Bhavin J. Shah" : undefined, next: "success" };
  return <div className="space-y-4">
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><span><span className="block text-[10px] font-black text-slate-800">Latest node result</span><span className="mt-0.5 block text-[9px] font-semibold text-slate-400">Safe mock execution</span></span><RunStatusBadge status={status === "failed" ? "failed" : status === "running" ? "running" : "success"} /></div>
    <Field label="Output JSON"><pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-[9px] font-semibold leading-4 text-emerald-300">{JSON.stringify(output, null, 2)}</pre></Field>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-semibold leading-4 text-amber-900">Test mode validates mappings and branch logic without assigning a real lead or sending a real message.</div>
    <button className="workflow-button-primary w-full justify-center" onClick={onTest} type="button"><Play className="size-4" />Run node test</button>
  </div>;
}

export function ValidationPopover({ issues, onClose }: { issues: Array<{ level: "error" | "warning"; text: string }>; onClose: () => void }) {
  return <div className="absolute right-3 top-3 z-40 w-[min(330px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" onPointerDown={(event) => event.stopPropagation()}>
    <div className="flex items-start gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${issues.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{issues.length ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-950">{issues.length ? "Workflow review" : "Ready to activate"}</p><p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">{issues.length ? "Review these items before production." : "Every node, mapping and branch passed validation."}</p></div><button className="text-slate-400 hover:text-slate-700" onClick={onClose} type="button"><X className="size-4" /></button></div>
    {issues.length ? <div className="mt-3 space-y-2">{issues.map((issue, index) => <div className={`rounded-xl border p-2.5 text-[10px] font-semibold leading-4 ${issue.level === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`} key={`${issue.text}-${index}`}>{issue.text}</div>)}</div> : <div className="mt-3 grid grid-cols-3 gap-2">{[["10", "Nodes"], ["10", "Links"], ["0", "Errors"]].map(([value, label]) => <div className="rounded-xl bg-slate-50 p-2 text-center" key={label}><span className="block text-sm font-black text-slate-900">{value}</span><span className="text-[8px] font-black uppercase text-slate-400">{label}</span></div>)}</div>}
  </div>;
}

export function NodePicker({ context, items, onAdd, onClose, query, searchRef, setQuery }: {
  context: PickerContext;
  items: CatalogItem[];
  onAdd: (item: CatalogItem) => void;
  onClose: () => void;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  setQuery: (value: string) => void;
}) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 p-4" onMouseDown={onClose}>
    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-3 border-b border-slate-200 p-4"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Plus className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-black text-slate-950">{context.mode === "insert" ? "Insert a node" : context.mode === "connect" ? "Choose the next action" : "Add a workflow node"}</h3><p className="mt-0.5 text-[10px] font-semibold text-slate-500">CRM, workshop, attendance, WhatsApp and logic actions.</p></div><KeyCap>/</KeyCap><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></div>
      <label className="flex h-14 items-center gap-3 border-b border-slate-200 px-4"><Search className="size-5 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Type an action, for example ‘WhatsApp’" ref={searchRef} value={query} /></label>
      <div className="grid max-h-[430px] grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">{items.map((item) => <button className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50" key={`${item.kind}-${item.title}`} onClick={() => onAdd(item)} type="button"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colorByKind[item.kind].soft} ${colorByKind[item.kind].icon}`}><item.icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-900">{item.title}</span><span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-400">{item.subtitle}</span></span><ArrowRight className="size-4 text-slate-300 group-hover:text-indigo-600" /></button>)}{!items.length ? <div className="col-span-full py-12"><EmptySearch query={query} /></div> : null}</div>
    </div>
  </div>;
}

export function VersionHistory({ currentVersion, onClose, onRestore, restoring, versions }: { currentVersion: number; onClose: () => void; onRestore: (version: number) => void; restoring: number | null; versions: WorkflowVersionSummary[] }) {
  return <DialogFrame onClose={onClose} subtitle="Every rollback creates a new immutable version, preserving the complete audit trail." title="Version history"><div className="max-h-[430px] space-y-2 overflow-y-auto">{versions.length ? versions.map((item) => { const current = item.version === currentVersion; return <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3" key={item.version}><span className={`grid size-10 place-items-center rounded-xl text-xs font-black ${current ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>v{item.version}</span><span className="min-w-0 flex-1"><span className="block text-xs font-black text-slate-900">{item.restoredFromVersion ? `Restored from v${item.restoredFromVersion}` : `${item.nodeCount} configured nodes`}</span><span className="mt-0.5 block text-[10px] font-semibold text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")} · {item.createdBy}</span></span>{current ? <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">CURRENT</span> : <button className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 disabled:opacity-40" disabled={restoring !== null} onClick={() => onRestore(item.version)} type="button">{restoring === item.version ? <RefreshCw className="size-3 animate-spin" /> : null}{restoring === item.version ? "Restoring" : "Restore"}</button>}</div>; }) : <div className="py-12 text-center text-xs font-bold text-slate-400">No saved versions yet.</div>}</div></DialogFrame>;
}

export function ShortcutDialog({ onClose }: { onClose: () => void }) {
  const shortcuts = [["Save workflow", "⌘ S"], ["Undo", "⌘ Z"], ["Redo", "⇧ ⌘ Z"], ["Duplicate selection", "⌘ D"], ["Open node picker", "/"], ["Pan canvas", "Space + Drag"], ["Multi-select", "Shift + Click"], ["Delete selection", "Delete"]];
  return <DialogFrame onClose={onClose} subtitle="Fast controls for building larger automations." title="Keyboard shortcuts"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{shortcuts.map(([label, keys]) => <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5" key={label}><span className="text-[11px] font-bold text-slate-600">{label}</span><KeyCap>{keys}</KeyCap></div>)}</div></DialogFrame>;
}

export function RunDetail({ onClose, onReplay, replaying, run }: { onClose: () => void; onReplay?: () => void; replaying?: boolean; run: RunRow }) {
  const steps = run.steps?.length ? run.steps : ["Registration received", "Validated required fields", "Evaluated city & date route", run.status === "failed" ? "WhatsApp template failed" : "Completed CRM and message actions"].map((title, index) => ({ nodeId: `legacy-${index}`, title, status: run.status === "failed" && index === 3 ? "failed" as const : "success" as const, durationMs: 12 + index * 18, detail: title }));
  return <DialogFrame onClose={onClose} subtitle={`${run.participant} · ${run.started}`} title={`Execution ${run.id}`}><div className="space-y-3"><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><RunStatusBadge status={run.status} /><span className="text-[10px] font-black text-slate-500">{run.progress} · {run.duration}</span></div><p className="rounded-xl border border-slate-200 p-3 text-[11px] font-semibold leading-5 text-slate-600">{run.detail}</p><div className="max-h-[360px] space-y-1.5 overflow-y-auto">{steps.map((step) => <div className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600" key={`${step.nodeId}-${step.title}`}><div className="flex items-center gap-2"><span className={`grid size-5 place-items-center rounded-full ${step.status === "failed" ? "bg-rose-100 text-rose-700" : step.status === "skipped" ? "bg-slate-200 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>{step.status === "failed" ? <X className="size-3" /> : <Check className="size-3" />}</span><span className="min-w-0 flex-1 truncate">{step.title}</span><span className="font-mono text-[9px] text-slate-400">{step.durationMs}ms</span></div><p className="ml-7 mt-1 text-[9px] font-semibold leading-4 text-slate-400">{step.detail}</p></div>)}</div>{run.status === "failed" && onReplay ? <button className="workflow-button-primary w-full justify-center" disabled={replaying} onClick={onReplay} type="button">{replaying ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}{replaying ? "Replaying safely" : "Replay in safe test mode"}</button> : null}</div></DialogFrame>;
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${status === "success" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{status === "success" ? <CheckCircle2 className="size-3" /> : status === "failed" ? <AlertCircle className="size-3" /> : <RefreshCw className="size-3 animate-spin" />}{status}</span>;
}

function DialogFrame({ children, onClose, subtitle, title }: { children: ReactNode; onClose: () => void; subtitle: string; title: string }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 p-4" onMouseDown={onClose}><div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><History className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-black text-slate-950">{title}</h3><p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">{subtitle}</p></div><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X className="size-4" /></button></div>{children}</div></div>;
}

function ToggleField({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[10px] font-black text-slate-700 hover:bg-slate-50" onClick={() => onChange(!checked)} type="button"><span>{label}</span><span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-all ${checked ? "left-6" : "left-1"}`} /></span></button>;
}

function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return <label className="block"><span className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-black text-slate-600"><span>{label}</span>{hint ? <span className="text-right text-[8px] font-semibold text-slate-400">{hint}</span> : null}</span>{children}</label>;
}

export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex min-h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-[9px] font-black text-slate-500 shadow-sm">{children}</kbd>;
}

export function EmptySearch({ query }: { query: string }) {
  return <div className="px-4 py-8 text-center"><span className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-400"><Search className="size-4" /></span><p className="mt-2 text-xs font-black text-slate-700">No node found</p><p className="mt-1 text-[10px] font-semibold text-slate-400">Try another term{query ? ` instead of “${query}”` : ""}.</p></div>;
}

export function MenuAction({ icon: Icon, label, onClick }: { icon: typeof Copy; label: string; onClick: () => void }) {
  return <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={onClick} type="button"><Icon className="size-4 text-slate-400" />{label}</button>;
}
