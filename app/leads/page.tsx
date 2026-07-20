"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { createLeadActivity, createLeadId, nextPendingFollowUp, normalizeLead, normalizeLeadMobile } from "@/lib/lead-utils";
import { hydrateLiveState, LIVE_STATE_STORAGE_KEYS, readLocalArray, saveLiveState } from "@/lib/live-state";
import type { Lead, LeadFollowUp, LeadPriority, LeadStage } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CircleDollarSign,
  Download,
  Flame,
  KanbanSquare,
  List,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type SalesPerson = { id: string; isActive: boolean; name: string };
type Workshop = { id: string; name: string };
type ClientRecord = {
  city: string;
  country: string;
  dob: string;
  email: string;
  gender: string;
  id: number;
  mobile: string;
  name: string;
  occupation: string;
  state: string;
  status: "Active";
};
type QueueScope = "all" | "today" | "overdue" | "unassigned";
type ViewMode = "list" | "pipeline";

const stages: LeadStage[] = ["New Leads", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
const activeStages: LeadStage[] = ["New Leads", "Contacted", "Qualified", "Proposal"];
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const priorityStyle: Record<LeadPriority, string> = {
  Cold: "bg-sky-50 text-sky-700",
  Hot: "bg-rose-50 text-rose-700",
  Warm: "bg-amber-50 text-amber-700"
};
const stageStyle: Record<LeadStage, string> = {
  Contacted: "bg-sky-50 text-sky-700",
  Lost: "bg-slate-100 text-slate-600",
  "New Leads": "bg-violet-50 text-violet-700",
  Proposal: "bg-amber-50 text-amber-700",
  Qualified: "bg-indigo-50 text-indigo-700",
  Won: "bg-emerald-50 text-emerald-700"
};

export default function LeadsPage() {
  const importRef = useRef<HTMLInputElement>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"All" | LeadStage>("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [scope, setScope] = useState<QueueScope>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [followUpType, setFollowUpType] = useState<LeadFollowUp["type"]>("Call");
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");

  useEffect(() => {
    function load() {
      setLeads(readLocalArray<unknown>(LIVE_STATE_STORAGE_KEYS.leads).map(normalizeLead));
      setSalesPeople(readLocalArray<SalesPerson>(LIVE_STATE_STORAGE_KEYS.salesPeople).filter((person) => person.isActive !== false));
      setWorkshops(readLocalArray<Workshop>(LIVE_STATE_STORAGE_KEYS.workshops));
      setClients(readLocalArray<ClientRecord>(LIVE_STATE_STORAGE_KEYS.clients));
    }
    load();
    void hydrateLiveState().then(load);
  }, []);

  const selectedLead = leads.find((lead) => lead.id === selectedId) ?? null;
  const todayCount = leads.filter((lead) => isToday(lead.createdAt)).length;
  const overdueCount = leads.filter(hasOverdueFollowUp).length;
  const unassignedCount = leads.filter((lead) => !lead.assignedTo && !["Won", "Lost"].includes(lead.stage)).length;
  const openPipelineValue = leads.filter((lead) => activeStages.includes(lead.stage)).reduce((sum, lead) => sum + lead.revenuePotential, 0);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (stageFilter !== "All" && lead.stage !== stageFilter) return false;
      if (ownerFilter !== "All" && (ownerFilter === "Unassigned" ? Boolean(lead.assignedTo) : lead.assignedTo !== ownerFilter)) return false;
      if (scope === "today" && !isToday(lead.createdAt)) return false;
      if (scope === "overdue" && !hasOverdueFollowUp(lead)) return false;
      if (scope === "unassigned" && (lead.assignedTo || ["Won", "Lost"].includes(lead.stage))) return false;
      if (!query) return true;
      return [lead.name, lead.mobile, lead.email, lead.city, lead.source, lead.interest, lead.assignedTo, ...(lead.tags ?? [])]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [leads, ownerFilter, scope, search, stageFilter]);

  async function persist(next: Lead[], successMessage?: string) {
    setLeads(next);
    if (successMessage) setMessage(successMessage);
    await saveLiveState({ leads: next });
  }

  function updateLead(id: string, patch: Partial<Lead>, activity?: { message: string; type: Parameters<typeof createLeadActivity>[0] }) {
    const now = new Date().toISOString();
    void persist(leads.map((lead) => {
      if (lead.id !== id) return lead;
      return normalizeLead({
        ...lead,
        ...patch,
        activities: activity ? [createLeadActivity(activity.type, activity.message), ...(lead.activities ?? [])] : lead.activities,
        lastActivityAt: activity ? now : lead.lastActivityAt,
        updatedAt: now
      });
    }));
  }

  function changeStage(lead: Lead, nextStage: LeadStage) {
    if (nextStage === "Lost" && !lead.lostReason) {
      setSelectedId(lead.id);
      setMessage("Add a lost reason in lead details before moving this lead to Lost.");
      return;
    }
    updateLead(lead.id, { stage: nextStage }, { message: `Stage changed from ${lead.stage} to ${nextStage}.`, type: "stage" });
  }

  function moveStage(lead: Lead, direction: -1 | 1) {
    const current = stages.indexOf(lead.stage);
    const next = stages[Math.max(0, Math.min(stages.length - 1, current + direction))];
    if (next) changeStage(lead, next);
  }

  function addNote() {
    if (!selectedLead || !note.trim()) return;
    const value = note.trim();
    updateLead(selectedLead.id, { notes: [value, ...(selectedLead.notes ?? [])] }, { message: value, type: "note" });
    setNote("");
  }

  function addFollowUp() {
    if (!selectedLead || !followUpAt) {
      setMessage("Select a follow-up date and time.");
      return;
    }
    const dueAt = new Date(followUpAt).toISOString();
    const followUp: LeadFollowUp = {
      completed: false,
      createdAt: new Date().toISOString(),
      dueAt,
      id: `followup-${Date.now().toString(36)}`,
      note: followUpNote.trim(),
      type: followUpType
    };
    updateLead(
      selectedLead.id,
      { followUps: [followUp, ...(selectedLead.followUps ?? [])], nextFollowUp: dueAt },
      { message: `${followUpType} follow-up scheduled for ${formatDateTime(dueAt)}.`, type: "follow_up" }
    );
    setFollowUpAt("");
    setFollowUpNote("");
  }

  function completeFollowUp(lead: Lead, id: string) {
    const followUps = (lead.followUps ?? []).map((item) => item.id === id ? { ...item, completed: true, completedAt: new Date().toISOString() } : item);
    updateLead(lead.id, { followUps, nextFollowUp: nextPendingFollowUp(followUps)?.dueAt ?? "" }, { message: "Follow-up completed.", type: "follow_up" });
  }

  async function convertToClient(lead: Lead) {
    const existing = clients.find((client) => normalizeLeadMobile(client.mobile) === normalizeLeadMobile(lead.mobile));
    let clientId = existing?.id ?? Date.now();
    if (!existing) {
      const client: ClientRecord = {
        city: lead.city,
        country: lead.country || "India",
        dob: "",
        email: lead.email,
        gender: "",
        id: clientId,
        mobile: lead.mobile,
        name: lead.name,
        occupation: "",
        state: lead.state,
        status: "Active"
      };
      try {
        const response = await fetch("/api/crm/clients", {
          body: JSON.stringify(client),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.client?.id) clientId = Number(data.client.id) || clientId;
        if (!response.ok && response.status !== 400 && response.status !== 409) throw new Error(data.error || "Client conversion failed.");
      } catch (error) {
        setMessage(error instanceof Error ? `${error.message} Saved to local client list.` : "Saved to local client list.");
      }
      const nextClients = [client, ...clients];
      setClients(nextClients);
      await saveLiveState({ clients: nextClients });
    }
    updateLead(lead.id, { convertedClientId: String(clientId), stage: "Won" }, { message: `Converted to client #${clientId}.`, type: "conversion" });
    setMessage(existing ? "Existing client linked and lead marked Won." : "Lead converted to client successfully.");
  }

  function deleteLead() {
    if (!deleteTarget) return;
    const next = leads.filter((lead) => lead.id !== deleteTarget.id);
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setDeleteTarget(null);
    void persist(next, "Lead deleted.");
  }

  function exportCsv() {
    const rows = filteredLeads.map((lead) => [lead.name, lead.mobile, lead.email, lead.city, lead.source, lead.interest ?? "", lead.stage, lead.priority ?? "Warm", lead.assignedTo, lead.nextFollowUp, lead.createdAt]);
    const csv = [["Name", "Mobile", "Email", "City", "Source", "Interest", "Stage", "Priority", "Owner", "Next Follow-up", "Created"], ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    download(csv, "lead-pipeline.csv");
  }

  async function importLeads(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).slice(0, 10_000);
      const byMobile = new Map(leads.map((lead) => [normalizeLeadMobile(lead.mobile), lead]));
      let imported = 0;
      rows.forEach((row) => {
        const mobile = normalizeLeadMobile(pickImportValue(row, ["mobile", "phone", "contact", "mobile no"]));
        const name = pickImportValue(row, ["name", "full name", "lead name"]);
        if (mobile.length !== 10 || !name) return;
        const existing = byMobile.get(mobile);
        if (existing) {
          byMobile.set(mobile, normalizeLead({
            ...existing,
            city: existing.city || pickImportValue(row, ["city"]),
            email: existing.email || pickImportValue(row, ["email", "email id"]),
            interest: existing.interest || pickImportValue(row, ["interest", "workshop"]),
            sourceDetails: [...new Set(["CSV Import", ...(existing.sourceDetails ?? [])])],
            updatedAt: new Date().toISOString()
          }));
        } else {
          const now = new Date().toISOString();
          byMobile.set(mobile, normalizeLead({
            activities: [createLeadActivity("created", "Lead imported from spreadsheet.")],
            assignedTo: pickImportValue(row, ["assigned to", "owner", "sales person"]),
            city: pickImportValue(row, ["city"]),
            country: pickImportValue(row, ["country"]) || "India",
            createdAt: now,
            email: pickImportValue(row, ["email", "email id"]),
            id: createLeadId(),
            interest: pickImportValue(row, ["interest", "workshop"]),
            mobile,
            name,
            priority: normalizePriority(pickImportValue(row, ["priority", "temperature"])),
            source: pickImportValue(row, ["source"]) || "CSV Import",
            sourceDetails: ["CSV Import"],
            stage: normalizeStage(pickImportValue(row, ["stage", "status"])),
            updatedAt: now
          }));
        }
        imported += 1;
      });
      await persist(Array.from(byMobile.values()), `${imported} lead rows processed. Duplicate mobiles were merged.`);
    } catch {
      setMessage("Lead import failed. Use a valid CSV or Excel file with Name and Mobile columns.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <AdminPlatformShell activeLabel="Leads" description="Capture, assign, follow up and convert every enquiry from one sales pipeline." title="Lead Management">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={UsersRound} label="Total Leads" value={leads.length} />
        <Metric icon={Plus} label="New Today" value={todayCount} tone="emerald" />
        <Metric icon={CalendarClock} label="Overdue" value={overdueCount} tone={overdueCount ? "rose" : "slate"} />
        <Metric icon={UserRound} label="Unassigned" value={unassignedCount} tone="amber" />
        <Metric icon={CircleDollarSign} label="Open Value" value={formatInr(openPipelineValue)} tone="indigo" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Sales Pipeline</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{filteredLeads.length} leads match the current view.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <ModeButton active={viewMode === "list"} icon={List} label="List" onClick={() => setViewMode("list")} />
                <ModeButton active={viewMode === "pipeline"} icon={KanbanSquare} label="Pipeline" onClick={() => setViewMode("pipeline")} />
              </div>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={exportCsv} type="button"><Download className="size-4" />Export</button>
              <input accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => void importLeads(event)} ref={importRef} type="file" />
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={() => importRef.current?.click()} type="button"><Upload className="size-4" />Import</button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700" onClick={() => setCreateOpen(true)} type="button"><Plus className="size-4" />Add Lead</button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(240px,1fr)_180px_200px_auto]">
            <label className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, mobile, source, workshop..." value={search} /></label>
            <select className={inputClass} onChange={(event) => setStageFilter(event.target.value as "All" | LeadStage)} value={stageFilter}><option>All</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select>
            <select className={inputClass} onChange={(event) => setOwnerFilter(event.target.value)} value={ownerFilter}><option>All</option><option>Unassigned</option>{salesPeople.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select>
            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 text-xs font-black uppercase text-slate-500"><SlidersHorizontal className="size-4" />Filters</span>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {([
              ["all", "All Leads", leads.length],
              ["today", "New Today", todayCount],
              ["overdue", "Overdue", overdueCount],
              ["unassigned", "Unassigned", unassignedCount]
            ] as Array<[QueueScope, string, number]>).map(([value, label, count]) => (
              <button className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black ${scope === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} key={value} onClick={() => setScope(value)} type="button">{label} ({count})</button>
            ))}
          </div>
          {message ? <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><span>{message}</span><button aria-label="Dismiss message" onClick={() => setMessage("")} type="button"><X className="size-4" /></button></div> : null}
        </header>

        {viewMode === "list" ? (
          <LeadTable leads={filteredLeads} onDelete={setDeleteTarget} onOpen={setSelectedId} onQuickStage={changeStage} />
        ) : (
          <Pipeline leads={filteredLeads} onMove={moveStage} onOpen={setSelectedId} />
        )}
      </section>

      {selectedLead ? (
        <LeadDrawer
          lead={selectedLead}
          onAddFollowUp={addFollowUp}
          onAddNote={addNote}
          onChange={(patch, activity) => updateLead(selectedLead.id, patch, activity)}
          onClose={() => setSelectedId(null)}
          onCompleteFollowUp={(id) => completeFollowUp(selectedLead, id)}
          onConvert={() => void convertToClient(selectedLead)}
          note={note}
          setNote={setNote}
          salesPeople={salesPeople}
          followUpAt={followUpAt}
          followUpNote={followUpNote}
          followUpType={followUpType}
          setFollowUpAt={setFollowUpAt}
          setFollowUpNote={setFollowUpNote}
          setFollowUpType={setFollowUpType}
        />
      ) : null}

      {createOpen ? <CreateLeadModal leads={leads} onClose={() => setCreateOpen(false)} onSave={(lead) => { void persist([lead, ...leads], "Lead created and added to the pipeline."); setCreateOpen(false); setSelectedId(lead.id); }} salesPeople={salesPeople} workshops={workshops} /> : null}
      <ConfirmDialog confirmLabel="Delete Lead" description="This removes the lead and its complete activity history." onCancel={() => setDeleteTarget(null)} onConfirm={deleteLead} open={Boolean(deleteTarget)} title="Delete lead?">{deleteTarget ? `${deleteTarget.name} · ${deleteTarget.mobile}` : null}</ConfirmDialog>
    </AdminPlatformShell>
  );
}

function LeadTable({ leads, onDelete, onOpen, onQuickStage }: { leads: Lead[]; onDelete: (lead: Lead) => void; onOpen: (id: string) => void; onQuickStage: (lead: Lead, stage: LeadStage) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Lead", "Contact", "Interest / Source", "Stage", "Priority", "Owner", "Next Follow-up", "Actions"].map((heading) => <th className="px-4 py-3" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{leads.length ? leads.map((lead) => { const next = nextPendingFollowUp(lead.followUps ?? []); return <tr className="hover:bg-emerald-50/30" key={lead.id}><td className="px-4 py-4"><button className="font-black text-slate-950 hover:text-emerald-700" onClick={() => onOpen(lead.id)} type="button">{lead.name}</button><p className="mt-1 text-xs font-semibold text-slate-400">{formatDateTime(lead.createdAt)}</p></td><td className="px-4 py-4"><p className="font-bold">{formatMobile(lead.mobile)}</p><p className="mt-1 text-xs text-slate-500">{lead.city || lead.email || "No details"}</p></td><td className="max-w-[220px] px-4 py-4"><p className="truncate font-bold text-slate-700">{lead.interest || "General enquiry"}</p><p className="mt-1 text-xs font-semibold text-slate-500">{lead.source}</p></td><td className="px-4 py-4"><select className={`rounded-full border-0 px-3 py-1.5 text-xs font-black outline-none ${stageStyle[lead.stage]}`} onChange={(event) => onQuickStage(lead, event.target.value as LeadStage)} value={lead.stage}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${priorityStyle[lead.priority ?? "Warm"]}`}>{lead.priority ?? "Warm"}</span></td><td className="px-4 py-4 font-bold text-slate-600">{lead.assignedTo || "Unassigned"}</td><td className={`px-4 py-4 text-xs font-bold ${next && new Date(next.dueAt) < new Date() ? "text-rose-600" : "text-slate-600"}`}>{next ? formatDateTime(next.dueAt) : "Not scheduled"}</td><td className="px-4 py-4"><div className="flex gap-2"><a aria-label={`Call ${lead.name}`} className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-700" href={`tel:+91${normalizeLeadMobile(lead.mobile)}`}><Phone className="size-4" /></a><a aria-label={`WhatsApp ${lead.name}`} className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700" href={whatsappUrl(lead)} target="_blank"><MessageCircle className="size-4" /></a><button aria-label={`Delete ${lead.name}`} className="grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-600" onClick={() => onDelete(lead)} type="button"><Trash2 className="size-4" /></button></div></td></tr>; }) : <tr><td className="px-5 py-16 text-center" colSpan={8}><UsersRound className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-black text-slate-700">No leads found</p><p className="mt-1 text-xs font-semibold text-slate-400">Change filters or add a new lead.</p></td></tr>}</tbody></table></div>;
}

function Pipeline({ leads, onMove, onOpen }: { leads: Lead[]; onMove: (lead: Lead, direction: -1 | 1) => void; onOpen: (id: string) => void }) {
  return <div className="overflow-x-auto bg-slate-50/70 p-4"><div className="grid min-w-[1380px] grid-cols-6 gap-3">{stages.map((stage) => { const rows = leads.filter((lead) => lead.stage === stage); return <section className="min-w-0 rounded-xl border border-slate-200 bg-white" key={stage}><header className="flex items-center justify-between border-b border-slate-200 px-3 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${stageStyle[stage]}`}>{stage}</span><span className="text-xs font-black text-slate-400">{rows.length}</span></header><div className="max-h-[620px] space-y-2 overflow-y-auto p-2">{rows.map((lead) => <article className="rounded-lg border border-slate-200 p-3 shadow-sm" key={lead.id}><button className="block w-full text-left" onClick={() => onOpen(lead.id)} type="button"><p className="truncate font-black text-slate-950">{lead.name}</p><p className="mt-1 truncate text-xs font-semibold text-slate-500">{lead.interest || lead.source}</p><div className="mt-3 flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${priorityStyle[lead.priority ?? "Warm"]}`}>{lead.priority ?? "Warm"}</span><span className="max-w-[100px] truncate text-[10px] font-bold text-slate-400">{lead.assignedTo || "Unassigned"}</span></div></button><div className="mt-3 flex justify-between border-t border-slate-100 pt-2"><button aria-label="Move stage left" className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25" disabled={stage === stages[0]} onClick={() => onMove(lead, -1)} type="button"><ArrowLeft className="size-3.5" /></button><button aria-label="Move stage right" className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25" disabled={stage === stages[stages.length - 1]} onClick={() => onMove(lead, 1)} type="button"><ArrowRight className="size-3.5" /></button></div></article>)}{!rows.length ? <p className="py-8 text-center text-xs font-bold text-slate-400">No leads</p> : null}</div></section>; })}</div></div>;
}

function LeadDrawer(props: { lead: Lead; note: string; setNote: (value: string) => void; salesPeople: SalesPerson[]; followUpAt: string; followUpNote: string; followUpType: LeadFollowUp["type"]; setFollowUpAt: (value: string) => void; setFollowUpNote: (value: string) => void; setFollowUpType: (value: LeadFollowUp["type"]) => void; onAddFollowUp: () => void; onAddNote: () => void; onChange: (patch: Partial<Lead>, activity?: { message: string; type: Parameters<typeof createLeadActivity>[0] }) => void; onClose: () => void; onCompleteFollowUp: (id: string) => void; onConvert: () => void }) {
  const { lead } = props;
  return <div aria-modal="true" className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm" role="dialog"><button aria-label="Close lead details" className="min-w-0 flex-1 cursor-default" onClick={props.onClose} type="button" /><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${priorityStyle[lead.priority ?? "Warm"]}`}>{lead.priority ?? "Warm"}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${stageStyle[lead.stage]}`}>{lead.stage}</span></div><h2 className="mt-3 truncate text-2xl font-black text-slate-950">{lead.name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{formatMobile(lead.mobile)} · {lead.source}</p></div><button aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500" onClick={props.onClose} type="button"><X className="size-4" /></button></header><div className="space-y-6 p-5"><div className="grid grid-cols-3 gap-2"><a className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-3 text-sm font-black text-white" href={`tel:+91${normalizeLeadMobile(lead.mobile)}`}><Phone className="size-4" />Call</a><a className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-3 text-sm font-black text-white" href={whatsappUrl(lead)} target="_blank"><MessageCircle className="size-4" />WhatsApp</a><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-3 text-sm font-black text-white disabled:opacity-50" disabled={Boolean(lead.convertedClientId)} onClick={props.onConvert} type="button"><UserCheck className="size-4" />{lead.convertedClientId ? "Converted" : "Convert"}</button></div><section><h3 className="text-xs font-black uppercase text-slate-500">Lead Qualification</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Stage"><select className={inputClass} onChange={(event) => props.onChange({ stage: event.target.value as LeadStage }, { message: `Stage changed to ${event.target.value}.`, type: "stage" })} value={lead.stage}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></Field><Field label="Priority"><select className={inputClass} onChange={(event) => props.onChange({ priority: event.target.value as LeadPriority })} value={lead.priority ?? "Warm"}><option>Hot</option><option>Warm</option><option>Cold</option></select></Field><Field label="Assigned Sales Person"><select className={inputClass} onChange={(event) => props.onChange({ assignedTo: event.target.value }, { message: event.target.value ? `Assigned to ${event.target.value}.` : "Lead unassigned.", type: "assignment" })} value={lead.assignedTo}><option value="">Unassigned</option>{props.salesPeople.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></Field><Field label="Revenue Potential"><input className={inputClass} min="0" onChange={(event) => props.onChange({ revenuePotential: Number(event.target.value) || 0 })} type="number" value={lead.revenuePotential} /></Field><Field label="Workshop / Interest"><input className={inputClass} onChange={(event) => props.onChange({ interest: event.target.value })} value={lead.interest ?? ""} /></Field><Field label="Best Contact Time"><input className={inputClass} onChange={(event) => props.onChange({ bestTime: event.target.value })} placeholder="e.g. 5:00 PM to 7:00 PM" value={lead.bestTime} /></Field>{lead.stage === "Lost" ? <div className="sm:col-span-2"><Field label="Lost Reason *"><select className={inputClass} onChange={(event) => props.onChange({ lostReason: event.target.value })} value={lead.lostReason ?? ""}><option value="">Select reason</option>{["Not interested", "Price issue", "No response", "Wrong number", "Timing issue", "Joined competitor", "Duplicate", "Other"].map((reason) => <option key={reason}>{reason}</option>)}</select></Field></div> : null}</div></section><section className="border-t border-slate-200 pt-5"><h3 className="text-xs font-black uppercase text-slate-500">Schedule Follow-up</h3><div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]"><select className={inputClass} onChange={(event) => props.setFollowUpType(event.target.value as LeadFollowUp["type"])} value={props.followUpType}><option>Call</option><option>WhatsApp</option><option>Meeting</option></select><input className={inputClass} min={toLocalInputValue(new Date())} onChange={(event) => props.setFollowUpAt(event.target.value)} type="datetime-local" value={props.followUpAt} /><input className={`${inputClass} sm:col-span-2`} onChange={(event) => props.setFollowUpNote(event.target.value)} placeholder="Follow-up purpose or context" value={props.followUpNote} /><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-black text-white sm:col-span-2" onClick={props.onAddFollowUp} type="button"><CalendarClock className="size-4" />Schedule Follow-up</button></div><div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">{(lead.followUps ?? []).length ? (lead.followUps ?? []).map((followUp) => <div className="flex items-start justify-between gap-3 p-3" key={followUp.id}><div><p className={`text-sm font-black ${followUp.completed ? "text-slate-400 line-through" : new Date(followUp.dueAt) < new Date() ? "text-rose-600" : "text-slate-800"}`}>{followUp.type} · {formatDateTime(followUp.dueAt)}</p>{followUp.note ? <p className="mt-1 text-xs font-semibold text-slate-500">{followUp.note}</p> : null}</div>{!followUp.completed ? <button aria-label="Complete follow-up" className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700" onClick={() => props.onCompleteFollowUp(followUp.id)} type="button"><Check className="size-4" /></button> : <span className="text-xs font-black text-emerald-600">Done</span>}</div>) : <p className="p-4 text-center text-xs font-bold text-slate-400">No follow-ups scheduled.</p>}</div></section><section className="border-t border-slate-200 pt-5"><h3 className="text-xs font-black uppercase text-slate-500">Add Note</h3><textarea className={`${inputClass} mt-3 min-h-24 resize-y`} onChange={(event) => props.setNote(event.target.value)} placeholder="Add call outcome, customer context or next step..." value={props.note} /><button className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white" onClick={props.onAddNote} type="button"><Send className="size-4" />Save Note</button></section><section className="border-t border-slate-200 pt-5"><h3 className="text-xs font-black uppercase text-slate-500">Activity Timeline</h3><div className="mt-4 space-y-4">{(lead.activities ?? []).length ? (lead.activities ?? []).map((activity) => <div className="relative border-l-2 border-slate-200 pl-5" key={activity.id}><span className="absolute -left-[5px] top-1 size-2 rounded-full bg-emerald-500" /><p className="text-sm font-bold text-slate-700">{activity.message}</p><p className="mt-1 text-xs font-semibold text-slate-400">{formatDateTime(activity.createdAt)} · {activity.createdBy || "Admin"}</p></div>) : <p className="text-sm font-semibold text-slate-400">No activity recorded.</p>}</div></section></div></aside></div>;
}

function CreateLeadModal({ leads, onClose, onSave, salesPeople, workshops }: { leads: Lead[]; onClose: () => void; onSave: (lead: Lead) => void; salesPeople: SalesPerson[]; workshops: Workshop[] }) {
  const [name, setName] = useState(""); const [mobile, setMobile] = useState(""); const [email, setEmail] = useState(""); const [city, setCity] = useState(""); const [source, setSource] = useState("Manual"); const [interest, setInterest] = useState(""); const [assignedTo, setAssignedTo] = useState(""); const [priority, setPriority] = useState<LeadPriority>("Warm"); const [error, setError] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); const digits = normalizeLeadMobile(mobile); if (!name.trim() || digits.length !== 10) { setError("Name and valid 10-digit mobile are required."); return; } if (leads.some((lead) => normalizeLeadMobile(lead.mobile) === digits)) { setError("This mobile already exists in the lead pipeline."); return; } const now = new Date().toISOString(); onSave(normalizeLead({ activities: [createLeadActivity("created", "Lead added manually.")], assignedTo, city, country: "India", createdAt: now, email, id: createLeadId(), interest, mobile: digits, name: name.trim(), priority, score: priority === "Hot" ? 80 : priority === "Cold" ? 30 : 55, source, sourceDetails: [`${source}: ${interest || "General enquiry"}`], stage: "New Leads", updatedAt: now })); }
  return <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog"><form className="max-h-[92vh] w-full overflow-y-auto bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-xl" onSubmit={submit}><div className="flex items-start justify-between"><div><h2 className="text-2xl font-black">Add Lead</h2><p className="mt-1 text-sm font-semibold text-slate-500">Create a lead and assign the first owner.</p></div><button aria-label="Close" className="grid size-10 place-items-center rounded-lg border border-slate-200" onClick={onClose} type="button"><X className="size-4" /></button></div>{error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}<div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Full Name *"><input autoFocus className={inputClass} onChange={(event) => setName(event.target.value)} value={name} /></Field><Field label="Mobile *"><input className={inputClass} inputMode="numeric" onChange={(event) => setMobile(event.target.value)} value={mobile} /></Field><Field label="Email"><input className={inputClass} onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></Field><Field label="City"><input className={inputClass} onChange={(event) => setCity(event.target.value)} value={city} /></Field><Field label="Source"><select className={inputClass} onChange={(event) => setSource(event.target.value)} value={source}>{["Manual", "Registration Link", "Landing Page", "WhatsApp", "Referral", "CSV Import", "Website"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Workshop / Interest"><select className={inputClass} onChange={(event) => setInterest(event.target.value)} value={interest}><option value="">General enquiry</option>{workshops.map((workshop) => <option key={workshop.id}>{workshop.name}</option>)}</select></Field><Field label="Priority"><select className={inputClass} onChange={(event) => setPriority(event.target.value as LeadPriority)} value={priority}><option>Hot</option><option>Warm</option><option>Cold</option></select></Field><Field label="Assign To"><select className={inputClass} onChange={(event) => setAssignedTo(event.target.value)} value={assignedTo}><option value="">Unassigned</option>{salesPeople.map((person) => <option key={person.id}>{person.name}</option>)}</select></Field></div><div className="mt-6 flex justify-end gap-2"><button className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-black text-slate-700" onClick={onClose} type="button">Cancel</button><button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white" type="submit">Create Lead</button></div></form></div>;
}

function Metric({ icon: Icon, label, tone = "slate", value }: { icon: typeof UsersRound; label: string; tone?: "slate" | "emerald" | "rose" | "amber" | "indigo"; value: number | string }) { const styles = { amber: "bg-amber-50 text-amber-700", emerald: "bg-emerald-50 text-emerald-700", indigo: "bg-indigo-50 text-indigo-700", rose: "bg-rose-50 text-rose-700", slate: "bg-slate-100 text-slate-700" }; return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${styles[tone]}`}><Icon className="size-5" /></span><div className="min-w-0"><p className="truncate text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 truncate text-xl font-black text-slate-950">{value}</p></div></div>; }
function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof List; label: string; onClick: () => void }) { return <button className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-black ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} onClick={onClick} type="button"><Icon className="size-4" />{label}</button>; }
function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="block"><span className="mb-2 block text-xs font-black uppercase text-slate-500">{label}</span>{children}</label>; }
function formatMobile(value: string) { const digits = normalizeLeadMobile(value); return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : value || "-"; }
function formatInr(value: number) { return `INR ${value.toLocaleString("en-IN")}`; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-IN", { day: "2-digit", hour: "2-digit", hour12: true, minute: "2-digit", month: "short", year: "numeric" }); }
function isToday(value: string) { const date = new Date(value); const now = new Date(); return !Number.isNaN(date.getTime()) && date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); }
function hasOverdueFollowUp(lead: Lead) { const followUp = nextPendingFollowUp(lead.followUps ?? []); return Boolean(followUp && new Date(followUp.dueAt).getTime() < Date.now() && !["Won", "Lost"].includes(lead.stage)); }
function whatsappUrl(lead: Lead) { return `https://wa.me/91${normalizeLeadMobile(lead.mobile)}?text=${encodeURIComponent(`Hello ${lead.name}, this is Coach For Life regarding ${lead.interest || "your enquiry"}.`)}`; }
function toLocalInputValue(date: Date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16); }
function download(content: string, filename: string) { const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
function normalizeHeader(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function pickImportValue(row: Record<string, unknown>, keys: string[]) { const values = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? "").trim()])); for (const key of keys) { const value = values.get(normalizeHeader(key)); if (value) return value; } return ""; }
function normalizePriority(value: string): LeadPriority { const normalized = value.toLowerCase(); return normalized.includes("hot") ? "Hot" : normalized.includes("cold") ? "Cold" : "Warm"; }
function normalizeStage(value: string): LeadStage { const normalized = value.toLowerCase(); return stages.find((stage) => stage.toLowerCase() === normalized) ?? "New Leads"; }
