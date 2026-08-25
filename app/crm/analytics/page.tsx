"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { callRecordsCsv, callSummary, filterCallRecords, hourlyConnectionRows, leadJourneyRows, leaderboardRows, salespersonCallRows } from "@/lib/call-analytics";
import type { CallFlowCallRecord } from "@/lib/callflow-connector";
import { normalizeLead } from "@/lib/lead-utils";
import { hydrateLiveState, LIVE_STATE_STORAGE_KEYS, readLocalArray, saveLiveState } from "@/lib/live-state";
import type { Lead, LeadPriority, LeadStage } from "@/lib/types";
import { AlertTriangle, BarChart3, Clock3, Download, PhoneCall, PhoneOff, Target, Timer, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

function dateInput(date: Date) { return date.toISOString().slice(0, 10); }
function duration(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const rest = seconds % 60; return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${rest}s` : `${rest}s`; }
function displayDate(value: string) { return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
type SalesPersonLive = { acceptingLeads?: boolean; dailyCallTarget?: number; dailyConnectedTarget?: number; id: string; isActive?: boolean; name: string };
type CallReview = { callId: string; recordingUrl?: string; score: number; note: string; reviewedAt: string };
type ManagerReportDelivery = { id: string; period: "daily" | "weekly"; date: string; generatedAt: string; delivered: boolean; deliveryConfigured: boolean; summary?: { total?: number; connected?: number; connectionRate?: number } };

export default function CrmAnalyticsPage() {
  const today = dateInput(new Date());
  const [leads, setLeads] = useState<Lead[]>([]);
  const [records, setRecords] = useState<CallFlowCallRecord[]>([]);
  const [team, setTeam] = useState<SalesPersonLive[]>([]);
  const [integrations, setIntegrations] = useState<Record<string, unknown>>({});
  const [reviews, setReviews] = useState<CallReview[]>([]);
  const [reviewCallId, setReviewCallId] = useState(""); const [reviewUrl, setReviewUrl] = useState(""); const [reviewScore, setReviewScore] = useState("3"); const [reviewNote, setReviewNote] = useState(""); const [reviewMessage, setReviewMessage] = useState("");
  const [loading, setLoading] = useState(true); const [reviewSaving, setReviewSaving] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [salesperson, setSalesperson] = useState("");
  const [campaign, setCampaign] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState<"" | LeadPriority>("");
  const [stage, setStage] = useState<"" | LeadStage>("");
  const [minMarks, setMinMarks] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
  const [leadSearch, setLeadSearch] = useState("");

  useEffect(() => {
    setLeads(readLocalArray<unknown>(LIVE_STATE_STORAGE_KEYS.leads).map(normalizeLead));
    void hydrateLiveState().then((state) => {
      setLeads(readLocalArray<unknown>(LIVE_STATE_STORAGE_KEYS.leads).map(normalizeLead));
      const integrations = state?.integrations as Record<string, unknown> | undefined;
      const callflow = integrations?.callflow as { callRecords?: unknown } | undefined;
      setRecords(Array.isArray(callflow?.callRecords) ? callflow.callRecords as CallFlowCallRecord[] : []);
      setIntegrations(integrations || {});
      setReviews(Array.isArray((callflow as { callReviews?: unknown } | undefined)?.callReviews) ? (callflow as { callReviews: CallReview[] }).callReviews : []);
      setTeam(Array.isArray(state?.salesPeople) ? state.salesPeople as SalesPersonLive[] : []);
    }).finally(() => setLoading(false));
  }, []);

  const cities = useMemo(() => [...new Set(leads.map((lead) => lead.city.trim()).filter(Boolean))].sort(), [leads]);
  const filteredLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    const minimum = minMarks === "" ? null : Number(minMarks);
    const maximum = maxMarks === "" ? null : Number(maxMarks);
    return leads.filter((lead) => {
      if (city && lead.city !== city) return false;
      if (category && lead.priority !== category) return false;
      if (stage && lead.stage !== stage) return false;
      if (minimum !== null && lead.score < minimum) return false;
      if (maximum !== null && lead.score > maximum) return false;
      if (salesperson && lead.assignedTo !== salesperson) return false;
      if (!query) return true;
      return [lead.name, lead.mobile, lead.email, lead.city, lead.interest, lead.source, lead.assignedTo, ...(lead.tags ?? [])]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [category, city, leadSearch, leads, maxMarks, minMarks, salesperson, stage]);
  const hasLeadFilters = Boolean(city || category || stage || minMarks || maxMarks || leadSearch.trim());
  const matchingLeadIds = useMemo(() => new Set(filteredLeads.map((lead) => lead.id)), [filteredLeads]);
  const filtered = useMemo(() => {
    const callRows = filterCallRecords(records, { from, to, salesperson, campaign });
    return hasLeadFilters ? callRows.filter((record) => matchingLeadIds.has(record.leadId)) : callRows;
  }, [records, from, to, salesperson, campaign, hasLeadFilters, matchingLeadIds]);
  const summary = useMemo(() => callSummary(filtered), [filtered]);
  const staff = useMemo(() => salespersonCallRows(filtered), [filtered]);
  const journeys = useMemo(() => leadJourneyRows(filtered), [filtered]);
  const hours = useMemo(() => hourlyConnectionRows(filtered), [filtered]);
  const salespeople = [...new Set(records.map((record) => record.salespersonName).filter(Boolean))].sort();
  const campaigns = [...new Set(records.map((record) => record.campaign).filter(Boolean))].sort();
  const wonLeadIds = new Set(leads.filter((lead) => lead.stage === "Won").map((lead) => lead.id));
  const converted = new Set(filtered.filter((record) => wonLeadIds.has(record.leadId)).map((record) => record.leadId)).size;
  const conversionRate = summary.uniqueLeads ? Math.round(converted / summary.uniqueLeads * 100) : 0;
  const alerts = staff.filter((row) => row.total < 10 || (row.total >= 5 && row.connectionRate < 20));
  const bestHour = [...hours].sort((a, b) => b.connectionRate - a.connectionRate || b.total - a.total)[0];
  const activeFilterCount = [city, category, stage, minMarks, maxMarks, leadSearch.trim(), salesperson, campaign].filter(Boolean).length;
  const todayRecords = useMemo(() => filterCallRecords(records, { from: today, to: today }), [records, today]);
  const liveTeam = useMemo(() => team.map((person) => {
    const rows = todayRecords.filter((record) => record.salespersonId === person.id || record.salespersonName === person.name);
    const performance = callSummary(rows); const callTarget = Math.max(1, Number(person.dailyCallTarget) || 50); const connectedTarget = Math.max(1, Number(person.dailyConnectedTarget) || 20);
    return { ...person, ...performance, callTarget, connectedTarget, callProgress: Math.min(100, Math.round(performance.total / callTarget * 100)), connectedProgress: Math.min(100, Math.round(performance.connected / connectedTarget * 100)), lastCallAt: [...rows].sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))[0]?.startedAt || "" };
  }).sort((a,b)=>Number(b.isActive !== false && b.acceptingLeads !== false)-Number(a.isActive !== false && a.acceptingLeads !== false) || b.total-a.total), [team, todayRecords]);
  const leaderboard = useMemo(() => leaderboardRows(todayRecords, team.filter((person) => person.isActive !== false)), [team, todayRecords]);
  const reportDeliveries = useMemo(() => { const callflow = integrations.callflow && typeof integrations.callflow === "object" ? integrations.callflow as { managerReportDeliveries?: unknown } : {}; return Array.isArray(callflow.managerReportDeliveries) ? callflow.managerReportDeliveries as ManagerReportDelivery[] : []; }, [integrations]);

  async function saveReview() {
    if (reviewSaving) return;
    if (!reviewCallId || !reviewNote.trim()) return setReviewMessage("Select a call and add a coaching note.");
    if (reviewUrl && !/^https:\/\//i.test(reviewUrl)) return setReviewMessage("Recording reference must use a secure https URL.");
    const review: CallReview = { callId: reviewCallId, recordingUrl: reviewUrl.trim() || undefined, score: Math.min(5, Math.max(1, Number(reviewScore) || 3)), note: reviewNote.trim(), reviewedAt: new Date().toISOString() };
    setReviewSaving(true); setReviewMessage(""); const next = [review, ...reviews.filter((item) => item.callId !== review.callId)]; const callflow = integrations.callflow && typeof integrations.callflow === "object" ? integrations.callflow as Record<string, unknown> : {};
    const nextIntegrations = { ...integrations, callflow: { ...callflow, callReviews: next } }; const ok = await saveLiveState({ integrations: nextIntegrations });
    setReviewSaving(false); if (!ok) return setReviewMessage("Review could not be saved. Try again."); setIntegrations(nextIntegrations); setReviews(next); setReviewMessage("Review saved."); setReviewNote(""); setReviewUrl("");
  }

  function preset(days: number) { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days + 1); setFrom(dateInput(start)); setTo(dateInput(end)); }
  function exportCsv() { const blob = new Blob([callRecordsCsv(filtered)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `callflow-report-${from}-to-${to}.csv`; link.click(); URL.revokeObjectURL(url); }
  function resetLeadFilters() { setCity(""); setCategory(""); setStage(""); setMinMarks(""); setMaxMarks(""); setLeadSearch(""); }

  return <AdminPlatformShell activeLabel="Call Analytics" description="Accurate Android call tracking, salesperson performance, conversion and lead-journey reporting." title="Call Analytics">
    {loading ? <div aria-live="polite" className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">Loading live CallFlow analytics…</div> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-end gap-3">
      <div className="flex gap-2">{[[1,"Today"],[7,"7 days"],[30,"30 days"]].map(([days,label]) => <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black hover:bg-slate-50" key={String(label)} onClick={() => preset(Number(days))}>{label}</button>)}</div>
      <Field label="From"><input className={inputClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
      <Field label="To"><input className={inputClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
      <Field label="Salesperson"><select className={inputClass} value={salesperson} onChange={(event) => setSalesperson(event.target.value)}><option value="">All salespeople</option>{salespeople.map((name) => <option key={name}>{name}</option>)}</select></Field>
      <Field label="Campaign"><select className={inputClass} value={campaign} onChange={(event) => setCampaign(event.target.value)}><option value="">All campaigns</option>{campaigns.map((name) => <option key={name}>{name}</option>)}</select></Field>
      <button className="ml-auto inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40" disabled={!filtered.length} onClick={exportCsv}><Download className="size-4" />Export CSV</button>
    </div></section>

    <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black text-slate-950">Deep lead filters</h2><p className="text-xs font-semibold text-slate-500">Every selected filter is combined, so only leads matching all conditions are shown.</p></div><button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black disabled:opacity-40" disabled={!activeFilterCount} onClick={() => { resetLeadFilters(); setSalesperson(""); setCampaign(""); }}>Clear all filters</button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Field label="City"><select className={inputClass} value={city} onChange={(event) => setCity(event.target.value)}><option value="">All cities</option>{cities.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Category"><select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value as "" | LeadPriority)}><option value="">All categories</option><option>Hot</option><option>Warm</option><option>Cold</option></select></Field>
        <Field label="Stage"><select className={inputClass} value={stage} onChange={(event) => setStage(event.target.value as "" | LeadStage)}><option value="">All stages</option>{["New Leads","Contacted","Qualified","Proposal","Won","Lost"].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Min marks"><input className={inputClass} min="0" max="100" placeholder="0" type="number" value={minMarks} onChange={(event) => setMinMarks(event.target.value)} /></Field>
        <Field label="Max marks"><input className={inputClass} min="0" max="100" placeholder="100" type="number" value={maxMarks} onChange={(event) => setMaxMarks(event.target.value)} /></Field>
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500 sm:col-span-2"><span>Search lead</span><input className={inputClass} placeholder="Name, mobile, source, tag..." value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} /></label>
      </div>
      <p className="mt-3 text-sm font-black text-emerald-800">{filteredLeads.length} of {leads.length} leads match {activeFilterCount ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}` : "the current view"}.</p>
    </section>

    <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
      <Kpi icon={UsersRound} label="Matching leads" value={filteredLeads.length}/><Kpi icon={PhoneCall} label="Total calls" value={summary.total}/><Kpi icon={Target} label="Connected" value={summary.connected}/><Kpi icon={PhoneOff} label="Not connected" value={summary.missed}/><Kpi icon={Timer} label="Talk time" value={duration(summary.totalTalkSeconds)}/><Kpi icon={Clock3} label="Avg talk" value={duration(summary.averageTalkSeconds)}/><Kpi icon={BarChart3} label="Conversion" value={`${conversionRate}%`}/>
    </section>

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <Panel title="Connection by calling hour" subtitle={bestHour ? `Best slot: ${String(bestHour.hour).padStart(2,"0")}:00 · ${bestHour.connectionRate}% connected` : "No calls in selected range"}>
        <div className="space-y-3">{hours.map((row) => <div className="grid grid-cols-[62px_1fr_76px] items-center gap-3" key={row.hour}><span className="text-sm font-black">{String(row.hour).padStart(2,"0")}:00</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.connectionRate}%` }} /></div><span className="text-right text-xs font-black">{row.connected}/{row.total} · {row.connectionRate}%</span></div>)}{!hours.length ? <Empty /> : null}</div>
      </Panel>
      <Panel title="Manager attention" subtitle="Automatic low-activity and low-connection alerts">
        <div className="space-y-2">{alerts.map((row) => <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 p-3" key={row.name}><div><p className="font-black text-slate-900">{row.name}</p><p className="text-xs font-bold text-rose-700">{row.total < 10 ? `Only ${row.total} calls` : `Connection rate ${row.connectionRate}%`}</p></div><AlertTriangle className="size-5 text-rose-600" /></div>)}{!alerts.length ? <p className="rounded-xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">No performance alerts for this range.</p> : null}</div>
      </Panel>
    </div>

    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><Header title="Manager live team status" subtitle="Today’s targets, availability and latest CallFlow activity"/><div className="overflow-x-auto"><table className={tableClass}><thead><tr>{["Salesperson","Status","Call target","Connected target","Connection","Talk time","Last call"].map((value)=><th key={value}>{value}</th>)}</tr></thead><tbody>{liveTeam.map((row)=><tr key={row.id}><td className="font-black">{row.name}</td><td><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.isActive === false ? "bg-slate-100 text-slate-600" : row.acceptingLeads === false ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{row.isActive === false ? "Inactive" : row.acceptingLeads === false ? "Off duty" : "On duty"}</span></td><td><p className="font-black">{row.total}/{row.callTarget} · {row.callProgress}%</p><div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-500" style={{width:`${row.callProgress}%`}}/></div></td><td><p className="font-black">{row.connected}/{row.connectedTarget} · {row.connectedProgress}%</p><div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{width:`${row.connectedProgress}%`}}/></div></td><td>{row.connectionRate}%</td><td>{duration(row.totalTalkSeconds)}</td><td>{displayDate(row.lastCallAt)}</td></tr>)}{!liveTeam.length?<TableEmpty columns={7}/>:null}</tbody></table></div></section>

    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><Header title="Automatic manager reports" subtitle="Daily and weekly delivery history generated by the CallFlow scheduler"/><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{reportDeliveries.slice(0,12).map((report)=><div className="rounded-xl border border-slate-100 p-4" key={report.id}><div className="flex items-center justify-between"><p className="font-black capitalize">{report.period} report</p><span className={`rounded-full px-2.5 py-1 text-xs font-black ${report.delivered?"bg-emerald-50 text-emerald-700":report.deliveryConfigured?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{report.delivered?"Delivered":report.deliveryConfigured?"Failed":"Webhook needed"}</span></div><p className="mt-2 text-sm font-bold text-slate-500">{report.date} · {displayDate(report.generatedAt)}</p><p className="mt-2 text-sm font-black">{report.summary?.total??0} calls · {report.summary?.connected??0} connected · {report.summary?.connectionRate??0}%</p></div>)}{!reportDeliveries.length?<p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">No scheduled reports generated yet. Configure CRON_SECRET and CALLFLOW_DAILY_REPORT_WEBHOOK_URL before deployment.</p>:null}</div></section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><Header title="Quality leaderboard" subtitle="Balanced score: call target 40%, connected target 30%, connection quality 20%, conversions 10%"/><div className="overflow-x-auto"><table className={tableClass}><thead><tr>{["Rank","Salesperson","Score","Calls target","Connected target","Rate","Conversions"].map((value)=><th key={value}>{value}</th>)}</tr></thead><tbody>{leaderboard.map((row)=><tr key={row.id}><td className="text-xl font-black">#{row.rank}</td><td className="font-black">{row.name}</td><td className="font-black text-indigo-700">{row.score}/100</td><td>{row.callProgress}%</td><td>{row.connectedProgress}%</td><td>{row.connectionRate}%</td><td>{row.conversions}</td></tr>)}{!leaderboard.length?<TableEmpty columns={7}/>:null}</tbody></table></div></section>

    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><Header title="Call quality review" subtitle="Attach an authorized recording reference and save manager coaching feedback. CallFlow does not secretly record calls."/><div className="grid gap-3 lg:grid-cols-4"><Field label="Call"><select className={inputClass} value={reviewCallId} onChange={(event)=>setReviewCallId(event.target.value)}><option value="">Select call</option>{records.slice().reverse().slice(0,200).map((record)=><option key={record.id} value={record.id}>{record.leadName} · {record.salespersonName} · {displayDate(record.startedAt)}</option>)}</select></Field><Field label="Secure recording URL"><input className={inputClass} inputMode="url" placeholder="https://provider/..." value={reviewUrl} onChange={(event)=>setReviewUrl(event.target.value)}/></Field><Field label="Quality score"><select className={inputClass} value={reviewScore} onChange={(event)=>setReviewScore(event.target.value)}>{[1,2,3,4,5].map((score)=><option key={score} value={score}>{score} / 5</option>)}</select></Field><Field label="Coaching note"><input className={inputClass} maxLength={500} value={reviewNote} onChange={(event)=>setReviewNote(event.target.value)}/></Field></div><div className="mt-3 flex flex-wrap items-center gap-3"><button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={reviewSaving} onClick={saveReview} type="button">{reviewSaving ? "Saving review…" : "Save review"}</button>{reviewMessage?<span aria-live="polite" className="text-sm font-bold text-slate-600">{reviewMessage}</span>:null}</div><div className="mt-4 space-y-2">{reviews.slice(0,20).map((review)=>{const call=records.find((record)=>record.id===review.callId);return <div className="rounded-xl border border-slate-100 p-3" key={review.callId}><p className="font-black">{call?.leadName || review.callId} · {review.score}/5</p><p className="break-words text-sm text-slate-600">{review.note}</p>{review.recordingUrl?<a className="inline-block py-1 text-sm font-black text-indigo-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500" href={review.recordingUrl} rel="noreferrer" target="_blank">Open authorized recording</a>:null}</div>})}{!reviews.length && !loading?<p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">No calls have been reviewed yet.</p>:null}</div></section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><Header title="Salesperson call performance" subtitle="Calls, connection rate, unique leads and talk time"/><div className="overflow-x-auto"><table className={tableClass}><thead><tr>{["Salesperson","Calls","Connected","Rate","Unique leads","Talk time","Avg talk"].map((value)=><th key={value}>{value}</th>)}</tr></thead><tbody>{staff.map((row)=><tr key={row.name}><td className="font-black">{row.name}</td><td>{row.total}</td><td>{row.connected}</td><td>{row.connectionRate}%</td><td>{row.uniqueLeads}</td><td>{duration(row.totalTalkSeconds)}</td><td>{duration(row.averageTalkSeconds)}</td></tr>)}{!staff.length?<TableEmpty columns={7}/>:null}</tbody></table></div></section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><Header title="Lead call journey" subtitle="Attempts, total conversation and latest outcome per lead"/><div className="overflow-x-auto"><table className={tableClass}><thead><tr>{["Lead","Salesperson","Attempts","Connected","Talk time","First call","Last call","Latest outcome"].map((value)=><th key={value}>{value}</th>)}</tr></thead><tbody>{journeys.slice(0,200).map((row)=><tr key={row.leadId}><td><p className="font-black">{row.leadName}</p><p className="text-xs text-slate-500">{row.phone}</p></td><td>{row.salesperson}</td><td>{row.attempts}</td><td>{row.connected}</td><td>{duration(row.totalTalkSeconds)}</td><td>{displayDate(row.firstCallAt)}</td><td>{displayDate(row.lastCallAt)}</td><td className="font-bold">{row.lastOutcome}</td></tr>)}{!journeys.length?<TableEmpty columns={8}/>:null}</tbody></table></div></section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><Header title="Filtered leads report" subtitle="City, marks, category, stage and contact details for every matching lead"/><div className="overflow-x-auto"><table className={tableClass}><thead><tr>{["Lead","City","Marks","Category","Stage","Source","Interest","Owner"].map((value)=><th key={value}>{value}</th>)}</tr></thead><tbody>{filteredLeads.slice(0,500).map((lead)=><tr key={lead.id}><td><p className="font-black">{lead.name}</p><p className="text-xs text-slate-500">{lead.mobile}{lead.email ? ` · ${lead.email}` : ""}</p></td><td>{lead.city || "—"}</td><td><span className="font-black">{lead.score}</span>/100</td><td>{lead.priority || "—"}</td><td>{lead.stage}</td><td>{lead.source || "—"}</td><td>{lead.interest || "—"}</td><td>{lead.assignedTo || "Unassigned"}</td></tr>)}{!filteredLeads.length?<tr><td className="text-center font-bold text-slate-400" colSpan={8}>No leads match all selected filters.</td></tr>:null}</tbody></table></div></section>
  </AdminPlatformShell>;
}

const inputClass = "min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500";
const tableClass = "w-full min-w-[900px] text-left text-sm [&_th]:bg-slate-50 [&_th]:px-5 [&_th]:py-3 [&_th]:text-xs [&_th]:uppercase [&_th]:text-slate-500 [&_td]:border-t [&_td]:border-slate-100 [&_td]:px-5 [&_td]:py-4";
function Field({label,children}:{label:string;children:ReactNode}){return <label className="grid gap-1 text-xs font-black uppercase text-slate-500"><span>{label}</span>{children}</label>}
function Kpi({icon:Icon,label,value}:{icon:typeof PhoneCall;label:string;value:number|string}){return <div className="rounded-xl border border-slate-200 bg-white p-4"><Icon className="size-5 text-emerald-600"/><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase text-slate-500">{label}</p></div>}
function Panel({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}){return <section className="rounded-2xl border border-slate-200 bg-white p-5"><Header title={title} subtitle={subtitle}/>{children}</section>}
function Header({title,subtitle}:{title:string;subtitle:string}){return <div className="p-5"><h3 className="text-xl font-black">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p></div>}
function Empty(){return <p className="py-8 text-center text-sm font-bold text-slate-400">No call data for the selected filters.</p>}
function TableEmpty({columns}:{columns:number}){return <tr><td className="text-center font-bold text-slate-400" colSpan={columns}>No call data for the selected filters.</td></tr>}
