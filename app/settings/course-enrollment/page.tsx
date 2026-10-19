'use client';
import { useEffect, useState } from 'react';
import { AdminPlatformShell } from '@/components/admin-platform-shell';
import { SettingsMenu } from '@/components/settings-menu';

type Mapping = { paymentLinkId: string; courseId: string };
type Settings = { registrationLinks: {id: string; title: string; url: string}[]; connected: boolean; enabled: boolean; courses: { id: string; title: string }[]; mappings: Mapping[]; webhookUrl: string; razorpayReady: boolean; webhookSecretReady: boolean; webhookConfigured?: boolean };
const initial: Settings = { registrationLinks: [], connected: false, enabled: false, courses: [], mappings: [], webhookUrl: 'https://dashboard.coachforlife.in/api/webhooks/razorpay', razorpayReady: false, webhookSecretReady: false };
export default function CourseEnrollmentPage() {
  const [settings, setSettings] = useState(initial);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function load() {
    const response = await fetch('/api/integrations/mfw/course-enrollment', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load enrollment settings.');
    setSettings({ ...initial, ...data });
  }
  useEffect(() => { load().catch(reason => setError(reason.message)).finally(() => setBusy(false)); }, []);
  async function save(connect = false) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/integrations/mfw/course-enrollment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(connect ? { action: 'connect', apiKey } : { enabled: settings.enabled, mappings: settings.mappings }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save.');
      setApiKey(''); await load(); setMessage(connect ? 'MFW connection verified.' : 'Course mappings and webhook verification saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }
  function update(index: number, patch: Partial<Mapping>) {
    setSettings(current => ({ ...current, mappings: current.mappings.map((row, i) => i === index ? { ...row, ...patch } : row) }));
  }
  return <AdminPlatformShell activeLabel="Settings" title="Course enrollment" description="Connect successful course payments to access in the Healthy Forever app.">
    <SettingsMenu />
    <div className="mx-auto mt-6 max-w-5xl space-y-6">
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">1. Connect Healthy Forever</h2>
        <p className="mt-2 text-sm text-slate-600">Connection: {settings.connected ? 'Verified' : 'Needs setup'}. The connection key stays on the server and is never included in public registration pages.</p>
        {!settings.connected ? <div className="mt-4 flex flex-wrap gap-3"><label className="flex-1 text-sm font-semibold">MFW course enrollment key<input autoComplete="off" type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label><button type="button" disabled={busy || !apiKey} onClick={() => save(true)} className="self-end rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">Connect MFW</button></div> : null}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">2. Match payment links to courses</h2>
        <p className="mt-2 text-sm text-slate-600">Choose an existing CFL registration link and its app course. New payments from that link will unlock the selected course automatically. You can also map a separate Razorpay Payment Link.</p>
        <div className="mt-5 space-y-3">{settings.mappings.map((row, index) => <div key={index} className="grid items-end gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-semibold">App course<select aria-label={`App course ${index + 1}`} value={row.courseId} disabled={busy} onChange={event => update(index, { courseId: event.target.value })} className="mt-1 w-full rounded-lg border bg-white p-3"><option value="">Select course</option>{settings.courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
          <div><label className="text-sm font-semibold">CFL registration link<select aria-label={`Payment source ${index + 1}`} value={row.paymentLinkId.startsWith('registration:') ? row.paymentLinkId : ''} disabled={busy} onChange={event => update(index, { paymentLinkId: event.target.value })} className="mt-1 w-full rounded-lg border bg-white p-3"><option value="">Separate Razorpay Payment Link</option>{settings.registrationLinks.map(link => <option key={link.id} value={link.id}>{link.title}</option>)}</select></label>{!row.paymentLinkId.startsWith('registration:') ? <label className="mt-2 block text-sm font-semibold">Razorpay Payment Link ID<input aria-label={`Payment Link ID ${index + 1}`} value={row.paymentLinkId} placeholder="plink_…" disabled={busy} onChange={event => update(index, { paymentLinkId: event.target.value.trim() })} className="mt-1 w-full rounded-lg border p-3" /></label> : <a className="mt-2 block text-sm text-emerald-700 underline" href={settings.registrationLinks.find(link => link.id === row.paymentLinkId)?.url} target="_blank" rel="noreferrer">Open registration page</a>}</div>
          <button type="button" disabled={busy} onClick={() => setSettings(current => ({ ...current, mappings: current.mappings.filter((_, i) => i !== index) }))} className="rounded-lg border p-3 text-red-700">Remove</button>
        </div>)}</div>
        <button type="button" disabled={busy || !settings.connected} onClick={() => setSettings(current => ({ ...current, mappings: [...current.mappings, { courseId: '', paymentLinkId: '' }] }))} className="mt-4 rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Add course mapping</button>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">3. Payment webhook</h2>
        <p className="mt-2 text-sm text-slate-600">In Razorpay → Settings → Webhooks, use this URL and subscribe to order.paid and payment_link.paid. Use the CFL server’s RAZORPAY_WEBHOOK_SECRET. Saving here securely synchronizes the same secret to MFW.</p>
        <code className="mt-3 block break-all rounded-lg bg-slate-50 p-3 text-sm">{settings.webhookUrl}</code>
        <p className="mt-3 text-sm">Razorpay keys: {settings.razorpayReady ? 'Configured' : 'Missing'} · CFL webhook secret: {settings.webhookSecretReady ? 'Configured' : 'Missing'} · MFW verification: {settings.webhookConfigured ? 'Configured' : 'Not synchronized'}</p>
        <p className="mt-2 text-sm text-slate-600">Webhook subscription must also be enabled in Razorpay. This page cannot confirm that subscription until Razorpay delivers an event.</p>
        <label className="mt-5 flex gap-3 font-semibold"><input type="checkbox" checked={settings.enabled} disabled={busy || !settings.connected} onChange={event => setSettings(current => ({ ...current, enabled: event.target.checked }))} />Automatically assign courses after full payment</label>
        <button type="button" disabled={busy || !settings.connected} onClick={() => save()} className="mt-5 rounded-lg bg-emerald-700 px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Please wait…' : 'Save enrollment settings'}</button>
      </section>
    </div>
  </AdminPlatformShell>;
}
