"use client";

import { defaultIntroductionStatuses, type IntroductionStatus } from "@/lib/introduction-statuses";
import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { SettingsMenu } from "@/components/settings-menu";
import { Megaphone, Plus, RefreshCw, Save, ScrollText, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Item = { active: boolean; body: string; category: string; id: string; title: string; updatedAt: string };
type Config = { introductionStatuses: IntroductionStatus[]; announcements: Item[]; scripts: Item[]; noteTemplates: string[]; updatedAt: string };

const defaultTemplates = ["No answer", "Call back tomorrow", "Interested", "Price shared", "Meeting booked", "Not eligible", "Wrong number"];
const emptyConfig: Config = { introductionStatuses: defaultIntroductionStatuses, announcements: [], scripts: [], noteTemplates: defaultTemplates, updatedAt: "" };
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-emerald-500";

function blank(category: string): Item {
  return { active: true, body: "", category, id: `content-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title: "", updatedAt: new Date().toISOString() };
}

export default function CallFlowContentPage() {
  const [data, setData] = useState<Config>(emptyConfig);
  const [tab, setTab] = useState<"announcements" | "scripts">("announcements");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/callflow-content", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as Partial<Config> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "CallFlow content could not be loaded.");
      setData({
        introductionStatuses: Array.isArray(payload.introductionStatuses) ? payload.introductionStatuses : defaultIntroductionStatuses,
        announcements: Array.isArray(payload.announcements) ? payload.announcements : [],
        scripts: Array.isArray(payload.scripts) ? payload.scripts : [],
        noteTemplates: Array.isArray(payload.noteTemplates) ? payload.noteTemplates.map(String) : defaultTemplates,
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : ""
      });
    } catch (loadError) {
      setData(emptyConfig);
      setError(loadError instanceof Error ? loadError.message : "CallFlow content could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data[tab] ?? [];

  function change(id: string, patch: Partial<Item>) {
    setData((current) => ({ ...current, [tab]: current[tab].map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  async function save(statusOnly = false) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/callflow-content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(statusOnly ? { introductionStatuses: data.introductionStatuses } : data) });
      const payload = await response.json().catch(() => ({})) as Partial<Config> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Content could not be published.");
      setData(current => statusOnly ? { ...current, introductionStatuses: Array.isArray(payload.introductionStatuses) ? payload.introductionStatuses : current.introductionStatuses, updatedAt: payload.updatedAt || current.updatedAt } : {
        introductionStatuses: Array.isArray(payload.introductionStatuses) ? payload.introductionStatuses : defaultIntroductionStatuses,
        announcements: Array.isArray(payload.announcements) ? payload.announcements : [],
        scripts: Array.isArray(payload.scripts) ? payload.scripts : [],
        noteTemplates: Array.isArray(payload.noteTemplates) ? payload.noteTemplates.map(String) : defaultTemplates,
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : ""
      });
      setMessage(statusOnly ? "Statuses saved. They will appear in workshop follow-ups and the mobile app after refresh." : "Published. It will appear in the Android app after sync.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Content could not be published.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPlatformShell activeLabel="CallFlow Content" description="Manage session status names, team updates and call guidance." title="CallFlow Content & Statuses">
      <SettingsMenu />
      {error ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800" role="alert"><span>{error}</span><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-xs font-black" onClick={() => void load()} type="button"><RefreshCw className="size-4" />Retry</button></div> : null}
      <div className="mt-5 flex gap-2">
        <button className={`rounded-xl px-4 py-3 text-sm font-black ${tab === "announcements" ? "bg-slate-950 text-white" : "bg-white text-slate-600"}`} onClick={() => setTab("announcements")} type="button"><Megaphone className="mr-2 inline size-4" />Announcements</button>
        <button className={`rounded-xl px-4 py-3 text-sm font-black ${tab === "scripts" ? "bg-slate-950 text-white" : "bg-white text-slate-600"}`} onClick={() => setTab("scripts")} type="button"><ScrollText className="mr-2 inline size-4" />Call Scripts</button>
      </div>
      {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700" role="status">{message}</p> : null}
      <div className="mt-4 space-y-3">
        {rows.map((item) => (
          <section className="rounded-2xl border border-slate-200 bg-white p-4" key={item.id}>
            <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <input className={input} onChange={(event) => change(item.id, { title: event.target.value })} placeholder="Title" value={item.title} />
              <input className={input} onChange={(event) => change(item.id, { category: event.target.value })} placeholder="Category" value={item.category} />
              <button aria-label="Delete" className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-700" onClick={() => setData((current) => ({ ...current, [tab]: current[tab].filter((row) => row.id !== item.id) }))} type="button"><Trash2 className="size-4" /></button>
            </div>
            <textarea className={`${input} mt-3 min-h-28`} onChange={(event) => change(item.id, { body: event.target.value })} placeholder={tab === "scripts" ? "Opening, questions, objection handling and close…" : "Update for the sales team…"} value={item.body} />
            <label className="mt-3 inline-flex items-center gap-2 text-sm font-bold"><input checked={item.active} onChange={(event) => change(item.id, { active: event.target.checked })} type="checkbox" />Visible in app</label>
          </section>
        ))}
        {!loading && !error && !rows.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center font-bold text-slate-500">No content yet.</div> : null}
        {loading ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center font-bold text-slate-500">Loading content…</div> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black disabled:opacity-50" disabled={loading || Boolean(error)} onClick={() => setData((current) => ({ ...current, [tab]: [...current[tab], blank(tab === "scripts" ? "Opening" : "General")] }))} type="button"><Plus className="size-4" />Add {tab === "scripts" ? "script" : "announcement"}</button>
        <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={saving || loading || Boolean(error)} onClick={() => void save()} type="button"><Save className="size-4" />{saving ? "Publishing…" : "Publish to app"}</button>
      </div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-black text-slate-950">Introduction session statuses</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">Choose any status name, including Gujarati. Names appear in workshop follow-ups and the mobile app. Make unused statuses inactive to preserve past records.</p>
        <div className="mt-4 space-y-3">
          {data.introductionStatuses.map((status, index) => <div className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_auto_auto]" key={status.id}>
            <input aria-label={`Status name ${index + 1}`} className={input} maxLength={80} disabled={loading || saving} value={status.label} onChange={event => setData(current => ({ ...current, introductionStatuses: current.introductionStatuses.map(row => row.id === status.id ? { ...row, label: event.target.value } : row) }))} />
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={status.isConfirmed} disabled={loading || saving || defaultIntroductionStatuses.some(row => row.id === status.id)} onChange={event => setData(current => ({ ...current, introductionStatuses: current.introductionStatuses.map(row => row.id === status.id ? { ...row, isConfirmed: event.target.checked } : row) }))} />Counts as confirmed</label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={status.active} disabled={loading || saving} onChange={event => setData(current => ({ ...current, introductionStatuses: current.introductionStatuses.map(row => row.id === status.id ? { ...row, active: event.target.checked } : row) }))} />Active</label>
          </div>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black disabled:opacity-50" disabled={loading || saving || Boolean(error) || data.introductionStatuses.length >= 100} onClick={() => setData(current => ({ ...current, introductionStatuses: [...current.introductionStatuses, { id: `custom_${crypto.randomUUID()}`, label: "", isConfirmed: false, active: true }] }))} type="button">Add status</button>
          <button className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={loading || saving} onClick={() => void save(true)} type="button">{saving ? "Saving…" : "Save statuses"}</button>
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-black text-slate-950">Quick note templates</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">Salespeople can add these reusable notes after a call. Keep each option short and specific.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.noteTemplates.map((template, index) => <div className="flex gap-2" key={`${index}-${template}`}><input className={input} maxLength={120} onChange={(event) => setData((current) => ({ ...current, noteTemplates: current.noteTemplates.map((value, row) => row === index ? event.target.value : value) }))} placeholder="Example: Send proposal today" value={template} /><button aria-label={`Delete template ${template}`} className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700" onClick={() => setData((current) => ({ ...current, noteTemplates: current.noteTemplates.filter((_, row) => row !== index) }))} type="button"><Trash2 className="size-4" /></button></div>)}
        </div>
        <button className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black disabled:opacity-50" disabled={data.noteTemplates.length >= 20} onClick={() => setData((current) => ({ ...current, noteTemplates: [...current.noteTemplates, ""] }))} type="button"><Plus className="size-4" />Add quick template</button>
      </section>
    </AdminPlatformShell>
  );
}
