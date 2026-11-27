"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { callFlowDispositions } from "@/lib/callflow-connector";
import type { CrmNoteInput } from "@/lib/crm-note";
import { businessNoteFields, type NoteField } from "@/lib/crm-note-fields";
import type { Lead } from "@/lib/types";

export function CrmNoteModal({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (input: CrmNoteInput) => Promise<void> }) {
  const [input, setInput] = useState<CrmNoteInput>({ note: "", disposition: "", followUpAt: "", followUpType: "Call", fields: lead.noteFields ?? [] });
  const saved = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id: string; name: string; admin: boolean } | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; shared: boolean; fields: NoteField[] }[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [share, setShare] = useState(false);
  const [notice, setNotice] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [section, setSection] = useState("All details");
  useEffect(() => {
    let active = true;
    void fetch("/api/crm/note-templates", { cache: "no-store" }).then(r=>r.json()).then(data=>{
      if (!active) return;
      if (!data.user) { setNotice(data.error || "Question sets could not load. You can still add questions."); return; }
      setUser(data.user); setTemplates(data.templates || []); if (data.error) setNotice(data.error);
      const key = `cfl-note-draft:${data.user.id}:${lead.id}`;
      setDraftKey(key);
      try { const saved = localStorage.getItem(key); if (saved) { const draft = JSON.parse(saved); if (draft && typeof draft.note === "string" && Array.isArray(draft.fields)) { setInput(draft); setNotice("Your unfinished note is back. You can continue below."); } } } catch { setNotice("Draft saving is not available on this device."); }
      setDraftReady(true);
    }).catch(()=>{ if (active) setNotice("Question sets and draft saving are unavailable. Please try again."); });
    return () => { active = false; };
  }, [lead.id]);
  useEffect(() => {
    if (!draftReady || !draftKey || busy || saved.current) return;
    try { localStorage.setItem(draftKey, JSON.stringify(input)); } catch { setNotice("Draft could not be saved. Please use Save note before closing."); }
  }, [input, draftKey, draftReady, busy]);
  function addQuestions(fields: NoteField[]) {
    setInput(previous=>({ ...previous, fields: [...(previous.fields || []), ...fields.filter(f=>!previous.fields?.some(old=>old.label.toLowerCase()===f.label.toLowerCase())).map(f=>({...f,value:""}))].slice(0,50) }));
    setSection("All details");
  }
  async function saveTemplate() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/crm/note-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: templateName, shared: share, fields: input.fields || [] }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save question set.");
      setTemplates(previous=>[...previous,data.template]); setTemplateName(""); setNotice("Question set saved. You can use it for your next customer.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save question set."); } finally { setBusy(false); }
  }
  function changeBox(index: number, patch: Partial<NoteField>) { setInput(previous=>({...previous, fields: previous.fields?.map((box,i)=>i===index ? {...box,...patch} : box)})); }
  const outcome = callFlowDispositions.find((item) => item[1] === input.disposition);
  const field = "w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900";
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="crm-note-title">
    <form onInvalidCapture={() => setSection("All details")} className="max-h-[90dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setError("");
      try { await onSave({ ...input, actor: user?.name }); saved.current = true; if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} } } catch (err) { setError(err instanceof Error ? err.message : "Could not save note."); } finally { setBusy(false); }
    }}>
      <header className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black" id="crm-note-title">Add note</h3><p className="text-sm text-slate-600">{lead.name} · {lead.mobile}</p></div><button aria-label="Close note" disabled={busy} onClick={onClose} type="button"><X className="size-5" /></button></header>
      {notice ? <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800" role="status">{notice}</p> : null}
      <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-70">
      <label className="block text-sm font-bold">1. What happened on the call?<select className={`${field} mt-2`} value={input.disposition} onChange={(event) => setInput({ ...input, disposition: event.target.value, followUpType: event.target.value === "GENERATE_MEETING" ? "Meeting" : input.followUpType })}><option value="">Note only</option>{callFlowDispositions.map(([, code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      <label className="block text-sm font-bold">2. What did the customer say?{!outcome || outcome[3] ? " *" : ""}<textarea autoFocus className={`${field} mt-2 min-h-28`} required={(!outcome || outcome[3]) && !input.fields?.some((field) => field.label.trim() && field.value.trim())} value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} placeholder="Write a short note here. You can also fill in the boxes below." /></label>
      <section className="space-y-3 rounded-xl border border-slate-200 p-3" aria-label="Custom note boxes">
        <h4 className="text-base font-bold">3. Customer details</h4>
        <p className="text-sm text-slate-600">Choose a question set, or add your own questions.</p>
        <label className="block text-sm font-bold">Use saved questions<select className={`${field} mt-1`} value="" onChange={event=>{ const selected=templates.find(t=>t.id===event.target.value); addQuestions(selected?.fields || businessNoteFields); }}><option value="">Choose a question set</option><option value="business">Business details (ready to use)</option>{templates.map(template=><option key={template.id} value={template.id}>{template.name}{template.shared ? " (Team)" : " (Mine)"}</option>)}</select></label>
        <div className="flex flex-wrap gap-2" aria-label="Detail sections">{["All details", ...Array.from(new Set(input.fields?.map(box=>box.section || "Business details")))].map(name=><button className={`rounded-lg border px-3 py-2 text-sm font-bold ${section===name ? "bg-emerald-700 text-white" : "bg-white"}`} aria-pressed={section===name} key={name} onClick={()=>setSection(name)} type="button">{name}</button>)}</div>
        {input.fields?.map((box, index) => <div hidden={section!=="All details" && section!==(box.section || "Business details")} className="space-y-2 rounded-lg bg-slate-50 p-3" key={index}>
          <label className="block text-sm font-bold">{box.label || "New question"}{box.required ? " (Required)" : ""}
          {box.type === "choice" || box.type === "yesno" ? <select className={`${field} mt-1`} required={box.required} value={box.value} onChange={event=>changeBox(index,{value:event.target.value})}><option value="">Choose an answer</option>{(box.type === "yesno" ? ["Yes","No"] : box.options || []).map(value=><option key={value}>{value}</option>)}</select> : box.type === "address" ? <textarea className={`${field} mt-1`} required={box.required} maxLength={4000} value={box.value} onChange={event=>changeBox(index,{value:event.target.value})} placeholder="Enter the full address" /> : <input className={`${field} mt-1`} required={box.required} type={box.type === "number" ? "number" : box.type === "date" ? "date" : "text"} min={box.type === "number" ? 0 : undefined} step={box.type === "number" ? "any" : undefined} maxLength={4000} value={box.value} onChange={event=>changeBox(index,{value:event.target.value})} placeholder="Enter answer" />}</label>
          <details open={!box.label}><summary className="cursor-pointer py-2 text-sm font-semibold text-emerald-800">Change this question</summary><div className="space-y-2">
            <label className="block text-sm">Question name<input className={field} maxLength={100} required value={box.label} onChange={event=>changeBox(index,{label:event.target.value})} placeholder="e.g. Team members" /></label>
            <label className="block text-sm">Answer type<select className={field} value={box.type || "text"} onChange={event=>changeBox(index,{type:event.target.value as NoteField["type"],value:""})}>{[["text","Short answer"],["number","Number"],["choice","Choose from a list"],["yesno","Yes or No"],["date","Date"],["address","Full address"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            {box.type === "choice" ? <label className="block text-sm">Choices (separate with a comma)<input className={field} value={box.options?.join(",") || ""} onChange={event=>changeBox(index,{options:event.target.value.split(",")})} placeholder="Small, Medium, Large" /></label> : null}
            <label className="block text-sm">Section name<input className={field} maxLength={80} value={box.section || "Business details"} onChange={event=>changeBox(index,{section:event.target.value})} placeholder="Business details or Customer needs" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={box.required || false} onChange={event=>changeBox(index,{required:event.target.checked})} />Answer must be filled</label>
            <button className="py-2 text-sm font-bold text-rose-700" type="button" onClick={()=>{setInput(previous=>({...previous,fields:previous.fields?.filter((_,i)=>i!==index)}));setSection("All details");}}>Remove question</button>
          </div></details>
        </div>)}
        <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50" type="button" disabled={busy || (input.fields?.length ?? 0) >= 50} onClick={() => setInput({ ...input, fields: [...(input.fields ?? []), { label: "", value: "", type: "text", section: "Business details" }] })}>+ Add custom question</button>
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-bold">Save these questions for other customers</summary><p className="mt-2 text-xs text-slate-600">Only the questions are saved. Customer answers are not copied.</p><label className="mt-2 block text-sm">Question set name<input className={field} value={templateName} maxLength={100} onChange={event=>setTemplateName(event.target.value)} placeholder="e.g. My business questions" /></label>{user?.admin ? <label className="my-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={share} onChange={event=>setShare(event.target.checked)} />Share with all salespeople</label> : null}<button className="mt-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={!user || !templateName.trim() || !input.fields?.length} type="button" onClick={()=>void saveTemplate()}>Save question set</button></details>
      </section>
      <fieldset className="space-y-2"><legend className="text-sm font-bold">4. What should you do next?{outcome?.[4] ? " *" : " (optional)"}</legend><select aria-label="Next action type" className={field} disabled={input.disposition === "GENERATE_MEETING"} value={input.followUpType} onChange={(event) => setInput({ ...input, followUpType: event.target.value as CrmNoteInput["followUpType"] })}>{["Call", "Meeting", "Send Information", "Partner Call", "Payment Follow-up"].map((type) => <option key={type}>{type}</option>)}</select><input aria-label="Next action date and time" className={field} required={Boolean(outcome?.[4])} type="datetime-local" value={input.followUpAt} onChange={(event) => setInput({ ...input, followUpAt: event.target.value })} /></fieldset>
      {input.disposition === "WRONG_NUMBER" ? <p className="text-sm text-rose-700">Wrong number marks this lead Lost and enables Do Not Call.</p> : null}
      </fieldset>
      {draftReady ? <p className="text-xs text-slate-600">Unfinished notes are saved on this device. Click Save note to update the customer record.</p> : null}
      {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
      <button className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Saving…" : "Save note"}</button>
    </form>
  </div>;
}
