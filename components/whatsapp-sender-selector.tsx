"use client";
import { useEffect, useState } from "react";
type Account = { id: string; label: string; number: string };
export function WhatsAppSenderSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ label: "", number: "", apiUrl: "", authToken: "", otpTemplate: "", language: "en" });
  useEffect(() => { fetch("/api/admin/whatsapp-accounts").then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setAccounts(data.accounts); }).catch(() => setError("Could not load WhatsApp numbers. Please reload.")); }, []);
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/whatsapp-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setAccounts(previous => [...previous, data.account]); onChange(data.account.id); setAdding(false);
      setDraft({ label: "", number: "", apiUrl: "", authToken: "", otpTemplate: "", language: "en" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save number."); } finally { setBusy(false); }
  }
  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
  return <div className="my-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <label className="block text-sm font-bold">WhatsApp Sender Number<select className={`${inputClass} mt-2`} value={value} onChange={e => onChange(e.target.value)}><option value="">Default WhatsApp API (current number)</option>{value && !accounts.some(a => a.id === value) && <option value={value}>Selected number (unavailable)</option>}{accounts.map(a => <option key={a.id} value={a.id}>{a.label} (+{a.number})</option>)}</select></label>
    <p className="mt-2 text-xs text-slate-600">OTP, confirmation and waiting messages use this number. Use the API endpoint and token issued for this sender. Templates must be approved for this account.</p>
    <button type="button" className="mt-2 text-sm font-bold text-emerald-700" onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "+ Add WhatsApp Number / API"}</button>
    {adding && <div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ key: "label", label: "Account name" }, { key: "number", label: "Sender number with country code" }, { key: "apiUrl", label: "Provider API URL (HTTPS)" }, { key: "authToken", label: "API token" }, { key: "otpTemplate", label: "OTP template name" }, { key: "language", label: "Template language" }] as const).map(field => <label key={field.key} className="text-xs font-bold">{field.label}<input className={`${inputClass} mt-1`} type={field.key === "authToken" ? "password" : "text"} autoComplete="off" value={draft[field.key]} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })} /></label>)}<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-emerald-700 p-2 text-sm font-bold text-white">{busy ? "Saving…" : "Save WhatsApp Number"}</button></div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
