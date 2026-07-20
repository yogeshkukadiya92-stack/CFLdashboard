"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import type { ResponseAccessGrantSummary, ResponseAccessPermissions } from "@/lib/types";
import { Check, Copy, ExternalLink, Eye, FileDown, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserRoundCheck, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type WorkshopOption = { id: string; name: string };
type AccessDraft = {
  id?: string;
  recipientName: string;
  recipientContact: string;
  accessCode: string;
  workshopIds: string[];
  permissions: ResponseAccessPermissions;
  active: boolean;
  expiresAt: string;
};

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

function createDraft(): AccessDraft {
  return {
    recipientName: "",
    recipientContact: "",
    accessCode: "",
    workshopIds: [],
    permissions: { exportCsv: false, revealContact: false, viewAnswers: true },
    active: true,
    expiresAt: ""
  };
}

export default function ResponseAccessPage() {
  const [grants, setGrants] = useState<ResponseAccessGrantSummary[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [draft, setDraft] = useState<AccessDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [workshopSearch, setWorkshopSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ResponseAccessGrantSummary | null>(null);
  const [createdLink, setCreatedLink] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  useEffect(() => { void loadAccess(); }, []);

  async function loadAccess() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/response-access", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load access records.");
      setGrants(Array.isArray(data.grants) ? data.grants : []);
      setWorkshops(Array.isArray(data.workshops) ? data.workshops : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load access records.");
    } finally {
      setLoading(false);
    }
  }

  const filteredGrants = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return grants;
    return grants.filter((grant) => [grant.recipientName, grant.recipientContact ?? "", ...grant.workshopNames].some((item) => item.toLowerCase().includes(value)));
  }, [grants, search]);
  const filteredWorkshops = useMemo(() => {
    const value = workshopSearch.trim().toLowerCase();
    return value ? workshops.filter((workshop) => workshop.name.toLowerCase().includes(value)) : workshops;
  }, [workshopSearch, workshops]);
  const activeCount = grants.filter((grant) => accessStatus(grant) === "Active").length;
  const totalViews = grants.reduce((total, grant) => total + grant.accessCount, 0);

  function editGrant(grant: ResponseAccessGrantSummary) {
    setDraft({
      id: grant.id,
      recipientName: grant.recipientName,
      recipientContact: grant.recipientContact ?? "",
      accessCode: "",
      workshopIds: [...grant.workshopIds],
      permissions: { ...grant.permissions },
      active: grant.active,
      expiresAt: toLocalDateTime(grant.expiresAt)
    });
    setCreatedLink("");
    setCreatedCode("");
    setMessage("");
    setError("");
    window.requestAnimationFrame(() => window.scrollTo({ behavior: "smooth", top: 0 }));
  }

  function updateDraft(patch: Partial<AccessDraft>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setError("");
    setMessage("");
  }

  function updatePermission(key: keyof ResponseAccessPermissions, value: boolean) {
    if (!draft) return;
    updateDraft({ permissions: { ...draft.permissions, [key]: value } });
  }

  function toggleWorkshop(id: string) {
    if (!draft) return;
    updateDraft({ workshopIds: draft.workshopIds.includes(id) ? draft.workshopIds.filter((item) => item !== id) : [...draft.workshopIds, id] });
  }

  async function saveGrant() {
    if (!draft) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/response-access", {
        body: JSON.stringify({ ...draft, expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : "" }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save response access.");
      const saved = data.grant as ResponseAccessGrantSummary;
      setGrants((current) => [saved, ...current.filter((grant) => grant.id !== saved.id)]);
      setDraft({
        id: saved.id,
        recipientName: saved.recipientName,
        recipientContact: saved.recipientContact ?? "",
        accessCode: "",
        workshopIds: [...saved.workshopIds],
        permissions: { ...saved.permissions },
        active: saved.active,
        expiresAt: toLocalDateTime(saved.expiresAt)
      });
      setCreatedLink(`${window.location.origin}${data.path}`);
      setCreatedCode(draft.accessCode);
      setMessage(draft.id ? "Response access updated." : "Response access created.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save response access.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGrant() {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/admin/response-access?id=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete response access.");
      setGrants((current) => current.filter((grant) => grant.id !== deleteTarget.id));
      if (draft?.id === deleteTarget.id) setDraft(null);
      setDeleteTarget(null);
      setMessage("Response access deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete response access.");
      setDeleteTarget(null);
    }
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setError("Could not copy. Please select and copy manually.");
    }
  }

  if (draft) {
    const editLink = draft.id ? `${windowOrigin()}/response-view/${grants.find((grant) => grant.id === draft.id)?.token ?? ""}` : "";
    const selectedVisibleCount = filteredWorkshops.filter((workshop) => draft.workshopIds.includes(workshop.id)).length;
    return (
      <AdminPlatformShell activeLabel="Response Access" description="Control secure, workshop-specific access to registration responses." title={draft.id ? "Edit Response Access" : "Create Response Access"}>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div><h2 className="text-2xl font-black">{draft.id ? draft.recipientName : "New viewer access"}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{draft.id ? "Update scope, permissions or access code." : "Create a private response-viewing link."}</p></div>
            <button aria-label="Close editor" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setDraft(null)} type="button"><X className="size-4" /></button>
          </div>

          {error ? <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
          {message ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p> : null}
          {(createdLink || editLink) ? (
            <div className="mt-5 flex flex-col gap-3 border-l-4 border-emerald-500 bg-slate-50 p-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase text-slate-500">Secure viewer link</p><p className="mt-1 truncate font-mono text-sm font-bold text-slate-800">{createdLink || editLink}</p></div>
              <div className="flex gap-2"><button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black" onClick={() => void copyText(createdLink || editLink, "Viewer link copied.")} type="button"><Copy className="size-4" />Copy Link</button><a className="grid size-11 place-items-center rounded-xl bg-slate-950 text-white" href={createdLink || editLink} rel="noreferrer" target="_blank" title="Open viewer"><ExternalLink className="size-4" /></a></div>
            </div>
          ) : null}
          {createdCode ? (
            <div className="mt-3 flex flex-col gap-3 border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase text-amber-700">One-time access code</p><p className="mt-1 font-mono text-lg font-black tracking-widest text-slate-950">{createdCode}</p><p className="mt-1 text-xs font-bold text-amber-800">Share this code separately. It cannot be viewed again after you leave this screen.</p></div>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-black" onClick={() => void copyText(createdCode, "Access code copied.")} type="button"><Copy className="size-4" />Copy Code</button>
            </div>
          ) : null}

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Field label="Viewer name"><input className={inputClass} maxLength={150} onChange={(event) => updateDraft({ recipientName: event.target.value })} placeholder="Person or team name" value={draft.recipientName} /></Field>
            <Field label="Mobile or email"><input className={inputClass} maxLength={200} onChange={(event) => updateDraft({ recipientContact: event.target.value })} placeholder="Optional contact" value={draft.recipientContact} /></Field>
            <Field label={draft.id ? "New access code" : "Access code"}><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input autoComplete="new-password" className={`${inputClass} pl-10`} maxLength={32} minLength={4} onChange={(event) => updateDraft({ accessCode: event.target.value })} placeholder={draft.id ? "Leave blank to keep current code" : "Minimum 4 characters"} type="password" value={draft.accessCode} /></div></Field>
            <Field label="Expires on"><input className={inputClass} min={toLocalDateTime(new Date().toISOString())} onChange={(event) => updateDraft({ expiresAt: event.target.value })} type="datetime-local" value={draft.expiresAt} /></Field>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-black text-slate-700">Workshop access</p><p className="mt-1 text-xs font-bold text-slate-500">{draft.workshopIds.length} selected</p></div><button className="text-xs font-black text-emerald-700" onClick={() => updateDraft({ workshopIds: selectedVisibleCount === filteredWorkshops.length ? draft.workshopIds.filter((id) => !filteredWorkshops.some((workshop) => workshop.id === id)) : [...new Set([...draft.workshopIds, ...filteredWorkshops.map((workshop) => workshop.id)])] })} type="button">{filteredWorkshops.length > 0 && selectedVisibleCount === filteredWorkshops.length ? "Clear visible" : "Select visible"}</button></div>
              <label className="relative mt-3 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} onChange={(event) => setWorkshopSearch(event.target.value)} placeholder="Search workshops..." value={workshopSearch} /></label>
              <div className="mt-3 max-h-80 overflow-y-auto border border-slate-200 bg-slate-50 p-2">
                {filteredWorkshops.length ? filteredWorkshops.map((workshop) => <label className="flex cursor-pointer items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 last:border-b-0 hover:bg-emerald-50" key={workshop.id}><input checked={draft.workshopIds.includes(workshop.id)} className="size-4 accent-emerald-600" onChange={() => toggleWorkshop(workshop.id)} type="checkbox" /><span className="min-w-0 flex-1 text-sm font-bold text-slate-800">{workshop.name}</span>{draft.workshopIds.includes(workshop.id) ? <Check className="size-4 text-emerald-600" /> : null}</label>) : <p className="px-3 py-8 text-center text-sm font-bold text-slate-500">No workshops found.</p>}
              </div>
            </div>

            <div><p className="text-sm font-black text-slate-700">Permissions</p><div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              <PermissionRow checked={draft.permissions.revealContact} description="Show full mobile and email" icon={Eye} label="Reveal contact details" onChange={(value) => updatePermission("revealContact", value)} />
              <PermissionRow checked={draft.permissions.exportCsv} description="Allow CSV download" icon={FileDown} label="Export responses" onChange={(value) => updatePermission("exportCsv", value)} />
              <PermissionRow checked={draft.permissions.viewAnswers} description="Show custom form answers" icon={UserRoundCheck} label="View detailed answers" onChange={(value) => updatePermission("viewAnswers", value)} />
            </div><label className="mt-5 flex cursor-pointer items-center justify-between gap-4 border border-slate-200 bg-slate-50 p-4"><span><span className="block font-black text-slate-800">Access active</span><span className="mt-1 block text-xs font-bold text-slate-500">Turn off to revoke immediately</span></span><input checked={draft.active} className="size-5 accent-emerald-600" onChange={(event) => updateDraft({ active: event.target.checked })} type="checkbox" /></label></div>
          </div>

          <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5"><button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={() => setDraft(null)} type="button">Cancel</button><button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60" disabled={saving} onClick={() => void saveGrant()} type="button"><ShieldCheck className="size-4" />{saving ? "Saving..." : draft.id ? "Update Access" : "Create Secure Access"}</button></div>
        </section>
      </AdminPlatformShell>
    );
  }

  return (
    <AdminPlatformShell activeLabel="Response Access" description="Share selected workshop responses without sharing the admin dashboard." title="Response Access">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-black">Viewer Access</h2><p className="mt-2 text-sm font-semibold text-slate-500">Secure links for workshop response viewing.</p></div><button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700" onClick={() => { setDraft(createDraft()); setMessage(""); setError(""); setCreatedLink(""); setCreatedCode(""); }} type="button"><Plus className="size-4" />Create Access</button></div>
        {error ? <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
        {message ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p> : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="Total access" value={grants.length} /><Stat label="Active" value={activeCount} /><Stat label="Viewer logins" value={totalViews} /></div>
        <label className="relative mt-6 block max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder="Search viewer or workshop..." value={search} /></label>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Viewer", "Workshops", "Permissions", "Status", "Last access", "Actions"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <EmptyRow label="Loading access records..." /> : null}{!loading && !filteredGrants.length ? <EmptyRow label="No response access created yet." /> : null}{!loading ? filteredGrants.map((grant) => <tr className="hover:bg-emerald-50/30" key={grant.id}><td className="px-4 py-4"><p className="font-black text-slate-950">{grant.recipientName}</p><p className="mt-1 text-xs text-slate-500">{grant.recipientContact || "No contact added"}</p></td><td className="px-4 py-4"><p className="max-w-xs font-bold text-slate-700">{grant.workshopNames.slice(0, 2).join(", ")}{grant.workshopNames.length > 2 ? ` +${grant.workshopNames.length - 2}` : ""}</p></td><td className="px-4 py-4"><div className="flex flex-wrap gap-1.5"><PermissionBadge enabled={grant.permissions.revealContact} label="Contact" /><PermissionBadge enabled={grant.permissions.exportCsv} label="Export" /><PermissionBadge enabled={grant.permissions.viewAnswers} label="Answers" /></div></td><td className="px-4 py-4"><StatusBadge status={accessStatus(grant)} /></td><td className="px-4 py-4"><p className="font-bold text-slate-700">{grant.lastAccessedAt ? formatDateTime(grant.lastAccessedAt) : "Never"}</p><p className="mt-1 text-xs text-slate-500">{grant.accessCount} login{grant.accessCount === 1 ? "" : "s"}</p></td><td className="px-4 py-4"><div className="flex gap-2"><button aria-label="Copy viewer link" className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100" onClick={() => void copyText(`${windowOrigin()}/response-view/${grant.token}`, "Viewer link copied.")} title="Copy link" type="button"><Copy className="size-4" /></button><a aria-label="Open response viewer" className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" href={`/response-view/${grant.token}`} rel="noreferrer" target="_blank" title="Open viewer"><ExternalLink className="size-4" /></a><button aria-label="Edit response access" className="grid size-9 place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => editGrant(grant)} title="Edit" type="button"><Pencil className="size-4" /></button><button aria-label="Delete response access" className="grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => setDeleteTarget(grant)} title="Delete" type="button"><Trash2 className="size-4" /></button></div></td></tr>) : null}</tbody></table></div>
      </section>
      <ConfirmDialog confirmLabel="Delete Access" description="The viewer link will stop working immediately. Workshop responses are not deleted." onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteGrant()} open={Boolean(deleteTarget)} title="Delete response access?">{deleteTarget ? `${deleteTarget.recipientName} · ${deleteTarget.workshopNames.length} workshop${deleteTarget.workshopNames.length === 1 ? "" : "s"}` : null}</ConfirmDialog>
    </AdminPlatformShell>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="block"><span className="mb-2 block text-sm font-black text-slate-700">{label}</span>{children}</label>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="border-b-2 border-emerald-500 bg-slate-50 px-4 py-4"><p className="text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>; }
function EmptyRow({ label }: { label: string }) { return <tr><td className="px-4 py-12 text-center font-bold text-slate-500" colSpan={6}>{label}</td></tr>; }
function PermissionRow({ checked, description, icon: Icon, label, onChange }: { checked: boolean; description: string; icon: typeof Eye; label: string; onChange: (value: boolean) => void }) { return <label className="flex cursor-pointer items-center gap-3 py-4"><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${checked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block font-black text-slate-800">{label}</span><span className="mt-1 block text-xs font-bold text-slate-500">{description}</span></span><input checked={checked} className="size-5 accent-emerald-600" onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>; }
function PermissionBadge({ enabled, label }: { enabled: boolean; label: string }) { return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{label}</span>; }
function StatusBadge({ status }: { status: "Active" | "Expired" | "Revoked" }) { const tone = status === "Active" ? "bg-emerald-50 text-emerald-700" : status === "Expired" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"; return <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>{status}</span>; }
function accessStatus(grant: ResponseAccessGrantSummary): "Active" | "Expired" | "Revoked" { if (!grant.active) return "Revoked"; if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) return "Expired"; return "Active"; }
function toLocalDateTime(value?: string) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function windowOrigin() { return typeof window === "undefined" ? "" : window.location.origin; }
