"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { permissionsForRoles, salesPermissionOptions } from "@/lib/sales-permissions";
import type { CrmTeamRole, SalesPermission } from "@/lib/types";
import { BriefcaseBusiness, Check, Eye, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type AccessUser = { id: string; name: string; email: string; mobile: string; active: boolean; permissions: SalesPermission[]; roles: CrmTeamRole[] };

export default function SalesAccessPage() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [permissions, setPermissions] = useState<SalesPermission[]>([]);
  const [roles, setRoles] = useState<CrmTeamRole[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const selected = users.find((user) => user.id === selectedId);

  useEffect(() => {
    fetch("/api/admin/sales-access", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = (data.users || []) as AccessUser[];
      setUsers(next);
      if (next[0]) { setSelectedId(next[0].id); setPermissions(next[0].permissions); setRoles(next[0].roles); }
    }).catch(() => setMessage("Could not load salesperson access." )).finally(() => setLoading(false));
  }, []);

  function selectUser(user: AccessUser) { setSelectedId(user.id); setPermissions(user.permissions); setRoles(user.roles); setMessage(""); }
  function toggle(permission: SalesPermission) { setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]); }
  function toggleRole(role: CrmTeamRole) { const next=roles.includes(role)?roles.filter((item)=>item!==role):[...roles,role];setRoles(next);setPermissions(permissionsForRoles(next));setMessage(""); }
  async function save() {
    if (!selected) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/sales-access", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selected.id, permissions, roles }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers((current) => current.map((user) => user.id === selected.id ? { ...user, permissions, roles } : user));
      setMessage("Access saved. Changes apply after this team member signs in again.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save access."); }
    finally { setSaving(false); }
  }

  const allowedPermissions = permissionsForRoles(roles);
  return <AdminPlatformShell activeLabel="CRM Team Access" title="CRM Team Access Management" description="Set each account as Sales, Observer, or both, then choose the CRM screens they can open.">
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-1 pb-4"><span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white"><UserRound className="size-5" /></span><div><h3 className="font-black text-slate-950">CRM team</h3><p className="text-xs font-semibold text-slate-500">{users.length} login accounts</p></div></div>
        <div className="mt-3 space-y-2">{loading ? <p className="p-3 text-sm font-bold text-slate-500">Loading salespeople…</p> : users.length ? users.map((user) => <button className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === user.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`} key={user.id} onClick={() => selectUser(user)} type="button"><div className="flex items-center justify-between gap-2"><span className="font-black text-slate-950">{user.name}</span><span className={`size-2 rounded-full ${user.active ? "bg-emerald-500" : "bg-slate-300"}`} /></div><p className="mt-1 truncate text-xs font-semibold text-slate-500">{user.email || user.mobile}</p></button>) : <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Create a salesperson login first.</p>}</div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        {selected ? <><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-600" /><h3 className="text-xl font-black text-slate-950">{selected.name}</h3></div><p className="mt-1 text-sm font-semibold text-slate-500">Select the modules this user may access.</p></div><button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={saving} onClick={save} type="button"><Save className="size-4" />{saving ? "Saving…" : "Save permissions"}</button></div>
        {message ? <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${message.startsWith("Access saved") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</p> : null}
        <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Account roles</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><button aria-pressed={roles.includes("sales")} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${roles.includes("sales")?"border-indigo-300 bg-indigo-50":"border-slate-200"}`} onClick={()=>toggleRole("sales")} type="button"><span className={`grid size-10 place-items-center rounded-xl ${roles.includes("sales")?"bg-indigo-600 text-white":"bg-slate-100 text-slate-400"}`}><BriefcaseBusiness className="size-5" /></span><span><strong className="block text-sm font-black">Sales</strong><span className="text-xs font-semibold text-slate-500">Leads, follow-ups and analytics</span></span></button><button aria-pressed={roles.includes("observer")} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${roles.includes("observer")?"border-amber-300 bg-amber-50":"border-slate-200"}`} onClick={()=>toggleRole("observer")} type="button"><span className={`grid size-10 place-items-center rounded-xl ${roles.includes("observer")?"bg-amber-500 text-white":"bg-slate-100 text-slate-400"}`}><Eye className="size-5" /></span><span><strong className="block text-sm font-black">Observer</strong><span className="text-xs font-semibold text-slate-500">Sessions and participant scorecards</span></span></button></div></div>
        <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Page permissions</p><div className="mt-3 grid gap-3 md:grid-cols-2">{salesPermissionOptions.map((option) => { const available=allowedPermissions.includes(option.key);const checked=permissions.includes(option.key)&&available; return <button aria-pressed={checked} className={`flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition ${checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"} disabled:cursor-not-allowed disabled:opacity-45`} disabled={!available} key={option.key} onClick={() => toggle(option.key)} type="button"><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${checked ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>{checked ? <Check className="size-4" /> : <LockKeyhole className="size-4" />}</span><span><strong className="block text-sm font-black text-slate-950">{option.label}</strong><span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{option.description}</span></span></button>})}</div></div></> : <div className="grid min-h-72 place-items-center text-center"><div><UserRound className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-black text-slate-700">Select a CRM team member</p></div></div>}
      </section>
    </div>
  </AdminPlatformShell>;
}
