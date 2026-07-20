"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { hydrateLiveState, readLocalArray, saveLiveState } from "@/lib/live-state";
import { generateId } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Download,
  MessageCircle,
  PhoneCall,
  Plus,
  Search,
  UserCheck,
  UsersRound
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type LeadStatus = "New" | "Contacted" | "Interested" | "Intro Attended" | "Registered" | "No Show" | "Dropped";
type LeadSource = "Instagram" | "Facebook" | "WhatsApp" | "Offline Workshop" | "Referral" | "Manual" | "Other";
type WorkshopState = "Invited" | "Attended Intro" | "Registered";
type ContactMethod = "Call" | "WhatsApp" | "Instagram DM" | "Facebook DM" | "Email" | "Meeting" | "Other";

type WorkshopRecord = {
  id: string;
  name: string;
};

type SalesPersonRecord = {
  id: string;
  isActive?: boolean;
  name: string;
};

type LeadWorkshopLink = {
  id: string;
  status: WorkshopState;
  updatedAt: string;
  workshopId: string;
  workshopName: string;
};

type LeadContactLog = {
  id: string;
  createdAt: string;
  method: ContactMethod;
  notes: string;
};

type LeadRecord = {
  id: string;
  assignedTo: string;
  city: string;
  contactLogs: LeadContactLog[];
  createdAt: string;
  email: string;
  mobile: string;
  name: string;
  nextFollowUp: string;
  notes: string;
  source: LeadSource;
  status: LeadStatus;
  tags: string[];
  updatedAt: string;
  workshopLinks: LeadWorkshopLink[];
};

const LEADS_STORAGE_KEY = "cfl_leads_v1";
const WORKSHOP_STORAGE_KEY = "cfl_workshop_master_records_v1";
const SALES_STORAGE_KEY = "cfl_sales_people_v1";
const statuses: LeadStatus[] = ["New", "Contacted", "Interested", "Intro Attended", "Registered", "No Show", "Dropped"];
const sources: LeadSource[] = ["Instagram", "Facebook", "WhatsApp", "Offline Workshop", "Referral", "Manual", "Other"];
const workshopStates: WorkshopState[] = ["Invited", "Attended Intro", "Registered"];
const contactMethods: ContactMethod[] = ["Call", "WhatsApp", "Instagram DM", "Facebook DM", "Email", "Meeting", "Other"];

const emptyLead = (): LeadRecord => ({
  assignedTo: "",
  city: "",
  contactLogs: [],
  createdAt: new Date().toISOString(),
  email: "",
  id: generateId(),
  mobile: "",
  name: "",
  nextFollowUp: "",
  notes: "",
  source: "Instagram",
  status: "New",
  tags: [],
  updatedAt: new Date().toISOString(),
  workshopLinks: []
});

function csvCell(value: string | number) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cleanMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(-10);
  return digits;
}

function formatDate(value: string) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusTone(status: LeadStatus) {
  if (status === "Registered") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "Interested" || status === "Intro Attended") return "bg-blue-50 text-blue-700 ring-blue-100";
  if (status === "Dropped" || status === "No Show") return "bg-rose-50 text-rose-700 ring-rose-100";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default function LeadManagementPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopRecord[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPersonRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<LeadRecord>(() => emptyLead());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | LeadStatus>("All");
  const [sourceFilter, setSourceFilter] = useState<"All" | LeadSource>("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [workshopId, setWorkshopId] = useState("");
  const [workshopState, setWorkshopState] = useState<WorkshopState>("Invited");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("Call");
  const [contactNote, setContactNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    function loadLocal() {
      setLeads(readLocalArray<LeadRecord>(LEADS_STORAGE_KEY));
      setWorkshops(readLocalArray<WorkshopRecord>(WORKSHOP_STORAGE_KEY));
      setSalesPeople(readLocalArray<SalesPersonRecord>(SALES_STORAGE_KEY).filter((person) => person.isActive !== false));
    }

    loadLocal();
    hydrateLiveState().then(loadLocal);
  }, []);

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedId) ?? null, [leads, selectedId]);

  useEffect(() => {
    if (selectedLead) setForm({ ...emptyLead(), ...selectedLead, contactLogs: selectedLead.contactLogs ?? [], workshopLinks: selectedLead.workshopLinks ?? [] });
  }, [selectedLead]);

  function saveLeads(next: LeadRecord[], nextMessage: string) {
    const sorted = [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setLeads(sorted);
    void saveLiveState({ leads: sorted });
    setMessage(nextMessage);
  }

  const filteredLeads = useMemo(() => {
    const value = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesQuery = !value || [lead.name, lead.mobile, lead.email, lead.city, lead.notes, lead.assignedTo, lead.source, lead.status].some((field) => field.toLowerCase().includes(value));
      const matchesStatus = statusFilter === "All" || lead.status === statusFilter;
      const matchesSource = sourceFilter === "All" || lead.source === sourceFilter;
      const matchesAssignee = assigneeFilter === "All" || lead.assignedTo === assigneeFilter;
      return matchesQuery && matchesStatus && matchesSource && matchesAssignee;
    });
  }, [assigneeFilter, leads, query, sourceFilter, statusFilter]);

  const registeredCount = leads.filter((lead) => lead.status === "Registered").length;
  const activeCount = leads.filter((lead) => ["New", "Contacted", "Interested", "Intro Attended"].includes(lead.status)).length;
  const unassignedCount = leads.filter((lead) => !lead.assignedTo).length;

  function nextSalesPerson() {
    if (!salesPeople.length) return "";
    const index = leads.length % salesPeople.length;
    return salesPeople[index]?.name ?? "";
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() && !form.mobile.trim() && !form.email.trim()) {
      setMessage("Name, mobile or email is required.");
      return;
    }
    const now = new Date().toISOString();
    const payload: LeadRecord = {
      ...form,
      mobile: cleanMobile(form.mobile),
      name: form.name.trim() || "Unnamed Lead",
      updatedAt: now
    };
    const exists = leads.some((lead) => lead.id === payload.id);
    saveLeads(exists ? leads.map((lead) => lead.id === payload.id ? payload : lead) : [payload, ...leads], exists ? "Lead updated." : "Lead created.");
    setSelectedId(payload.id);
  }

  function createFreshLead() {
    const next = emptyLead();
    setSelectedId("");
    setForm(next);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function autoAssign(leadId: string) {
    const assignee = nextSalesPerson();
    if (!assignee) {
      setMessage("Create an active sales person before auto assignment.");
      return;
    }
    saveLeads(leads.map((lead) => lead.id === leadId ? { ...lead, assignedTo: assignee, updatedAt: new Date().toISOString() } : lead), `Lead assigned to ${assignee}.`);
  }

  function trackWorkshop() {
    const workshop = workshops.find((item) => item.id === workshopId);
    if (!selectedLead || !workshop) {
      setMessage("Select a lead and workshop first.");
      return;
    }
    const now = new Date().toISOString();
    const link: LeadWorkshopLink = {
      id: selectedLead.workshopLinks.find((item) => item.workshopId === workshop.id)?.id ?? generateId(),
      status: workshopState,
      updatedAt: now,
      workshopId: workshop.id,
      workshopName: workshop.name
    };
    const nextStatus: LeadStatus = workshopState === "Registered" ? "Registered" : workshopState === "Attended Intro" ? "Intro Attended" : selectedLead.status;
    saveLeads(leads.map((lead) => lead.id === selectedLead.id ? {
      ...lead,
      status: nextStatus,
      updatedAt: now,
      workshopLinks: [link, ...lead.workshopLinks.filter((item) => item.workshopId !== workshop.id)]
    } : lead), "Workshop tracking updated.");
  }

  function addContactLog() {
    if (!selectedLead || !contactNote.trim()) return;
    const now = new Date().toISOString();
    const log: LeadContactLog = { createdAt: now, id: generateId(), method: contactMethod, notes: contactNote.trim() };
    saveLeads(leads.map((lead) => lead.id === selectedLead.id ? {
      ...lead,
      contactLogs: [log, ...(lead.contactLogs ?? [])],
      status: lead.status === "New" ? "Contacted" : lead.status,
      updatedAt: now
    } : lead), "Contact log added.");
    setContactNote("");
    setContactMethod("Call");
  }

  function exportLeads() {
    downloadCsv("cfl-leads.csv", [
      ["Name", "Mobile", "Email", "City", "Source", "Status", "Assigned To", "Workshops", "Contact Logs", "Next Follow Up", "Notes"],
      ...filteredLeads.map((lead) => [
        lead.name,
        lead.mobile,
        lead.email,
        lead.city,
        lead.source,
        lead.status,
        lead.assignedTo || "Unassigned",
        lead.workshopLinks.length,
        lead.contactLogs.length,
        lead.nextFollowUp,
        lead.notes
      ])
    ]);
    setMessage(`Exported ${filteredLeads.length} lead rows.`);
  }

  async function copyWhatsAppTargets() {
    const numbers = [...new Set(filteredLeads.filter((lead) => lead.status !== "Registered").map((lead) => cleanMobile(lead.mobile)).filter((mobile) => mobile.length >= 8))];
    if (!numbers.length) {
      setMessage("No non-registered leads with valid mobile numbers in the current filter.");
      return;
    }
    await navigator.clipboard.writeText(numbers.join("\n"));
    setMessage(`Copied ${numbers.length} WhatsApp target numbers.`);
  }

  return (
    <AdminPlatformShell activeLabel="Lead Management" description="Manage ad leads, intro attendance, registration conversion, sales assignment and WhatsApp targeting." title="Lead Management">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: UsersRound, label: "Total Leads", value: leads.length, helper: "All imported or created leads" },
          { icon: PhoneCall, label: "Active Pipeline", value: activeCount, helper: "Needs sales follow-up" },
          { icon: CheckCircle2, label: "Registered", value: registeredCount, helper: "Converted into paid product" },
          { icon: UserCheck, label: "Unassigned", value: unassignedCount, helper: "Ready for sales routing" }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" key={item.label}>
              <span className="grid size-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon className="size-5" /></span>
              <p className="mt-4 text-2xl font-black text-slate-950">{item.value}</p>
              <p className="text-sm font-bold text-slate-700">{item.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{item.helper}</p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" onSubmit={submit}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950">{selectedLead ? "Edit Lead" : "Create Lead"}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Capture source, owner and follow-up status.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={createFreshLead} type="button">
              <Plus className="size-4" />
              New
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Field label="Name"><input className={inputClass} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Participant name" value={form.name} /></Field>
            <Field label="Mobile"><input className={inputClass} onChange={(event) => setForm({ ...form, mobile: event.target.value })} placeholder="WhatsApp/mobile number" value={form.mobile} /></Field>
            <Field label="Email"><input className={inputClass} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email address" type="email" value={form.email} /></Field>
            <Field label="City"><input className={inputClass} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="City" value={form.city} /></Field>
            <Field label="Source">
              <select className={inputClass} onChange={(event) => setForm({ ...form, source: event.target.value as LeadSource })} value={form.source}>
                {sources.map((source) => <option key={source}>{source}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} onChange={(event) => setForm({ ...form, status: event.target.value as LeadStatus })} value={form.status}>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Assigned To">
              <select className={inputClass} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} value={form.assignedTo}>
                <option value="">Unassigned</option>
                {salesPeople.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}
              </select>
            </Field>
            <Field label="Next Follow Up"><input className={inputClass} onChange={(event) => setForm({ ...form, nextFollowUp: event.target.value })} type="date" value={form.nextFollowUp} /></Field>
          </div>

          <Field label="Notes">
            <textarea className={`${inputClass} mt-3 min-h-28`} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Sales notes, objections, intro session interest..." value={form.notes} />
          </Field>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800" type="submit">
              <CheckCircle2 className="size-4" />
              Save Lead
            </button>
            {selectedLead ? (
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => autoAssign(selectedLead.id)} type="button">
                <UserCheck className="size-4" />
                Auto Assign
              </button>
            ) : null}
          </div>
          {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950">Lead Pipeline</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Filter leads before export or WhatsApp targeting.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={copyWhatsAppTargets} type="button">
                <Clipboard className="size-4" />
                Copy WhatsApp Targets
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={exportLeads} type="button">
                <Download className="size-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <label className="relative md:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-emerald-400" onChange={(event) => setQuery(event.target.value)} placeholder="Search leads" value={query} />
            </label>
            <select className={filterClass} onChange={(event) => setStatusFilter(event.target.value as "All" | LeadStatus)} value={statusFilter}>
              <option>All</option>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <select className={filterClass} onChange={(event) => setSourceFilter(event.target.value as "All" | LeadSource)} value={sourceFilter}>
              <option>All</option>
              {sources.map((source) => <option key={source}>{source}</option>)}
            </select>
            <select className={filterClass} onChange={(event) => setAssigneeFilter(event.target.value)} value={assigneeFilter}>
              <option>All</option>
              {salesPeople.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}
            </select>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{["Lead", "Source", "Status", "Assignee", "Workshops", "Logs", "Follow Up"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length ? filteredLeads.map((lead) => (
                  <tr className={`cursor-pointer hover:bg-emerald-50/40 ${selectedId === lead.id ? "bg-emerald-50/70" : ""}`} key={lead.id} onClick={() => setSelectedId(lead.id)}>
                    <td className="px-4 py-4"><p className="font-black text-slate-950">{lead.name}</p><p className="text-xs font-semibold text-slate-500">{lead.mobile || lead.email || "No contact"}</p></td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{lead.source}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone(lead.status)}`}>{lead.status}</span></td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{lead.assignedTo || "Unassigned"}</td>
                    <td className="px-4 py-4 font-bold text-slate-900">{lead.workshopLinks?.length ?? 0}</td>
                    <td className="px-4 py-4 font-bold text-slate-900">{lead.contactLogs?.length ?? 0}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(lead.nextFollowUp)}</td>
                  </tr>
                )) : (
                  <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={7}>No leads match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedLead ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Workshop Tracking</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Track which intro sessions this lead joined.</p>
              </div>
              <CalendarDays className="size-5 text-emerald-700" />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px_auto]">
              <select className={filterClass} onChange={(event) => setWorkshopId(event.target.value)} value={workshopId}>
                <option value="">Select workshop</option>
                {workshops.map((workshop) => <option key={workshop.id} value={workshop.id}>{workshop.name}</option>)}
              </select>
              <select className={filterClass} onChange={(event) => setWorkshopState(event.target.value as WorkshopState)} value={workshopState}>
                {workshopStates.map((state) => <option key={state}>{state}</option>)}
              </select>
              <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white" onClick={trackWorkshop} type="button">Track</button>
            </div>
            <div className="mt-4 space-y-2">
              {selectedLead.workshopLinks?.length ? selectedLead.workshopLinks.map((link) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3" key={link.id}>
                  <div><p className="font-black text-slate-950">{link.workshopName}</p><p className="text-xs font-semibold text-slate-500">{formatDate(link.updatedAt)}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${link.status === "Registered" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-blue-50 text-blue-700 ring-blue-100"}`}>{link.status}</span>
                </div>
              )) : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-semibold text-slate-500">No workshop activity tracked yet.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Contact Log</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Record call, WhatsApp and DM follow-up history.</p>
              </div>
              <MessageCircle className="size-5 text-emerald-700" />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[180px_1fr_auto]">
              <select className={filterClass} onChange={(event) => setContactMethod(event.target.value as ContactMethod)} value={contactMethod}>
                {contactMethods.map((method) => <option key={method}>{method}</option>)}
              </select>
              <input className={filterClass} onChange={(event) => setContactNote(event.target.value)} placeholder="Follow-up note" value={contactNote} />
              <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white" onClick={addContactLog} type="button">Add Log</button>
            </div>
            <div className="mt-4 space-y-2">
              {selectedLead.contactLogs?.length ? selectedLead.contactLogs.map((log) => (
                <div className="rounded-xl border border-slate-200 px-4 py-3" key={log.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-950">{log.method}</p>
                    <p className="text-xs font-semibold text-slate-500">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{log.notes}</p>
                </div>
              )) : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-semibold text-slate-500">No contact log yet.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </AdminPlatformShell>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="block text-sm font-black text-slate-700"><span>{label}</span>{children}</label>;
}

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";
const filterClass = "h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400";
