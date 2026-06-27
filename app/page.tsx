"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { CalendarDays, ClipboardCheck, Download, FileSpreadsheet, IndianRupee, Plus, TrendingUp, UserPlus, UsersRound } from "lucide-react";
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
  facilitator: string;
  id: string;
  isPaid: boolean;
  name: string;
  productGroup: string;
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

const CLIENTS_STORAGE_KEY = "cfl_clients_v1";
const WORKSHOP_STORAGE_KEY = "cfl_workshop_master_records_v1";
const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const SCHEDULE_STORAGE_KEY = "cfl_event_schedules_v1";

function readArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

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
  const [message, setMessage] = useState("");

  useEffect(() => {
    function load() {
      setClients(readArray<ClientRow>(CLIENTS_STORAGE_KEY));
      setWorkshops(readArray<WorkshopRecord>(WORKSHOP_STORAGE_KEY));
      setRegistrations(readArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY));
      setSchedules(readArray<ScheduleRecord>(SCHEDULE_STORAGE_KEY));
    }

    load();
    window.addEventListener("storage", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  const revenue = registrations.reduce((sum, entry) => sum + entry.amountPaid, 0);
  const due = registrations.reduce((sum, entry) => sum + entry.amountDue, 0);
  const paidRegistrations = registrations.filter((entry) => entry.status === "Paid").length;
  const conversion = registrations.length ? Math.round((paidRegistrations / registrations.length) * 100) : 0;
  const nextEvent = schedules[0]?.selectedEvent || workshops[0]?.name || "";
  const nextFacilitator = schedules[0]?.facilitator || workshops[0]?.facilitator || "Not assigned";

  const eventRows = useMemo(() => {
    return workshops.map((workshop) => {
      const rows = registrations.filter((entry) => entry.workshopId === workshop.id || entry.workshopTitle === workshop.name);
      const latest = rows[0];
      return {
        dateRange: schedules.find((schedule) => schedule.selectedEvent === workshop.name)?.batch || "Main batch",
        latest: latest ? latest.fullName : "No registration",
        name: workshop.name,
        newCount: rows.filter((entry) => entry.createdAt >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).length,
        registrations: rows.length
      };
    });
  }, [registrations, schedules, workshops]);

  function exportDashboard() {
    downloadCsv("dashboard-registration-status.csv", [
      ["Event Name", "Date Range", "Latest Registrant", "Total Registrations", "New Registrations"],
      ...eventRows.map((row) => [row.name, row.dateRange, row.latest, String(row.registrations), String(row.newCount)])
    ]);
    setMessage(`Exported ${eventRows.length} event rows.`);
  }

  const stats = [
    { icon: CalendarDays, label: "Workshops", value: String(workshops.length), helper: "Created in Workshop Master", tone: "bg-emerald-50 text-emerald-700" },
    { icon: TrendingUp, label: "Scheduled", value: String(schedules.length), helper: "Configured schedules", tone: "bg-indigo-50 text-indigo-700" },
    { icon: UsersRound, label: "Clients", value: String(clients.length), helper: "Imported or added records", tone: "bg-rose-50 text-rose-700" },
    { icon: IndianRupee, label: "Collected", value: formatInr(revenue), helper: `${formatInr(due)} due`, tone: "bg-amber-50 text-amber-700" }
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
              <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{registrations.length}</p>
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
              ["Paid", paidRegistrations, "bg-emerald-500"],
              ["Due", registrations.length - paidRegistrations, "bg-amber-500"],
              ["Clients", clients.length, "bg-rose-500"]
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
              {nextEvent ? "Ready" : "Setup Needed"}
            </span>
            <h3 className="mt-5 text-2xl font-black text-slate-950">{nextEvent || "No upcoming event"}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-600">Facilitator: {nextFacilitator}</p>
            <a className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white" href="/workshop-master">
              {nextEvent ? "Manage Workshop" : "Create Workshop"}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-950">Quick Actions</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Fast paths into the workflows used most often by an admin team.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
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
            Excel Download
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
                <tr className="hover:bg-emerald-50/40" key={row.name}>
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
