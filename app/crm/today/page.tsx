"use client";

import { CrmNoteModal } from "@/components/crm-note-modal";
import { addCrmNote } from "@/lib/crm-note";
import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { createLeadActivity, nextPendingFollowUp, normalizeLead } from "@/lib/lead-utils";
import { compareLeads, lastContactTime, matchesLeadSearch, type LeadSort } from "@/lib/crm-today-list";
import { rankNextBestActions } from "@/lib/crm-workflow";
import { LIVE_STATE_STORAGE_KEYS, readLocalArray, saveLiveState } from "@/lib/live-state";
import { clearCrmDashboard, loadCrmDashboard } from "@/lib/crm-dashboard-cache";
import type { Lead, LeadFollowUp } from "@/lib/types";
import { AlertTriangle, CalendarClock, Clock3, Download, Flame, Phone, Search, Target, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const istDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

export default function CrmTodayPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [mobileSearch, setMobileSearch] = useState("");
  const [sortBy, setSortBy] = useState<LeadSort>("urgency");
  const [descending, setDescending] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [callLead, setCallLead] = useState<Lead | null>(null);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let active = true;
    void loadCrmDashboard().then((state) => {
      if (!active) return;
      if (!state || state.error) {
        setLoadStatus("error");
        return;
      }
      const records = state.dbEnabled === false ? readLocalArray<unknown>(LIVE_STATE_STORAGE_KEYS.leads) : state.leads ?? [];
      setLeads(records.map(normalizeLead));
      setLoadStatus("ready");
    }).catch(() => { if (active) setLoadStatus("error"); });
    return () => { active = false; };
  }, [reloadKey]);
  function refreshLeads() {
    clearCrmDashboard();
    setLoadStatus("loading");
    setReloadKey((key) => key + 1);
  }
  useEffect(() => { setVisibleLimit(50); }, [mobileSearch, fromDate, toDate, sortBy, descending]);
  const ranked = useMemo(() => rankNextBestActions(leads.filter((lead) => !lead.blocked)), [leads]);
  const counts = useMemo(() => {
    const now = new Date();
    const today = istDate.format(now);
    const onToday = (value: string) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && istDate.format(date) === today;
    };
    const result = { hot: 0, due: 0, overdue: 0, meetings: 0, newLeads: 0, noAction: 0 };
    for (const lead of leads) {
      if (onToday(lead.createdAt)) result.newLeads++;
      if (lead.blocked || ["Won", "Lost"].includes(lead.stage)) continue;
      if (lead.priority === "Hot" || lead.score >= 65) result.hot++;
      const next = nextPendingFollowUp(lead.followUps ?? []);
      if (!next) result.noAction++;
      else {
        if (onToday(next.dueAt)) result.due++;
        if (new Date(next.dueAt) < now) result.overdue++;
      }
      for (const item of lead.followUps ?? []) {
        if (item.type === "Meeting" && !item.completed && onToday(item.dueAt)) result.meetings++;
      }
    }
    return result;
  }, [leads]);
  async function save(next: Lead[]) { if (!await saveLiveState({ leads: next })) throw new Error("Could not save changes. Please try again."); setLeads(next); }
  async function completeNext(lead: Lead) { const target=nextPendingFollowUp(lead.followUps ?? []); if (!target) return; const followUps=(lead.followUps ?? []).map((item)=>item.id===target.id?{...item,completed:true,completedAt:new Date().toISOString()}:item); await save(leads.map((item)=>item.id===lead.id?normalizeLead({...item,followUps,nextFollowUp:nextPendingFollowUp(followUps)?.dueAt ?? "",activities:[createLeadActivity("follow_up","Next action completed."),...(item.activities ?? [])]}):item)); setMessage(`${lead.name}: action completed.`); }
  const allLeads = useMemo(() => {
    const rankedIds = new Set(ranked.map((item) => item.lead.id));
    return [...ranked, ...leads.filter((lead) => !rankedIds.has(lead.id)).map((lead) => ({ lead, reason: lead.blocked ? "Blocked" : lead.stage, recommendedAction: "Open lead" }))];
  }, [ranked, leads]);
  const isSearching = mobileSearch.trim().length > 0;
  const hasDateFilter = Boolean(fromDate || toDate);
  const hasFilters = isSearching || hasDateFilter;
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  const visibleLeads = useMemo(() => { const filtered = allLeads.filter(({ lead }) => {
    if (invalidRange || !matchesLeadSearch(lead, mobileSearch)) return false;
    if (!hasDateFilter) return true;
    const date = new Date(lead.createdAt);
    if (Number.isNaN(date.getTime())) return false;
    const createdDate = istDate.format(date);
    return (!fromDate || createdDate >= fromDate) && (!toDate || createdDate <= toDate);
  }); return sortBy === "urgency" ? filtered : filtered.sort((a, b) => compareLeads(a.lead, b.lead, sortBy, descending)); }, [allLeads, invalidRange, mobileSearch, hasDateFilter, fromDate, toDate, sortBy, descending]);

  function clearFilters() {
    setMobileSearch("");
    setFromDate("");
    setToDate("");
  }

  async function downloadExcel() {
    if (exporting || !visibleLeads.length) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = visibleLeads.map(({ lead, reason }, index) => ({
        "Sr. No.": index + 1,
        "Lead ID": lead.id,
        "Name": lead.name,
        "Mobile": String(lead.mobile ?? ""),
        "Email": lead.email,
        "City": lead.city,
        "State": lead.state,
        "Country": lead.country,
        "Interest": lead.interest ?? "",
        "Source": lead.source,
        "Source Details": (lead.sourceDetails ?? []).join("\n"),
        "Stage": lead.stage,
        "Priority": lead.priority ?? "",
        "Score": lead.score,
        "Assigned To": lead.assignedTo,
        "Salesperson Code": lead.assignedSalesPersonCode ?? "",
        "Created At (IST)": exportDateTime(lead.createdAt),
        "Next Follow-up (IST)": exportDateTime(nextPendingFollowUp(lead.followUps ?? [])?.dueAt || lead.nextFollowUp),
        "Last Activity (IST)": exportDateTime(lead.lastActivityAt),
        "Best Time to Call": lead.bestTime,
        "Revenue Potential": lead.revenuePotential,
        "Notes": (lead.notes ?? []).join("\n"),
        "Call History": (lead.callHistory ?? []).join("\n"),
        "Tags": (lead.tags ?? []).join(", "),
        "Blocked": lead.blocked ? "Yes" : "No",
        "Do Not Call": lead.doNotCall ? "Yes" : "No",
        "Lost Reason": lead.lostReason ?? "",
        "Action Reason": reason
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = Object.keys(rows[0]).map((key) => ({ wch: /Notes|History|Details|Reason/.test(key) ? 45 : 24 }));
      sheet["!autofilter"] = { ref: sheet["!ref"]! };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
      const date = istDate.format(new Date());
      XLSX.writeFile(workbook, `CRM-Leads-${date}.xlsx`);
      setMessage(`Excel download started for ${rows.length} leads.`);
    } catch {
      setMessage("Could not download Excel. Please try again.");
    } finally {
      setExporting(false);
    }
  }
  return <AdminPlatformShell activeLabel="CRM Today" description="Your prioritized sales work—who to contact, why, and what to do next." title="Today">
    {message ? <div className="mb-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><span>{message}</span><button onClick={()=>setMessage("")} type="button"><X className="size-4" /></button></div> : null}
    <div className="mb-5"><p className="text-sm font-black text-slate-500">{greeting()}</p><h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Today&apos;s work</h2></div>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Stat icon={Flame} label="Hot leads" value={counts.hot} tone="rose" /><Stat icon={Phone} label="Calls due" value={counts.due} tone="sky" /><Stat icon={AlertTriangle} label="Overdue" value={counts.overdue} tone="rose" /><Stat icon={CalendarClock} label="Meetings" value={counts.meetings} tone="violet" /><Stat icon={UserPlus} label="New leads" value={counts.newLeads} tone="emerald" /><Stat icon={Clock3} label="No next action" value={counts.noAction} tone="amber" />
    </section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
        <div><h3 className="text-xl font-black">All leads ({allLeads.length})</h3><p className="mt-1 text-sm font-semibold text-slate-500">Search, filter and sort all your leads.</p></div>
        <div className="flex flex-wrap items-center gap-4"><button className="text-sm font-bold text-emerald-700 disabled:opacity-50" disabled={loadStatus === "loading"} onClick={refreshLeads} type="button">Refresh leads</button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={exporting || !visibleLeads.length} onClick={downloadExcel} type="button">
            <Download aria-hidden="true" className="size-4" />{exporting ? "Downloading…" : hasFilters ? "Download filtered Excel" : "Download Excel"}
          </button>
          <a className="text-sm font-black text-emerald-700" href="/crm/follow-ups">All tasks</a>
        </div>
      </header>
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:max-w-xs">
            <label className="block text-sm font-bold text-slate-700" htmlFor="crm-mobile-search">Search by name or mobile</label>
            <div className="relative mt-2">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
              <input autoComplete="off" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm" id="crm-mobile-search" onChange={(event) => setMobileSearch(event.target.value)} placeholder="Name, mobile, city, email or lead ID" type="search" value={mobileSearch} />
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-bold text-slate-700">Lead created date (IST)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                From <input className="rounded-lg border border-slate-300 px-2 py-2.5" max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                To <input className="rounded-lg border border-slate-300 px-2 py-2.5" min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} type="date" value={toDate} />
              </label>
            </div>
          </fieldset>
          <label className="text-sm font-bold text-slate-700">Sort by<select className="mt-2 block rounded-lg border border-slate-300 px-3 py-2.5" value={sortBy} onChange={event => { const value = event.target.value as LeadSort; setSortBy(value); setDescending(value === "contact" || value === "quality"); }}>{[["urgency", "Highest urgency"], ["name", "Name"], ["contact", "Last contact"], ["city", "City"], ["quality", "Lead quality (Hot / Warm / Cold)"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {sortBy !== "urgency" ? <label className="text-sm font-bold text-slate-700">Order<select className="mt-2 block rounded-lg border border-slate-300 px-3 py-2.5" value={descending ? "desc" : "asc"} onChange={event => setDescending(event.target.value === "desc")}><option value="asc">{sortBy === "contact" ? "Oldest first" : sortBy === "quality" ? "Cold to Hot" : "A to Z"}</option><option value="desc">{sortBy === "contact" ? "Latest first" : sortBy === "quality" ? "Hot to Cold" : "Z to A"}</option></select></label> : null}
          {hasFilters ? <button className="rounded-lg px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100" onClick={clearFilters} type="button">Clear filters</button> : null}
        </div>
        {invalidRange ? <p className="mt-2 text-sm text-rose-700" role="alert">The To date must be on or after the From date.</p> : null}
        {loadStatus === "ready" ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800" role="status">Matching leads: {visibleLeads.length} / {allLeads.length} · Showing {Math.min(visibleLimit, visibleLeads.length)}{!visibleLeads.length ? " · No leads match the selected filters." : ""}</p> : null}
      </div>
      <div className="divide-y divide-slate-100">{visibleLeads.slice(0, visibleLimit).map((item, index) => <div className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50" key={item.lead.id}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span>
        <a className="min-w-0 flex-1" href={`/crm/leads/${encodeURIComponent(item.lead.id)}`}><span className="block text-sm font-black">{item.lead.name}</span>{item.lead.mobile ? <span className="mt-1 block text-xs font-semibold text-slate-600">{item.lead.mobile}</span> : null}<span className="mt-1 block text-xs font-semibold text-slate-500">{item.lead.interest || "General enquiry"} · {item.lead.city || item.lead.source}</span><span className="mt-1 block text-xs text-slate-500">{item.reason}</span><span className="mt-1 block text-xs text-slate-500">Quality: {item.lead.priority || "Warm"} · Score: {item.lead.score} · Last contact: {lastContactTime(item.lead) ? exportDateTime(new Date(lastContactTime(item.lead)).toISOString()) : "Not recorded"}</span></a>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{item.lead.stage}</span>
        <button className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={item.lead.blocked} onClick={() => setCallLead(item.lead)} type="button"><Phone className="size-4" />Call</button>
        <button className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700" onClick={() => setNoteLead(item.lead)} type="button">Add note</button>
        <a className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" href={`/crm/leads/${encodeURIComponent(item.lead.id)}`}>Open lead</a>
        {nextPendingFollowUp(item.lead.followUps ?? []) ? <button className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700" onClick={() => void completeNext(item.lead)} type="button">Complete</button> : null}
      </div>)}</div>
      {visibleLeads.length > visibleLimit ? <button className="m-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold" onClick={() => setVisibleLimit((limit) => limit + 50)} type="button">Show more ({visibleLimit} of {visibleLeads.length})</button> : null}
      {loadStatus === "loading" ? <p className="p-5 text-sm text-slate-500" role="status">Loading leads…</p> : null}
      {loadStatus === "error" ? <p className="p-5 text-sm text-rose-700" role="alert">Could not load leads. Use Refresh leads to try again.</p> : null}
      {loadStatus === "ready" && !hasFilters && !allLeads.length ? <Empty /> : null}
    </section>
    {noteLead ? <CrmNoteModal lead={noteLead} onClose={() => setNoteLead(null)} onSave={async (input) => {
      const current = leads.find((lead) => lead.id === noteLead.id);
      if (!current) throw new Error("Lead no longer available. Refresh leads.");
      const updated = addCrmNote(current, input);
      await save(leads.map((lead) => lead.id === updated.id ? updated : lead));
      setNoteLead(null); setMessage(`${updated.name}: note saved.`);
    }} /> : null}
    {callLead ? <CallOutcomeModal lead={callLead} onClose={()=>setCallLead(null)} onSave={async (outcome,note,nextType,nextAt)=>{ const now=new Date().toISOString(); const followUp:LeadFollowUp|undefined=nextAt?{id:`followup-${Date.now().toString(36)}`,dueAt:new Date(nextAt).toISOString(),type:nextType,note,completed:false,createdAt:now}:undefined; const next=leads.map((lead)=>lead.id===callLead.id?normalizeLead({...lead,stage:outcome==="Interested"&&lead.stage==="New Leads"?"Contacted":lead.stage,callHistory:[`${outcome}: ${note}`,...lead.callHistory],followUps:followUp?[followUp,...(lead.followUps??[])]:lead.followUps,nextFollowUp:followUp?.dueAt??lead.nextFollowUp,lastActivityAt:now,activities:[createLeadActivity("call",`Call outcome: ${outcome}${note?` · ${note}`:""}`),...(followUp?[createLeadActivity("follow_up",`${nextType} scheduled for ${formatDateTime(followUp.dueAt)}.`)]:[]),...(lead.activities??[])]}):lead); await save(next); setCallLead(null); setMessage(`${callLead.name}: call outcome saved.`);}} />:null}
  </AdminPlatformShell>;
}

function CallOutcomeModal({lead,onClose,onSave}:{lead:Lead;onClose:()=>void;onSave:(outcome:string,note:string,type:LeadFollowUp["type"],at:string)=>void}) { const [outcome,setOutcome]=useState("Connected"); const [note,setNote]=useState(""); const [type,setType]=useState<LeadFollowUp["type"]>("Call"); const [at,setAt]=useState(""); return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 sm:place-items-center sm:p-4"><form className="w-full bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl" onSubmit={(e)=>{e.preventDefault();onSave(outcome,note,type,at)}}><div className="flex justify-between"><div><h3 className="text-xl font-black">Call outcome</h3><p className="mt-1 text-sm font-semibold text-slate-500">{lead.name} · {lead.mobile}</p></div><button onClick={onClose} type="button"><X className="size-5" /></button></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{["Connected","Not Reachable","Busy","Switched Off","Wrong Number","Interested","Not Interested","Call Back Later","No Response"].map((value)=><button className={`rounded-lg border px-2 py-2.5 text-xs font-black ${outcome===value?"border-slate-950 bg-slate-950 text-white":"border-slate-200 text-slate-600"}`} key={value} onClick={()=>setOutcome(value)} type="button">{value}</button>)}</div><textarea className="mt-4 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold" onChange={(e)=>setNote(e.target.value)} placeholder="Call notes / objection" value={note}/><p className="mt-4 text-xs font-black uppercase text-slate-500">What&apos;s next?</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><select className="rounded-xl border border-slate-200 p-3 text-sm font-bold" onChange={(e)=>setType(e.target.value as LeadFollowUp["type"])} value={type}>{["Call","Meeting","Send Information","Partner Call","Payment Follow-up"].map((v)=><option key={v}>{v}</option>)}</select><input className="rounded-xl border border-slate-200 p-3 text-sm font-bold" onChange={(e)=>setAt(e.target.value)} type="datetime-local" value={at}/></div><button className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white" type="submit">Save outcome</button></form></div> }
function Stat({icon:Icon,label,value,tone}:{icon:typeof Flame;label:string;value:number;tone:"rose"|"sky"|"violet"|"emerald"|"amber"}){const styles={rose:"bg-rose-50 text-rose-700",sky:"bg-sky-50 text-sky-700",violet:"bg-violet-50 text-violet-700",emerald:"bg-emerald-50 text-emerald-700",amber:"bg-amber-50 text-amber-700"};return <div className="rounded-xl border border-slate-200 bg-white p-4"><span className={`grid size-9 place-items-center rounded-lg ${styles[tone]}`}><Icon className="size-4"/></span><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-xs font-black uppercase text-slate-500">{label}</p></div>}
function Empty(){return <div className="grid min-h-72 place-items-center p-6 text-center"><div><Target className="mx-auto size-8 text-slate-300"/><p className="mt-3 font-black">No active leads</p><p className="mt-1 text-sm font-semibold text-slate-500">New assigned leads will appear here.</p></div></div>}
function greeting(){const hour=new Date().getHours();return hour<12?"GOOD MORNING":hour<17?"GOOD AFTERNOON":"GOOD EVENING"}
function isToday(value:string){const date=new Date(value);const now=new Date();return !Number.isNaN(date.getTime())&&istDate.format(date)===istDate.format(now)}
function formatDateTime(value:string){return new Date(value).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:true})}

function exportDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });
}
