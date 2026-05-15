import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { Download, Search } from "lucide-react";

const reports = [
  "daily-report",
  "workshop-url-status",
  "yearly-public-session",
  "yearly-workshop",
  "facilitators-performance",
  "workshop-summary",
  "batch-wise-workshop-summary",
  "client-milestone",
  "failed-payment",
  "part-payment",
  "workshop-wise-member",
  "member-attend-more-workshop",
  "member-details",
  "member-details-part-payment",
  "session-conversation",
  "client-batch-transfer",
  "sales-person-milestone",
  "sales-person-payment",
  "sales-person-lead-assign"
];

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

export function generateStaticParams() {
  return reports.map((slug) => ({ slug }));
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = titles.get(slug) ?? "Report";

  return (
    <AdminPlatformShell
      activeLabel={title}
      description="Search, filter and export report data from the same compact admin platform."
      title={title}
    >
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-5 md:p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Workshop</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
              <option>All Workshops</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Batch</span>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
              <option>All Batches</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">From</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" type="date" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">To</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" type="date" />
          </label>
          <button className="mt-auto rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700" type="button">
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 md:p-6">
          <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800" type="button">
            <Download className="size-4" />
            Export
          </button>
          <label className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" placeholder="Search report..." />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Sr. No", "Date", "Workshop Name", "Client", "Status", "Amount"].map((column) => (
                  <th className="px-4 py-4" key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-12 text-center text-slate-500" colSpan={6}>
                  No report data yet. Import clients/workshops to populate this report.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </AdminPlatformShell>
  );
}
