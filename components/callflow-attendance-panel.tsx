"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecordRow = { leadId: string; leadName: string; mobile: string; sessionId: string; sessionTitle: string; workshopTitle: string; sessionDate: string; status: string; assignedSalesPersonId: string; assignedTo: string; registered: boolean };
type Data = { records: RecordRow[]; sessions: { id: string; title: string; workshopTitle: string; sessionDate: string }[]; leads: { id: string; name: string; mobile: string }[]; salesPeople: { id: string; name: string }[] };
const endpoint = "/api/callflow/workshop-attendance";
const labels: Record<string, string> = { not_marked: "Not marked", checked_in: "Present", late: "Late", joined_zoom: "Joined Zoom", completed: "Completed", absent: "Absent" };
const selectClass = "min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
export function CallFlowAttendancePanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [leadId, setLeadId] = useState("");
  const revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store" }); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Attendance could not be loaded.");
      if (current === revision.current) { setData(body); setError(""); }
    } catch (error) { if (current === revision.current) setError(error instanceof Error ? error.message : "Attendance unavailable."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (saving) return;
    const refresh = () => { void load(); };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [load, saving]);
  async function save(body: Record<string, string>) {
    if (saving) return;
    ++revision.current; setSaving(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const next = await response.json(); if (!response.ok) throw new Error(next.error || "Changes were not saved.");
      setData(next);
    } catch (error) { setError(error instanceof Error ? error.message : "Changes were not saved."); }
    finally { setSaving(false); }
  }
  const rows = (data?.records || []).filter(row => !sessionId || row.sessionId === sessionId);
  return <section className="space-y-4 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm" aria-label="Attendance–CallFlow connection">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">Attendance–CallFlow connection</h2><p className="mt-1 text-sm text-slate-500">Register assigned leads, mark attendance, and change the responsible salesperson. Saved changes appear in CallFlow.</p></div><button className={selectClass} type="button" disabled={saving} onClick={() => void load()}>Refresh</button></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="flex flex-wrap gap-2"><select aria-label="Workshop session" className={selectClass} value={sessionId} onChange={event => setSessionId(event.target.value)}><option value="">All workshop sessions</option>{data?.sessions.map(session => <option key={session.id} value={session.id}>{session.workshopTitle} · {session.title} · {session.sessionDate}</option>)}</select><select aria-label="Participant to register" className={selectClass} value={leadId} onChange={event => setLeadId(event.target.value)}><option value="">Choose a lead to register</option>{data?.leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name} · {lead.mobile}</option>)}</select><button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" type="button" disabled={!leadId || !sessionId || saving} onClick={() => void save({ action: "register", leadId, sessionId })}>Register for workshop</button></div>
    <p className="text-xs text-slate-500">Registration does not mark the participant present. Existing introduction attendance is matched automatically by mobile and session.</p>
    {data && rows.length === 0 && <p className="py-3 text-sm text-slate-500">No registered or attended leads for this selection.</p>}
    <div className="max-h-[32rem] space-y-2 overflow-auto">{rows.map(row => <div key={`${row.leadId}:${row.sessionId}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3"><div className="min-w-52 flex-1"><p className="font-bold text-slate-900">{row.leadName} <span className="text-xs font-normal text-slate-500">{row.mobile}</span></p><p className="text-xs text-slate-500">{row.workshopTitle} · {row.sessionTitle} · {row.sessionDate}</p><p className="mt-1 text-xs text-emerald-700">{row.registered ? "Registered" : "Attendance matched"} · {row.assignedTo || "Unassigned"}</p></div><label className="grid gap-1 text-xs text-slate-500">Attendance<select className={selectClass} aria-label={`Attendance for ${row.leadName} ${row.sessionTitle}`} disabled={saving} value={row.status} onChange={event => void save({ action: "attendance", leadId: row.leadId, sessionId: row.sessionId, status: event.target.value })}>{row.status === "not_marked" && <option value="not_marked" disabled>Not marked</option>}{Object.entries(labels).filter(([id]) => id !== "not_marked").map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="grid gap-1 text-xs text-slate-500">Responsible salesperson<select className={selectClass} aria-label={`Salesperson for ${row.leadName}`} disabled={saving} value={row.assignedSalesPersonId} onChange={event => void save({ action: "assign", leadId: row.leadId, sessionId: row.sessionId, salesPersonId: event.target.value })}><option value="" disabled>{row.assignedTo || "Choose salesperson"}</option>{data?.salesPeople.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>)}</div>
    {saving && <p role="status" className="text-sm text-emerald-700">Saving to CFL and CallFlow…</p>}
  </section>;
}
