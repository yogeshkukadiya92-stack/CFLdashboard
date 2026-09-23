"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ArrowRight, CalendarDays, ClipboardCheck, Download, FileSpreadsheet, IndianRupee, Plus, Sparkles, Tag, Target, TrendingUp, UserPlus, UsersRound } from "lucide-react";
import { buildDashboardSnapshot, type DashboardSnapshot } from "@/lib/dashboard-summary";
import { LIVE_STATE_STORAGE_KEYS, readLocalArray, saveLiveState, type LiveStatePatch } from "@/lib/live-state";
import { groupWorkshopsByTag } from "@/lib/workshop-tags";
import { useEffect, useMemo, useState } from "react";

type ClientRow = {
  city: string;
  email: string;
  id: number;
  mobile: string;
  name: string;
  status: "Active" | "Inactive" | "Suspect";
};

type WorkshopRecord = {
  archived?: boolean;
  facilitator: string;
  id: string;
  isPaid: boolean;
  name: string;
  productGroup: string;
  tag?: string;
  tags?: string[];
  type: string;
};

type RegistrationEntry = {
  amountDue: number;
  amountPaid: number;
  city: string;
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  mobile: string;
  status: "Paid" | "Due";
  workshopId: string;
  workshopTitle: string;
};

type ScheduleRecord = {
  batch: string;
  discountValue: string;
  facilitator: string;
  feesWithTax: string;
  id: string;
  isPaidEvent: boolean;
  selectedEvent: string;
  transferLeadToCrm: boolean;
};

function formatInr(value: number) {
  return `INR ${value.toLocaleString("en-IN")}`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopRecord[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [remoteSnapshot, setRemoteSnapshot] = useState<DashboardSnapshot | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let remoteController: AbortController | null = null;
    let usesLocalFallback = false;

    function load() {
      setClients(readLocalArray<ClientRow>(LIVE_STATE_STORAGE_KEYS.clients));
      setWorkshops(readLocalArray<WorkshopRecord>(LIVE_STATE_STORAGE_KEYS.workshops));
      setRegistrations(readLocalArray<RegistrationEntry>(LIVE_STATE_STORAGE_KEYS.registrations));
      setSchedules(readLocalArray<ScheduleRecord>(LIVE_STATE_STORAGE_KEYS.schedules));
    }

    async function loadRemoteSnapshot() {
      remoteController?.abort();
      remoteController = new AbortController();
      try {
        const response = await fetch("/api/dashboard-summary", {
          cache: "no-store",
          signal: remoteController.signal,
        });
        const payload = await response.json() as { dbEnabled?: boolean; snapshot?: DashboardSnapshot };
        if (response.ok && payload.dbEnabled && payload.snapshot) {
          const repairPatch: LiveStatePatch = {};
          if (payload.snapshot.clientCount === 0) {
            const localClients = readLocalArray<ClientRow>(LIVE_STATE_STORAGE_KEYS.clients);
            if (localClients.length > 0) repairPatch.clients = localClients;
          }
          if (payload.snapshot.workshopCount === 0) {
            const localWorkshops = readLocalArray<WorkshopRecord>(LIVE_STATE_STORAGE_KEYS.workshops);
            if (localWorkshops.length > 0) repairPatch.workshops = localWorkshops;
          }
          if (payload.snapshot.registrationCount === 0) {
            const localRegistrations = readLocalArray<RegistrationEntry>(LIVE_STATE_STORAGE_KEYS.registrations);
            if (localRegistrations.length > 0) repairPatch.registrations = localRegistrations;
          }
          if (payload.snapshot.scheduleCount === 0) {
            const localSchedules = readLocalArray<ScheduleRecord>(LIVE_STATE_STORAGE_KEYS.schedules);
            if (localSchedules.length > 0) repairPatch.schedules = localSchedules;
          }
          if (Object.keys(repairPatch).length > 0 && await saveLiveState(repairPatch)) {
            await loadRemoteSnapshot();
            return;
          }
          usesLocalFallback = false;
          setRemoteSnapshot(payload.snapshot);
          return;
        }
        usesLocalFallback = true;
        load();
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          usesLocalFallback = true;
          load();
        }
      }
    }

    function refresh() {
      load();
      void loadRemoteSnapshot();
    }

    load();
    void loadRemoteSnapshot();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      remoteController?.abort();
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const localSnapshot = useMemo(() => {
    return buildDashboardSnapshot(clients, workshops, registrations, schedules);
  }, [clients, registrations, schedules, workshops]);
  const snapshot = remoteSnapshot ?? localSnapshot;
  const tagGroups = useMemo(() => {
    return groupWorkshopsByTag(workshops);
  }, [workshops]);
  const conversion = snapshot.registrationCount
    ? Math.round((snapshot.paidRegistrations / snapshot.registrationCount) * 100)
    : 0;
  const eventRows = snapshot.eventRows;

  function exportDashboard() {
    downloadCsv("dashboard-registration-status.csv", [
      ["Event Name", "Date Range", "Latest Registrant", "Total Registrations", "New Registrations"],
      ...eventRows.map((row) => [row.name, row.dateRange, row.latest, String(row.registrations), String(row.newCount)])
    ]);
    setMessage(`Exported ${eventRows.length} event rows.`);
  }

  const stats = [
    { icon: CalendarDays, label: "Workshops", value: String(snapshot.workshopCount), helper: "Created in Workshop Master", tone: "bg-emerald-50 text-emerald-700" },
    { icon: TrendingUp, label: "Scheduled", value: String(snapshot.scheduleCount), helper: "Configured schedules", tone: "bg-indigo-50 text-indigo-700" },
    { icon: UsersRound, label: "Clients", value: String(snapshot.clientCount), helper: "Imported or added records", tone: "bg-rose-50 text-rose-700" },
    { icon: IndianRupee, label: "Collected", value: formatInr(snapshot.revenue), helper: `${formatInr(snapshot.due)} due`, tone: "bg-amber-50 text-amber-700" }
  ];

  return (
    <AdminPlatformShell
      activeLabel="Dashboard"
      description="Live workspace for workshops, clients, registrations, schedules and exports. Add real data in modules and this dashboard updates automatically."
      title="Business Dashboard"
    >
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-slate-500">Paid Session Health</p>
              <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{snapshot.registrationCount}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Total registrations tracked across saved workshops.</p>
            </div>
            <div className="grid size-36 place-items-center rounded-full bg-slate-100">
              <div
                className="grid size-36 place-items-center rounded-full"
                style={{ background: `conic-gradient(#10b981 0 ${conversion}%, #e2e8f0 ${conversion}% 100%)` }}
              >
                <div className="grid size-24 place-items-center rounded-full bg-white shadow-inner">
                  <span className="text-xl font-black text-slate-950">{conversion}%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              ["Paid", snapshot.paidRegistrations, "bg-emerald-500"],
              ["Due", snapshot.registrationCount - snapshot.paidRegistrations, "bg-amber-500"],
              ["Clients", snapshot.clientCount, "bg-rose-500"]
            ].map(([label, value, dot]) => (
              <div className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700" key={label}>
                <span className={`mr-2 inline-block size-2 rounded-full ${dot}`} />
                {label}: {value}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xl font-black text-slate-950">Next Event</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Pulled from saved schedule/workshop data.</p>
            </div>
            <a className="grid size-10 place-items-center rounded-lg bg-slate-950 text-white" href="/workshop-scheduling-admin">
              <Plus className="size-4" />
            </a>
          </div>
          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-5">
            <span className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white">
              {snapshot.nextEvent ? "Ready" : "Setup Needed"}
            </span>
            <h3 className="mt-5 text-2xl font-black text-slate-950">{snapshot.nextEvent || "No upcoming event"}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-600">Facilitator: {snapshot.nextFacilitator}</p>
            <a className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white" href="/workshop-master">
              {snapshot.nextEvent ? "Manage Workshop" : "Create Workshop"}
            </a>
          </div>
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" key={stat.label}>
              <span className={`grid size-11 place-items-center rounded-lg ${stat.tone}`}>
                <Icon className="size-5" />
              </span>
              <p className="mt-5 text-2xl font-black text-slate-950">{stat.value}</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{stat.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{stat.helper}</p>
            </div>
          );
        })}
      </section>

      {/* Workshop Tags & Dedicated Pages */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70">
              <Tag className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-950">Workshop Tags</h3>
                {tagGroups.length > 0 ? (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-black text-indigo-800">
                    {tagGroups.length} {tagGroups.length === 1 ? "Tag" : "Tags"}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                Click on any tag to open its dedicated page showing exclusively that tag&apos;s workshops.
              </p>
            </div>
          </div>
          <a
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition"
            href="/workshop-master"
          >
            <Plus className="size-4" />
            Manage All Workshops
          </a>
        </div>

        {tagGroups.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tagGroups.map((group) => (
              <a
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-md hover:shadow-indigo-100/50"
                href={`/workshop-tag/${encodeURIComponent(group.tag)}`}
                key={group.tag}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-sm font-black text-indigo-700">
                      <Tag className="size-3.5" />
                      {group.tag}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-700">
                      {group.count} {group.count === 1 ? "Workshop" : "Workshops"}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {group.paidCount > 0 ? `${group.paidCount} Paid` : ""}
                    {group.paidCount > 0 && group.freeCount > 0 ? " · " : ""}
                    {group.freeCount > 0 ? `${group.freeCount} Free` : ""}
                  </p>

                  <div className="mt-3 space-y-1">
                    {group.workshops.slice(0, 3).map((w) => (
                      <p className="truncate text-xs font-bold text-slate-800" key={w.id || w.name}>
                        • {w.name}
                      </p>
                    ))}
                    {group.workshops.length > 3 ? (
                      <p className="text-[11px] font-semibold text-slate-400">
                        +{group.workshops.length - 3} more
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-indigo-600 transition group-hover:text-indigo-700">
                  <span>Open {group.tag} workshops</span>
                  <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <Tag className="mx-auto size-8 text-slate-300" />
            <h4 className="mt-2 text-sm font-bold text-slate-800">No workshop tags assigned yet</h4>
            <p className="mt-1 text-xs text-slate-500">
              Assign tags (such as LP, BJS) when creating or editing workshops in Workshop Master to organize them here.
            </p>
            <a
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50 transition"
              href="/workshop-master"
            >
              Go to Workshop Master
            </a>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-950">Quick Actions</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Fast paths into the workflows used most often by an admin team.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {[
            { href: "/lead-management", icon: Target, label: "Manage Leads", helper: "Pipeline and follow-ups" },
            { href: "/workshop-master", icon: CalendarDays, label: "Create Workshop", helper: "Master and form fields" },
            { href: "/manage-client", icon: UserPlus, label: "Add Client", helper: "Import or create records" },
            { href: "/workshop-scheduling-admin", icon: ClipboardCheck, label: "Schedule Event", helper: "Pricing, batch, CRM" },
            { href: "/process/manual-client-registration", icon: UsersRound, label: "Register Client", helper: "Offline enrollment" },
            { href: "/reports/daily-report", icon: FileSpreadsheet, label: "Open Reports", helper: "Filter and export" }
          ].map((action) => {
            const Icon = action.icon;
            return (
              <a
                className="group rounded-xl border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/60"
                href={action.href}
                key={action.label}
              >
                <span className="grid size-10 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200 transition group-hover:ring-emerald-200">
                  <Icon className="size-5" />
                </span>
                <p className="mt-4 font-black text-slate-950">{action.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{action.helper}</p>
              </a>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-950">Event Registration Status</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Real registrations from manual/public registration flows.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={exportDashboard}
            type="button"
          >
            <Download className="size-4" />
            Download CSV
          </button>
        </div>
        {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Event Name", "Batch", "Latest Registrant", "Total Registrations", "New Registrations"].map((head) => (
                  <th className="px-4 py-3" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventRows.length ? eventRows.map((row) => (
                <tr className="hover:bg-emerald-50/40 [contain-intrinsic-size:auto_56px] [content-visibility:auto]" key={row.name}>
                  <td className="px-4 py-4 font-black text-slate-950">{row.name}</td>
                  <td className="px-4 py-4 text-slate-700">{row.dateRange}</td>
                  <td className="px-4 py-4 text-slate-700">{row.latest}</td>
                  <td className="px-4 py-4 font-bold text-slate-900">{row.registrations}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{row.newCount}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={5}>
                    No event data yet. Create a workshop, schedule it, then register clients to populate this table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPlatformShell>
  );
}
