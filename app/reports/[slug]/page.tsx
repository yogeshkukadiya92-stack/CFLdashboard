"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { Download, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const titles = new Map<string, string>([
  ["daily-report", "Daily Report"],
  ["workshop-url-status", "WorkShop Url & Status"],
  ["yearly-public-session", "Yearly Public Session"],
  ["yearly-workshop", "Yearly Workshop"],
  ["facilitators-performance", "Facilitators Performance"],
  ["workshop-summary", "Workshop Summary"],
  ["batch-wise-workshop-summary", "Batch Wise Workshop summary"],
  ["client-milestone", "Client Milestone"],
  ["failed-payment", "Failed Payment"],
  ["part-payment", "Part Payment"],
  ["workshop-wise-member", "Workshop wise Member"],
  ["member-attend-more-workshop", "Member Attend More Workshop"],
  ["member-details", "Member Details"],
  ["member-details-part-payment", "Member Details (Part Payment)"],
  ["session-conversation", "Session Conversation"],
  ["client-batch-transfer", "Client Batch Transfer"],
  ["sales-person-milestone", "Sales Person Milestone"],
  ["sales-person-payment", "Sales Person Payment"],
  ["sales-person-lead-assign", "Sales Person Lead Assign"]
]);

type RegistrationEntry = {
  amountDue: number;
  amountPaid: number;
  city: string;
  createdAt: string;
  fullName: string;
  id: string;
  mobile: string;
  status: "Paid" | "Due";
  workshopTitle: string;
};

const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";

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

export default function ReportPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const title = titles.get(slug) ?? "Report";
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [workshop, setWorkshop] = useState("All Workshops");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      setRegistrations(JSON.parse(window.localStorage.getItem(REGISTRATION_STORAGE_KEY) || "[]") as RegistrationEntry[]);
    } catch {
      setRegistrations([]);
    }
  }, []);

  const workshopOptions = Array.from(new Set(registrations.map((entry) => entry.workshopTitle).filter(Boolean)));
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return registrations
      .filter((entry) => workshop === "All Workshops" || entry.workshopTitle === workshop)
      .filter((entry) => !fromDate || entry.createdAt >= fromDate)
      .filter((entry) => !toDate || entry.createdAt <= toDate)
      .filter((entry) => {
        if (!normalized) return true;
        return `${entry.fullName} ${entry.mobile} ${entry.city} ${entry.workshopTitle} ${entry.status}`.toLowerCase().includes(normalized);
      });
  }, [fromDate, query, registrations, toDate, workshop]);

  function exportRows() {
    downloadCsv(`${slug}.csv`, [
      ["Sr. No", "Date", "Workshop Name", "Client", "Status", "Amount"],
      ...rows.map((row, index) => [
        String(index + 1),
        row.createdAt,
        row.workshopTitle,
        row.fullName,
        row.status,
        String(row.amountPaid || row.amountDue)
      ])
    ]);
    setMessage(`Exported ${rows.length} rows.`);
  }

  return (
    <AdminPlatformShell
      activeLabel={title}
      description="Search, filter and export report data from the same compact admin platform."
      title={title}
    >
      <section className="rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-5 md:p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Workshop</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => setWorkshop(event.target.value)} value={workshop}>
              <option>All Workshops</option>
              {workshopOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Batch</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
              <option>All Batches</option>
              <option>Main Batch</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">From</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">To</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => setToDate(event.target.value)} type="date" value={toDate} />
          </label>
          <button className="mt-auto rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700" onClick={() => setMessage(`Found ${rows.length} rows.`)} type="button">
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 md:p-6">
          <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800" onClick={exportRows} type="button">
            <Download className="size-4" />
            Export
          </button>
          <label className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => setQuery(event.target.value)} placeholder="Search report..." value={query} />
          </label>
        </div>

        {message ? <p className="mx-4 mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 md:mx-6">{message}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Sr. No", "Date", "Workshop Name", "Client", "Status", "Amount"].map((column) => (
                  <th className="px-4 py-4" key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((row, index) => (
                <tr className="hover:bg-emerald-50/40" key={row.id}>
                  <td className="px-4 py-4">{index + 1}</td>
                  <td className="px-4 py-4">{row.createdAt}</td>
                  <td className="px-4 py-4 font-bold text-slate-950">{row.workshopTitle}</td>
                  <td className="px-4 py-4">{row.fullName}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${row.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-4">INR {(row.amountPaid || row.amountDue).toLocaleString("en-IN")}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500" colSpan={6}>
                    No report data yet. Register clients into workshops to populate this report.
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
