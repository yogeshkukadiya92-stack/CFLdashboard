"use client";

import {
  AlertCircle,
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  Copy,
  History,
  Play,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import {
  colorByKind,
  type CatalogItem,
  type ConfigValue,
  type ExecutionNodeStatus,
  type PickerContext,
  type RunRow,
  type RunStatus,
  type WorkflowNode,
} from "@/lib/workflow-studio";

export type InspectorTab = "parameters" | "settings" | "output";

export function ParametersPanel({ node, onChange, onRename, onTest }: {
  node: WorkflowNode;
  onChange: (key: string, value: ConfigValue) => void;
  onRename: (value: string) => void;
  onTest: () => void;
}) {
  const isAssignNode = node.kind === "crm" && node.title.toLowerCase().includes("assign");
  const handled = ["message", "condition", "workshop", "attendance", "delay", "trigger", "webhook"].includes(node.kind) || isAssignNode;
  return <div className="space-y-4">
    <Field label="Node name"><input className="workflow-input" onChange={(event) => onRename(event.target.value)} value={node.title} /></Field>

    {node.kind === "message" ? <>
      <Field hint="Settings → Integrations" label="WhatsApp credential"><select className="workflow-input" onChange={(event) => onChange("credential", event.target.value)} value={String(node.config.credential ?? "")}><option>Meta Business · Coach For Life</option><option>OpenWA · Primary</option><option>Choose credential</option></select></Field>
      <Field hint="Approved templates only" label="Message template"><select className="workflow-input" onChange={(event) => onChange("template", event.target.value)} value={String(node.config.template ?? "")}><option>cfl_registration_confirmation_v3</option><option>cfl_waiting_list_v2</option><option>cfl_workshop_reminder_v4</option><option>Select approved template</option></select></Field>
      <Field label="Recipient mapping"><div className="relative"><Braces className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-indigo-500" /><input className="workflow-input pl-9 font-mono text-[10px]" onChange={(event) => onChange("recipient", event.target.value)} value={String(node.config.recipient ?? "")} /></div></Field>
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
      <div className="grid grid-cols-2 gap-2"><Field label="Operator"><select className="workflow-input" onChange={(event) => onChange("operator", event.target.value)} value={String(node.config.operator ?? "")}><option>Equals</option><option>Contains</option><option>Is valid</option><option>Is after</option><option>Is before</option></select></Field><Field label="Value"><input className="workflow-input" onChange={(event) => onChange("value", event.target.value)} value={String(node.config.value ?? "")} /></Field></div>
      <div className="grid grid-cols-2 gap-2"><Field label="Branch A"><input className="workflow-input" onChange={(event) => onChange("branchA", event.target.value)} value={String(node.config.branchA ?? "Matches")} /></Field><Field label="Branch B"><input className="workflow-input" onChange={(event) => onChange("branchB", event.target.value)} value={String(node.config.branchB ?? "Otherwise")} /></Field></div>
    </> : null}

    {isAssignNode ? <>
      <Field hint="First matching rule wins" label="Assignment strategy"><select className="workflow-input" onChange={(event) => onChange("strategy", event.target.value)} value={String(node.config.strategy ?? "Round robin")}><option>City + date + workload</option><option>City-based rules</option><option>Date-based rules</option><option>Round robin</option><option>Least active leads</option><option>Fixed sales person</option></select></Field>
      <Field label="Sales person"><select className="workflow-input" onChange={(event) => onChange("salesperson", event.target.value)} value={String(node.config.salesperson ?? "Auto-select active sales person")}><option>Auto-select active sales person</option><option>Bhavin J. Shah</option><option>Sales Team · West</option></select></Field>
      <Field label="Fallback rule"><select className="workflow-input" onChange={(event) => onChange("fallback", event.target.value)} value={String(node.config.fallback ?? "Round robin")}><option>Round robin</option><option>Least active leads</option><option>Keep unassigned</option></select></Field>
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[10px] font-semibold leading-4 text-indigo-900"><strong>Priority:</strong> city rule → date rule → workload → fallback. Duplicate leads retain their current owner.</div>
    </> : null}

    {node.kind === "workshop" ? <>
      <Field label="Workshop"><select className="workflow-input" onChange={(event) => onChange("workshop", event.target.value)} value={String(node.config.workshop ?? "")}><option>Business Growth Blueprint</option><option>Healthy Forever</option><option>From registration source</option></select></Field>
      <Field label="Batch"><select className="workflow-input" onChange={(event) => onChange("batch", event.target.value)} value={String(node.config.batch ?? "")}><option>Best available batch</option><option>Selected batch</option><option>Main Batch</option><option>From registration link</option></select></Field>
      <Field label="Capacity behaviour"><select className="workflow-input" onChange={(event) => onChange("capacity", event.target.value)} value={String(node.config.capacity ?? "")}><option>Respect capacity</option><option>Waiting list</option><option>Allow overbooking</option></select></Field>
    </> : null}

    {node.kind === "attendance" ? <>
      <Field label="Attendance source"><select className="workflow-input" onChange={(event) => onChange("source", event.target.value)} value={String(node.config.source ?? "Workshop attendance")}><option>Workshop attendance</option><option>Introduction session</option><option>Selected attendance form</option></select></Field>
      <Field label="Match participant by"><select className="workflow-input" onChange={(event) => onChange("match", event.target.value)} value={String(node.config.match ?? "Mobile number")}><option>Mobile number</option><option>Registration ID</option><option>Email</option></select></Field>
      <Field label="Set status"><select className="workflow-input" onChange={(event) => onChange("status", event.target.value)} value={String(node.config.status ?? "Present")}><option>Present</option><option>Absent</option><option>Late</option></select></Field>
    </> : null}

    {node.kind === "delay" ? <><div className="grid grid-cols-2 gap-2"><Field label="Wait for"><input className="workflow-input" min="0" onChange={(event) => onChange("amount", Number(event.target.value))} type="number" value={Number(node.config.amount ?? 10)} /></Field><Field label="Unit"><select className="workflow-input" onChange={(event) => onChange("unit", event.target.value)} value={String(node.config.unit ?? "Minutes")}><option>Minutes</option><option>Hours</option><option>Days</option></select></Field></div><ToggleField checked={Boolean(node.config.businessHours)} label="Respect business hours" onChange={(value) => onChange("businessHours", value)} /></> : null}

    {node.kind === "trigger" ? <>
      <Field label="Event"><select className="workflow-input" onChange={(event) => onChange("event", event.target.value)} value={String(node.config.event ?? "New public registration")}><option>New public registration</option><option>Registration confirmed</option><option>Waiting-list registration</option><option>Payment completed</option></select></Field>
      <Field label="Registration form"><select className="workflow-input" onChange={(event) => onChange("form", event.target.value)} value={String(node.config.form ?? "All active forms")}><option>All active forms</option><option>Business Growth Blueprint</option><option>Healthy Forever</option></select></Field>
      <ToggleField checked={Boolean(node.config.deduplicate)} label="Ignore duplicate webhook events" onChange={(value) => onChange("deduplicate", value)} />
    </> : null}

    {node.kind === "webhook" ? <>
      <div className="grid grid-cols-[90px_1fr] gap-2"><Field label="Method"><select className="workflow-input" onChange={(event) => onChange("method", event.target.value)} value={String(node.config.method ?? "POST")}><option>POST</option><option>GET</option><option>PATCH</option></select></Field><Field label="Endpoint"><input className="workflow-input font-mono text-[10px]" onChange={(event) => onChange("url", event.target.value)} value={String(node.config.url ?? "https://")} /></Field></div>
      <Field label="Authentication"><select className="workflow-input" onChange={(event) => onChange("authentication", event.target.value)} value={String(node.config.authentication ?? "Stored credential")}><option>Stored credential</option><option>Bearer token</option><option>None</option></select></Field>
    </> : null}

    {!handled ? <><Field label="Action"><select className="workflow-input" onChange={(event) => onChange("action", event.target.value)} value={String(node.config.action ?? node.title)}><option>{node.title}</option><option>Update existing record</option><option>Create a new record</option></select></Field><Field label="Due / schedule"><input className="workflow-input" onChange={(event) => onChange("due", event.target.value)} value={String(node.config.due ?? "Tomorrow at 10:00 AM")} /></Field></> : null}
    <button className="workflow-button-primary w-full justify-center" onClick={onTest} type="button"><Play className="size-4" />Test with mock data</button>
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

export function VersionHistory({ onClose, onRestore }: { onClose: () => void; onRestore: () => void }) {
  return <DialogFrame onClose={onClose} subtitle="Restore a known configuration without losing undo history." title="Version history"><div className="space-y-2">{[
    ["v2.4", "Current production", "Just now", true],
    ["v2.3", "Added waiting-list WhatsApp branch", "Today, 09:48 AM", false],
    ["v2.2", "Salesperson city and date routing", "Yesterday, 06:20 PM", false],
  ].map(([version, title, time, current]) => <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3" key={String(version)}><span className={`grid size-10 place-items-center rounded-xl text-xs font-black ${current ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{version}</span><span className="min-w-0 flex-1"><span className="block text-xs font-black text-slate-900">{title}</span><span className="mt-0.5 block text-[10px] font-semibold text-slate-400">{time} · Admin User</span></span>{current ? <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">CURRENT</span> : <button className="text-[10px] font-black text-indigo-700" onClick={onRestore} type="button">Restore</button>}</div>)}</div></DialogFrame>;
}

export function ShortcutDialog({ onClose }: { onClose: () => void }) {
  const shortcuts = [["Save workflow", "⌘ S"], ["Undo", "⌘ Z"], ["Redo", "⇧ ⌘ Z"], ["Duplicate selection", "⌘ D"], ["Open node picker", "/"], ["Pan canvas", "Space + Drag"], ["Multi-select", "Shift + Click"], ["Delete selection", "Delete"]];
  return <DialogFrame onClose={onClose} subtitle="Fast controls for building larger automations." title="Keyboard shortcuts"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{shortcuts.map(([label, keys]) => <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5" key={label}><span className="text-[11px] font-bold text-slate-600">{label}</span><KeyCap>{keys}</KeyCap></div>)}</div></DialogFrame>;
}

export function RunDetail({ onClose, run }: { onClose: () => void; run: RunRow }) {
  return <DialogFrame onClose={onClose} subtitle={`${run.participant} · ${run.started}`} title={`Execution ${run.id}`}><div className="space-y-3"><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"><RunStatusBadge status={run.status} /><span className="text-[10px] font-black text-slate-500">{run.progress} · {run.duration}</span></div><p className="rounded-xl border border-slate-200 p-3 text-[11px] font-semibold leading-5 text-slate-600">{run.detail}</p><div className="space-y-1.5">{["Registration received", "Validated required fields", "Evaluated city & date route", run.status === "failed" ? "WhatsApp template failed" : "Completed CRM and message actions"].map((step, index) => <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600" key={step}><span className={`grid size-5 place-items-center rounded-full ${run.status === "failed" && index === 3 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{run.status === "failed" && index === 3 ? <X className="size-3" /> : <Check className="size-3" />}</span>{step}<span className="ml-auto font-mono text-[9px] text-slate-400">{12 + index * 18}ms</span></div>)}</div></div></DialogFrame>;
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
