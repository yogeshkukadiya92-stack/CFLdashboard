"use client";

import { useState } from 'react';
import { manualWhatsAppUrl } from '@/lib/manual-whatsapp';

export function ManualWhatsAppSettings({ template, startDate, onTemplate, onStartDate }: {
  template: string; startDate: string;
  onTemplate: (value: string) => void; onStartDate: (value: string) => void;
}) {
  const fieldClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900';
  return <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
    <p className="text-sm font-bold">Automatic API + Manual WhatsApp</p>
    <p className="text-xs text-slate-600">Automatic API messages follow the setting below. Manual Send WhatsApp is always available alongside them, even after an API message is sent.</p>
    <label className="block text-sm font-bold">Workshop starting date (API + manual message)<input className={fieldClass} value={startDate} placeholder="28th November" onChange={e => onStartDate(e.target.value)} /></label>
    <label className="block text-sm font-bold">Manual confirmation message<textarea rows={12} className={fieldClass} value={template} onChange={e => onTemplate(e.target.value)} /></label>
    <p className="text-xs text-slate-600">Personalize with {'{{name}}, {{workshop_name}}, {{start_date}}, {{registration_no}}, {{whatsapp_group_link}}'}. The manual group link comes from WhatsApp Group Invite Link above. API message wording and its fixed group link come from the approved provider template. Use *text* for WhatsApp bold.</p>
  </div>;
}

export type ManualWhatsAppDraft = { id: string; name: string; mobile: string; message: string };
export function ManualWhatsAppComposer({ drafts: initialDrafts, onClose }: { drafts: ManualWhatsAppDraft[]; onClose: () => void }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState('');
  const draft = drafts[index];
  const url = manualWhatsAppUrl(draft.mobile, draft.message);
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="manual-whatsapp-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3"><h2 id="manual-whatsapp-title" className="text-lg font-black">Send WhatsApp manually</h2><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2">Close</button></div>
      <p className="mt-3 font-bold">{draft.name} · {draft.mobile}</p>
      <p className="mt-1 text-xs text-slate-500">Participant {index + 1} of {drafts.length}. Edits here apply only to this message.</p>
      <label className="mt-4 block text-sm font-bold">Message preview / edit<textarea autoFocus rows={14} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" value={draft.message} onChange={e => setDrafts(items => items.map((item, i) => i === index ? { ...item, message: e.target.value } : item))} /></label>
      {!url && <p role="alert" className="text-sm text-red-600">Enter a valid participant mobile number before opening WhatsApp.</p>}
      <p className="text-xs text-slate-500">Press Send in WhatsApp to deliver the message. Opening a chat does not mark it as sent.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border px-3 py-2" onClick={async () => { try { await navigator.clipboard.writeText(draft.message); setNotice('Message copied.'); } catch { setNotice('Could not copy. Select the message and copy it manually.'); } }}>Copy message</button>
        {url && draft.message.trim() && <a className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" href={url} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>}
        <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={index === 0} onClick={() => { setIndex(index - 1); setNotice(''); }}>Previous</button>
        <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={index === drafts.length - 1} onClick={() => { setIndex(index + 1); setNotice(''); }}>Next</button>
      </div><p role="status" className="mt-2 text-sm">{notice}</p>
    </section>
  </div>;
}
