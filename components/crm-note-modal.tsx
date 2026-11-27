"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { callFlowDispositions } from "@/lib/callflow-connector";
import type { CrmNoteInput } from "@/lib/crm-note";
import type { Lead } from "@/lib/types";

export function CrmNoteModal({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (input: CrmNoteInput) => Promise<void> }) {
  const [input, setInput] = useState<CrmNoteInput>({ note: "", disposition: "", followUpAt: "", followUpType: "Call" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const outcome = callFlowDispositions.find((item) => item[1] === input.disposition);
  const field = "w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900";
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="crm-note-title">
    <form className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setError("");
      try { await onSave(input); } catch (err) { setError(err instanceof Error ? err.message : "Could not save note."); } finally { setBusy(false); }
    }}>
      <header className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black" id="crm-note-title">Add note</h3><p className="text-sm text-slate-600">{lead.name} · {lead.mobile}</p></div><button aria-label="Close note" disabled={busy} onClick={onClose} type="button"><X className="size-5" /></button></header>
      <label className="block text-sm font-bold">Outcome<select className={`${field} mt-2`} value={input.disposition} onChange={(event) => setInput({ ...input, disposition: event.target.value, followUpType: event.target.value === "GENERATE_MEETING" ? "Meeting" : input.followUpType })}><option value="">Note only</option>{callFlowDispositions.map(([, code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      <label className="block text-sm font-bold">Note{!outcome || outcome[3] ? " *" : ""}<textarea autoFocus className={`${field} mt-2 min-h-28`} required={!outcome || outcome[3]} value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} placeholder="Conversation, interest, objection or next steps…" /></label>
      <fieldset className="space-y-2"><legend className="text-sm font-bold">Next action{outcome?.[4] ? " *" : " (optional)"}</legend><select aria-label="Next action type" className={field} disabled={input.disposition === "GENERATE_MEETING"} value={input.followUpType} onChange={(event) => setInput({ ...input, followUpType: event.target.value as CrmNoteInput["followUpType"] })}>{["Call", "Meeting", "Send Information", "Partner Call", "Payment Follow-up"].map((type) => <option key={type}>{type}</option>)}</select><input aria-label="Next action date and time" className={field} required={Boolean(outcome?.[4])} type="datetime-local" value={input.followUpAt} onChange={(event) => setInput({ ...input, followUpAt: event.target.value })} /></fieldset>
      {input.disposition === "WRONG_NUMBER" ? <p className="text-sm text-rose-700">Wrong number marks this lead Lost and enables Do Not Call.</p> : null}
      {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
      <button className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Saving…" : "Save note"}</button>
    </form>
  </div>;
}
