"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import type { AttendanceTeamPermissions, AttendanceTeamUserSummary } from "@/lib/types";
import { Check, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserRoundCheck, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SessionOption = { id: string; label: string; published: boolean };
type Draft = { id?: string; name: string; email: string; password: string; sessionIds: string[]; permissions: AttendanceTeamPermissions; active: boolean; expiresAt: string };

const inputClass = "w-full border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const emptyPermissions: AttendanceTeamPermissions = { deleteResponses: false, editAttendance: false, exportCsv: true, revealContact: false, viewAnswers: true };

function newDraft(): Draft { return { active: true, email: "", expiresAt: "", name: "", password: "", permissions: { ...emptyPermissions }, sessionIds: [] }; }

export default function AttendanceTeamAccessPage() {
  const [users, setUsers] = useState<AttendanceTeamUserSummary[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AttendanceTeamUserSummary | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/attendance-team", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load team access.");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load team access."); }
    finally { setLoading(false); }
  }

  const visibleUsers = useMemo(() => { const value = search.trim().toLowerCase(); return value ? users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(value)) : users; }, [search, users]);
  const visibleSessions = useMemo(() => { const value = sessionSearch.trim().toLowerCase(); return value ? sessions.filter((session) => session.label.toLowerCase().includes(value)) : sessions; }, [sessionSearch, sessions]);

  function edit(user: AttendanceTeamUserSummary) {
    setDraft({ active: user.active, email: user.email, expiresAt: localDateTime(user.expiresAt), id: user.id, name: user.name, password: "", permissions: { ...user.permissions }, sessionIds: [...user.sessionIds] });
    setError(""); setMessage("");
  }

  function patch(value: Partial<Draft>) { setDraft((current) => current ? { ...current, ...value } : current); setError(""); }
  function permission(key: keyof AttendanceTeamPermissions, value: boolean) { if (draft) patch({ permissions: { ...draft.permissions, [key]: value } }); }
  function toggleSession(id: string) { if (draft) patch({ sessionIds: draft.sessionIds.includes(id) ? draft.sessionIds.filter((item) => item !== id) : [...draft.sessionIds, id] }); }

  async function save() {
    if (!draft) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/attendance-team", { body: JSON.stringify({ ...draft, expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : "" }), headers: { "Content-Type": "application/json" }, method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save team access.");
      const saved = data.user as AttendanceTeamUserSummary;
      setUsers((current) => [saved, ...current.filter((user) => user.id !== saved.id)]);
      setDraft(null);
      setMessage(draft.id ? "Employee access updated." : "Employee account created.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save team access."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/admin/attendance-team?id=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete employee access.");
      setUsers((current) => current.filter((user) => user.id !== deleteTarget.id)); setDeleteTarget(null); setMessage("Employee access deleted.");
    } catch (reason) { setDeleteTarget(null); setError(reason instanceof Error ? reason.message : "Could not delete employee access."); }
  }

  if (draft) return (
    <AdminPlatformShell activeLabel="Attendance Team" description="Assign secure session-level attendance access to employees." title={draft.id ? "Edit Team Access" : "Create Team Access"}>
      <section className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5"><div><h2 className="text-2xl font-black">{draft.id ? draft.name : "New employee account"}</h2><p className="mt-2 text-sm font-semibold text-slate-500">Choose sessions and exactly what this employee can do.</p></div><button aria-label="Close editor" className="grid size-10 place-items-center border border-slate-200 text-slate-500" onClick={() => setDraft(null)} type="button"><X className="size-4" /></button></header>
        {error ? <p className="mt-5 border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Employee name"><input className={inputClass} onChange={(event) => patch({ name: event.target.value })} placeholder="Name or team" value={draft.name} /></Field>
          <Field label="Login email"><input autoComplete="email" className={inputClass} onChange={(event) => patch({ email: event.target.value })} placeholder="employee@example.com" type="email" value={draft.email} /></Field>
          <Field label={draft.id ? "New password" : "Password"}><div className="relative"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input autoComplete="new-password" className={`${inputClass} pl-10`} onChange={(event) => patch({ password: event.target.value })} placeholder={draft.id ? "Leave blank to keep current" : "Minimum 8 characters"} type="password" value={draft.password} /></div></Field>
          <Field label="Access expires"><input className={inputClass} onChange={(event) => patch({ expiresAt: event.target.value })} type="datetime-local" value={draft.expiresAt} /></Field>
        </div>
        <div className="mt-7 grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
          <div><div className="flex items-end justify-between"><div><h3 className="font-black">Assigned sessions</h3><p className="mt-1 text-xs font-bold text-slate-500">{draft.sessionIds.length} selected</p></div><button className="text-xs font-black text-emerald-700" onClick={() => patch({ sessionIds: visibleSessions.every((session) => draft.sessionIds.includes(session.id)) ? draft.sessionIds.filter((id) => !visibleSessions.some((session) => session.id === id)) : [...new Set([...draft.sessionIds, ...visibleSessions.map((session) => session.id)])] })} type="button">{visibleSessions.length && visibleSessions.every((session) => draft.sessionIds.includes(session.id)) ? "Clear visible" : "Select visible"}</button></div><label className="relative mt-3 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} onChange={(event) => setSessionSearch(event.target.value)} placeholder="Search session..." value={sessionSearch} /></label><div className="mt-3 max-h-80 overflow-y-auto border border-slate-200 bg-slate-50 p-2">{visibleSessions.map((session) => <label className="flex cursor-pointer items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 last:border-b-0" key={session.id}><input checked={draft.sessionIds.includes(session.id)} className="size-4 accent-emerald-600" onChange={() => toggleSession(session.id)} type="checkbox" /><span className="min-w-0 flex-1 text-sm font-bold text-slate-800">{session.label}</span>{draft.sessionIds.includes(session.id) ? <Check className="size-4 text-emerald-600" /> : null}</label>)}{!visibleSessions.length ? <p className="py-8 text-center text-sm font-bold text-slate-500">No attendance sessions found.</p> : null}</div></div>
          <div><h3 className="font-black">Permissions</h3><div className="mt-3 divide-y divide-slate-200 border-y border-slate-200"><Permission checked={draft.permissions.revealContact} label="Reveal contacts" onChange={(value) => permission("revealContact", value)} /><Permission checked={draft.permissions.viewAnswers} label="View custom answers" onChange={(value) => permission("viewAnswers", value)} /><Permission checked={draft.permissions.exportCsv} label="Export CSV" onChange={(value) => permission("exportCsv", value)} /><Permission checked={draft.permissions.editAttendance} label="Edit attendance status" onChange={(value) => permission("editAttendance", value)} /><Permission checked={draft.permissions.deleteResponses} label="Delete responses" onChange={(value) => permission("deleteResponses", value)} /></div><label className="mt-5 flex cursor-pointer items-center justify-between border border-slate-200 bg-slate-50 p-4"><span><span className="block font-black">Account active</span><span className="mt-1 block text-xs font-bold text-slate-500">Turn off to revoke immediately</span></span><input checked={draft.active} className="size-5 accent-emerald-600" onChange={(event) => patch({ active: event.target.checked })} type="checkbox" /></label></div>
        </div>
        <footer className="mt-7 flex justify-end gap-3 border-t border-slate-200 pt-5"><button className="border border-slate-300 px-4 py-3 text-sm font-black" onClick={() => setDraft(null)} type="button">Cancel</button><button className="inline-flex items-center gap-2 bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={saving} onClick={() => void save()} type="button"><ShieldCheck className="size-4" />{saving ? "Saving..." : "Save Access"}</button></footer>
      </section>
    </AdminPlatformShell>
  );

  return (
    <AdminPlatformShell activeLabel="Attendance Team" description="Give employees secure access to selected attendance responses." title="Attendance Team Access">
      <section className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-black">Employee Accounts</h2><p className="mt-2 text-sm font-semibold text-slate-500">Employees sign in at <span className="font-black text-slate-700">/attendance-team/login</span>.</p></div><button className="inline-flex items-center gap-2 bg-emerald-600 px-5 py-3 text-sm font-black text-white" onClick={() => { setDraft(newDraft()); setError(""); setMessage(""); }} type="button"><Plus className="size-4" />Add Employee</button></header>
        {error ? <p className="mt-5 border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}{message ? <p className="mt-5 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p> : null}
        <label className="relative mt-6 block max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee..." value={search} /></label>
        <div className="mt-5 overflow-x-auto border border-slate-200"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Sessions</th><th className="px-4 py-3">Permissions</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last login</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <Empty label="Loading employee accounts..." /> : null}{!loading && !visibleUsers.length ? <Empty label="No employee access created yet." /> : null}{!loading ? visibleUsers.map((user) => <tr key={user.id}><td className="px-4 py-4"><p className="font-black">{user.name}</p><p className="mt-1 text-xs text-slate-500">{user.email}</p></td><td className="px-4 py-4 font-bold text-slate-700">{user.sessionIds.length}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-1">{Object.entries(user.permissions).filter(([, enabled]) => enabled).map(([key]) => <span className="bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700" key={key}>{permissionLabel(key)}</span>)}</div></td><td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-black ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{user.active ? "Active" : "Revoked"}</span></td><td className="px-4 py-4 text-xs font-bold text-slate-600">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-IN") : "Never"}</td><td className="px-4 py-4"><div className="flex gap-2"><button aria-label={`Edit ${user.name}`} className="grid size-9 place-items-center bg-emerald-600 text-white" onClick={() => edit(user)} type="button"><Pencil className="size-4" /></button><button aria-label={`Delete ${user.name}`} className="grid size-9 place-items-center bg-rose-50 text-rose-600" onClick={() => setDeleteTarget(user)} type="button"><Trash2 className="size-4" /></button></div></td></tr>) : null}</tbody></table></div>
      </section>
      <ConfirmDialog confirmLabel="Delete Employee" description="This employee will immediately lose access. Attendance responses are not deleted." onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove()} open={Boolean(deleteTarget)} title="Delete employee access?">{deleteTarget?.name}</ConfirmDialog>
    </AdminPlatformShell>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label><span className="mb-2 block text-sm font-black text-slate-700">{label}</span>{children}</label>; }
function Permission({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) { return <label className="flex cursor-pointer items-center justify-between gap-4 py-3"><span className="inline-flex items-center gap-3 text-sm font-black text-slate-700"><UserRoundCheck className={`size-4 ${checked ? "text-emerald-600" : "text-slate-400"}`} />{label}</span><input checked={checked} className="size-5 accent-emerald-600" onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>; }
function Empty({ label }: { label: string }) { return <tr><td className="px-4 py-12 text-center font-bold text-slate-500" colSpan={6}><UsersRound className="mx-auto mb-3 size-7 text-slate-300" />{label}</td></tr>; }
function permissionLabel(key: string) { return ({ revealContact: "Contacts", viewAnswers: "Answers", exportCsv: "Export", editAttendance: "Edit", deleteResponses: "Delete" } as Record<string, string>)[key] || key; }
function localDateTime(value?: string) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
