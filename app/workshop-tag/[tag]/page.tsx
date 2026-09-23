"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, Copy, Edit3, ExternalLink, Filter, IndianRupee, Layers, Link2, Plus, Search, Sparkles, Tag, UsersRound } from "lucide-react";
import { hydrateLiveState, readLocalArray } from "@/lib/live-state";
import { extractWorkshopTags, groupWorkshopsByTag, workshopHasTag, workshopMatchesSearch } from "@/lib/workshop-tags";
import type { RegistrationEntry, WorkshopBatch } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type WorkshopRecord = {
  archived?: boolean;
  batch?: string;
  batches?: WorkshopBatch[];
  discountCodeEod?: string;
  discountDescription?: string;
  discountType?: "percent" | "flat";
  discountValue?: string;
  facilitator: string;
  feesWithTax?: string;
  id: string;
  isPaid: boolean;
  isPartPaymentAllow?: boolean;
  legacyBatchCount?: number;
  maxOrderQty?: string;
  minOrderQty?: string;
  minimumPartPayment?: string;
  name: string;
  orderQtyTitle?: string;
  paymentUnknown?: boolean;
  productGroup: string;
  tag?: string;
  tags?: string[];
  transferLeadToCrm?: boolean;
  type: string;
};

const WORKSHOP_STORAGE_KEY = "cfl_workshop_master_records_v1";
const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";

export default function WorkshopTagPage() {
  const params = useParams();
  const router = useRouter();
  const rawTag = (params?.tag as string) || "";
  const currentTag = decodeURIComponent(rawTag);

  const [workshops, setWorkshops] = useState<WorkshopRecord[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [search, setSearch] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    function loadLocal() {
      setWorkshops(readLocalArray<WorkshopRecord>(WORKSHOP_STORAGE_KEY));
      setRegistrations(readLocalArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY));
    }
    loadLocal();
    hydrateLiveState().then(loadLocal);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === WORKSHOP_STORAGE_KEY || event.key === REGISTRATION_STORAGE_KEY) {
        loadLocal();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Filter ONLY workshops that have this specific tag assigned
  const taggedWorkshops = useMemo(() => {
    return workshops.filter((workshop) => {
      if (workshop.archived) return false;
      return workshopHasTag(workshop, currentTag);
    });
  }, [currentTag, workshops]);

  // Search filter within this tag's workshops
  const filteredWorkshops = useMemo(() => {
    return taggedWorkshops.filter((workshop) => workshopMatchesSearch(workshop, search));
  }, [search, taggedWorkshops]);

  // All distinct tags available across all workshops for quick tab switching
  const allTagGroups = useMemo(() => {
    return groupWorkshopsByTag(workshops);
  }, [workshops]);

  // Tag statistics
  const stats = useMemo(() => {
    const total = taggedWorkshops.length;
    const paid = taggedWorkshops.filter((w) => w.isPaid).length;
    const free = total - paid;
    const workshopIds = new Set(taggedWorkshops.map((w) => w.id));
    const workshopNames = new Set(taggedWorkshops.map((w) => w.name.trim().toLowerCase()));
    const regCount = registrations.filter(
      (r) => workshopIds.has(r.workshopId) || workshopNames.has(r.workshopTitle?.trim().toLowerCase())
    ).length;
    return { free, paid, regCount, total };
  }, [registrations, taggedWorkshops]);

  function copyRegistrationUrl(workshop: WorkshopRecord) {
    const slug = workshop.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workshop";
    const url = `${window.location.origin}/register/${slug}`;
    void navigator.clipboard.writeText(url);
    setCopiedLink(workshop.id);
    setTimeout(() => setCopiedLink(null), 2500);
  }

  return (
    <AdminPlatformShell
      activeLabel="Workshops"
      description={`Viewing all workshops exclusively tagged with "${currentTag}". Other workshops are filtered out.`}
      title={`Tag: ${currentTag}`}
    >
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => router.push("/")}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Main Dashboard
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => router.push("/workshop-master")}
              type="button"
            >
              <Layers className="size-4" />
              All Workshops Master
            </button>
          </div>

          <a
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700"
            href={`/workshop-master?tag=${encodeURIComponent(currentTag)}`}
          >
            <Plus className="size-4" />
            Add Workshop with Tag &quot;{currentTag}&quot;
          </a>
        </div>

        {/* All Available Tags Switcher Tabs */}
        {allTagGroups.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="shrink-0 font-black uppercase tracking-wider text-slate-400">
                All Tags:
              </span>
              {allTagGroups.map((group) => {
                const isActive = group.tag.toLowerCase() === currentTag.toLowerCase();
                return (
                  <button
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition ${
                      isActive
                        ? "bg-slate-950 text-white shadow-sm ring-2 ring-indigo-500"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
                    }`}
                    key={group.tag}
                    onClick={() => router.push(`/workshop-tag/${encodeURIComponent(group.tag)}`)}
                    type="button"
                  >
                    <Tag className="size-3" />
                    <span>{group.tag}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                        isActive ? "bg-white/20 text-white" : "bg-white text-slate-600"
                      }`}
                    >
                      {group.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Hero Tag Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 size-64 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-indigo-200 backdrop-blur-md">
                <Tag className="size-3.5 text-indigo-300" />
                Dedicated Tag Workspace
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
                Tag: <span className="text-indigo-300">{currentTag}</span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-indigo-200/80">
                This page exclusively contains workshops assigned the tag{" "}
                <span className="font-bold text-white">&quot;{currentTag}&quot;</span>. No workshops from other tags are displayed here.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Total</p>
                <p className="mt-1 text-2xl font-black text-white">{stats.total}</p>
                <p className="text-[11px] text-indigo-200/70">Workshops</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Paid</p>
                <p className="mt-1 text-2xl font-black text-white">{stats.paid}</p>
                <p className="text-[11px] text-indigo-200/70">Fee based</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Free</p>
                <p className="mt-1 text-2xl font-black text-white">{stats.free}</p>
                <p className="text-[11px] text-indigo-200/70">Open access</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Registrations</p>
                <p className="mt-1 text-2xl font-black text-white">{stats.regCount}</p>
                <p className="text-[11px] text-indigo-200/70">All participants</p>
              </div>
            </div>
          </div>
        </section>

        {/* Search & Workshop Table Section */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-950">
                Workshops with Tag &quot;{currentTag}&quot; ({filteredWorkshops.length})
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Filtered list showing only workshops tagged with {currentTag}.
              </p>
            </div>

            <label className="relative block min-w-[280px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search within "${currentTag}" workshops...`}
                value={search}
              />
            </label>
          </div>

          {/* Table */}
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[800px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Workshop Name</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Facilitator</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Product Group</th>
                  <th className="px-4 py-3">Pricing</th>
                  <th className="px-4 py-3">Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkshops.length ? (
                  filteredWorkshops.map((record) => {
                    const allTags = extractWorkshopTags(record);
                    return (
                      <tr
                        className="transition hover:bg-indigo-50/40"
                        key={record.id}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              aria-label="Copy registration link"
                              className={`grid size-8 place-items-center rounded-lg border transition ${
                                copiedLink === record.id
                                  ? "border-emerald-500 bg-emerald-600 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                              }`}
                              onClick={() => copyRegistrationUrl(record)}
                              title={copiedLink === record.id ? "Link copied!" : "Copy registration link"}
                              type="button"
                            >
                              <Link2 className="size-3.5" />
                            </button>
                            <a
                              aria-label="Edit in Workshop Master"
                              className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                              href={`/workshop-master`}
                              title="Edit in Workshop Master"
                            >
                              <Edit3 className="size-3.5" />
                            </a>
                            <a
                              aria-label="Open Schedule Admin"
                              className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                              href="/workshop-scheduling-admin"
                              title="Schedule Event"
                            >
                              <CalendarDays className="size-3.5" />
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <a
                            className="font-black text-indigo-700 hover:underline"
                            href="/workshop-master"
                          >
                            {record.name}
                          </a>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {allTags.map((t) => (
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-black ${
                                  t.toLowerCase() === currentTag.toLowerCase()
                                    ? "border border-indigo-300 bg-indigo-100 text-indigo-800"
                                    : "border border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                                key={t}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">
                          {record.facilitator}
                        </td>
                        <td className="px-4 py-4 text-slate-600">{record.type}</td>
                        <td className="px-4 py-4 text-slate-600">{record.productGroup}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                              record.isPaid
                                ? "bg-slate-950 text-white"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {record.isPaid ? `Paid · INR ${record.feesWithTax || "0"}` : "Free"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {record.legacyBatchCount
                            ? `${record.legacyBatchCount} batches`
                            : record.batch || "Main Batch"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center" colSpan={8}>
                      <div className="mx-auto max-w-sm text-center">
                        <Tag className="mx-auto size-10 text-slate-300" />
                        <h4 className="mt-3 text-base font-black text-slate-900">
                          No workshops found with tag &quot;{currentTag}&quot;
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {search
                            ? `No workshops matched "${search}". Try clearing your search.`
                            : `There are currently no active workshops assigned to the tag "${currentTag}".`}
                        </p>
                        <a
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700"
                          href={`/workshop-master?tag=${encodeURIComponent(currentTag)}`}
                        >
                          <Plus className="size-4" />
                          Create workshop with tag &quot;{currentTag}&quot;
                        </a>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminPlatformShell>
  );
}
