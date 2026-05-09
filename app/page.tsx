"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { CalendarDays, IndianRupee, TrendingUp, UsersRound } from "lucide-react";

const stats = [
  { icon: CalendarDays, label: "Total Workshops", value: "148", tone: "bg-indigo-50 text-indigo-700" },
  { icon: TrendingUp, label: "Upcoming Workshops", value: "22", tone: "bg-cyan-50 text-cyan-700" },
  { icon: UsersRound, label: "Total Members", value: "249,861", tone: "bg-rose-50 text-rose-700" },
  { icon: IndianRupee, label: "Revenue Collected", value: "₹1.28Cr", tone: "bg-emerald-50 text-emerald-700" }
];

const events = [
  ["Leadership Sprint", "1 Jun - 3 Jun", "Rohan Mehta", "320", "28"],
  ["Growth Accelerator", "12 Jun - 14 Jun", "Priya Nair", "240", "16"],
  ["Founder Strategy Session", "24 Jun", "Neha Kapoor", "88", "9"]
];

export default function DashboardPage() {
  return (
    <AdminPlatformShell
      activeLabel="Dashboard"
      description="One clean control center for workshops, clients, schedules, reports and growth."
      title="Business Dashboard"
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500">Paid Session</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-black tracking-tight text-slate-950">9,090</p>
              <p className="mt-2 text-sm font-semibold text-rose-600">96.24% less earnings than last month</p>
            </div>
            <div
              className="grid size-40 place-items-center rounded-full text-center"
              style={{ background: "conic-gradient(#10b981 0 82.51%, #06b6d4 82.51% 93.51%, #6366f1 93.51% 100%)" }}
            >
              <div className="grid size-28 place-items-center rounded-full bg-white shadow-inner">
                <span className="text-lg font-black text-slate-950">₹9.09K</span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {["Category 1 6.49%", "Category 2 11.00%", "Category 3 82.51%"].map((item, index) => (
              <div className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700" key={item}>
                <span className={`mr-2 inline-block size-2 rounded-full ${index === 0 ? "bg-indigo-500" : index === 1 ? "bg-cyan-500" : "bg-emerald-500"}`} />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xl font-black text-slate-950">Next Event</p>
          <div className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
            <span className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-black text-white">24 Jun</span>
            <h3 className="mt-5 text-2xl font-black text-slate-950">Growth Accelerator Bootcamp</h3>
            <p className="mt-2 text-sm text-slate-600">Location: Zoom</p>
            <a className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white" href="/workshop-scheduling-admin">
              Registration Link
            </a>
          </div>
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={stat.label}>
              <span className={`grid size-12 place-items-center rounded-2xl ${stat.tone}`}>
                <Icon className="size-5" />
              </span>
              <p className="mt-5 text-3xl font-black text-slate-950">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-black text-slate-950">Event Registration Status</h3>
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">
            Excel Download
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Event Name", "Date Range", "Latest Registrant", "Total Registrations", "New Registrations"].map((head) => (
                  <th className="px-4 py-3" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr className="hover:bg-indigo-50/40" key={event[0]}>
                  {event.map((cell) => <td className="px-4 py-4 font-semibold text-slate-700" key={cell}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPlatformShell>
  );
}
