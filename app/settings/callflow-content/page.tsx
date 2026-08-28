"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { SettingsMenu } from "@/components/settings-menu";
import { Megaphone, Plus, RefreshCw, Save, ScrollText, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Item = { active: boolean; body: string; category: string; id: string; title: string; updatedAt: string };
type Config = { announcements: Item[]; scripts: Item[]; updatedAt: string };

const emptyConfig: Config = { announcements: [], scripts: [], updatedAt: "" };
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
        announcements: Array.isArray(payload.announcements) ? payload.announcements : [],
        scripts: Array.isArray(payload.scripts) ? payload.scripts : [],
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

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/callflow-content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json().catch(() => ({})) as Partial<Config> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Content could not be published.");
      setData({
        announcements: Array.isArray(payload.announcements) ? payload.announcements : [],
        scripts: Array.isArray(payload.scripts) ? payload.scripts : [],
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : ""
      });
      setMessage("Published. It will appear in the Android app after sync.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Content could not be published.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPlatformShell activeLabel="CallFlow Content" description="Publish team updates and reusable call guidance to every salesperson." title="Announcements & Call Scripts">
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
    </AdminPlatformShell>
  );
}
