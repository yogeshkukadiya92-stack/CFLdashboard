"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  Layers3,
  RefreshCw,
  RotateCcw,
  Search,
  UsersRound,
  XCircle
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

type Summary = {
  clients: number;
  duplicate_rows: number;
  facilitators: number;
  failed: number;
  import_rows: number;
  refunds: number;
  registrations: number;
  success: number;
  workshop_batches: number;
  workshop_masters: number;
};

type Workshop = {
  batch_count: number;
  facilitators: string[];
  id: string;
  name: string;
  registration_count: number;
};

type Facilitator = {
  id: string;
  name: string;
  registration_count: number;
  workshop_count: number;
};

type Registration = {
  batch: string;
  city: string;
  client_id: string;
  client_name: string;
  email: string;
  facilitator: string;
  id: string;
  mobile: string;
  registered_at: string;
  source_status_code: string | null;
  status: string;
  workshop: string;
};

type Tab = "workshops" | "facilitators" | "registrations";

export default function HistoricalDataPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [facilitators, setFacilitators] = useState<Facilitator[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("workshops");
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [registrationSearch, setRegistrationSearch] = useState("");
  const deferredRegistrationSearch = useDeferredValue(registrationSearch);
  const [registrationStatus, setRegistrationStatus] = useState("All");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationCursor, setRegistrationCursor] = useState<string | null>(null);
  const [nextRegistrationCursor, setNextRegistrationCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadOverview() {
      setLoadingOverview(true);
      setError("");
      try {
        const [summaryResponse, workshopResponse] = await Promise.all([
          fetch("/api/crm/summary", { cache: "no-store", signal: controller.signal }),
          fetch("/api/crm/workshops", { cache: "no-store", signal: controller.signal })
        ]);
        const [summaryData, workshopData] = await Promise.all([
          summaryResponse.json(),
          workshopResponse.json()
        ]);
        if (!summaryResponse.ok || !workshopResponse.ok) {
          throw new Error(summaryData.error || workshopData.error || "Failed to load historical data.");
        }
        if (!summaryData.dbEnabled || !workshopData.dbEnabled) {
          throw new Error("Database is not configured for historical data.");
        }
        setSummary(summaryData.summary);
        setWorkshops(workshopData.workshops ?? []);
        setFacilitators(workshopData.facilitators ?? []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(loadError instanceof Error ? loadError.message : "Failed to load historical data.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingOverview(false);
      }
    }
    void loadOverview();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (activeTab !== "registrations") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingRegistrations(true);
      setError("");
      const params = new URLSearchParams({ limit: "50" });
      if (selectedWorkshop) params.set("workshopId", selectedWorkshop.id);
      if (registrationCursor) params.set("cursor", registrationCursor);
      if (deferredRegistrationSearch.trim()) params.set("query", deferredRegistrationSearch.trim());
      if (registrationStatus !== "All") params.set("status", registrationStatus);
      try {
        const response = await fetch(`/api/crm/registrations?${params}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load registrations.");
        setRegistrations(data.registrations ?? []);
        setNextRegistrationCursor(data.nextCursor ?? null);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(loadError instanceof Error ? loadError.message : "Failed to load registrations.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingRegistrations(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeTab, deferredRegistrationSearch, registrationCursor, registrationStatus, selectedWorkshop]);

  const filteredWorkshops = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return workshops;
    return workshops.filter((workshop) =>
      `${workshop.name} ${workshop.facilitators.join(" ")}`.toLowerCase().includes(query)
    );
  }, [deferredSearch, workshops]);

  const filteredFacilitators = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return facilitators;
    return facilitators.filter((facilitator) => facilitator.name.toLowerCase().includes(query));
  }, [deferredSearch, facilitators]);

  function openWorkshop(workshop: Workshop) {
    setSelectedWorkshop(workshop);
    setRegistrationCursor(null);
    setCursorHistory([]);
    setRegistrationSearch("");
    setRegistrationStatus("All");
    setActiveTab("registrations");
  }

  function nextPage() {
    if (!nextRegistrationCursor) return;
    setCursorHistory((current) => [...current, registrationCursor]);
    setRegistrationCursor(nextRegistrationCursor);
  }

  function previousPage() {
    if (!cursorHistory.length) return;
    const previous = cursorHistory[cursorHistory.length - 1] ?? null;
    setCursorHistory((current) => current.slice(0, -1));
    setRegistrationCursor(previous);
  }

  function resetRegistrationFilters() {
    setRegistrationSearch("");
    setRegistrationStatus("All");
    setRegistrationCursor(null);
    setCursorHistory([]);
  }

  return (
    <AdminPlatformShell
      activeLabel="Historical Data"
      description="Search imported clients, workshop batches, facilitators and original registration history."
      title="Historical Data"
    >
      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")} type="button"><XCircle className="size-5" /></button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={UsersRound} label="Unique Clients" loading={loadingOverview} value={summary?.clients} />
        <Metric icon={Database} label="Source Rows" loading={loadingOverview} value={summary?.import_rows} />
        <Metric icon={Layers3} label="Workshop Masters" loading={loadingOverview} value={summary?.workshop_masters} />
        <Metric icon={Archive} label="Historical Batches" loading={loadingOverview} value={summary?.workshop_batches} />
        <Metric icon={RotateCcw} label="Exact Duplicates" loading={loadingOverview} value={summary?.duplicate_rows} />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatusMetric icon={CheckCircle2} label="Success" tone="emerald" value={summary?.success ?? 0} />
        <StatusMetric icon={XCircle} label="Failed" tone="rose" value={summary?.failed ?? 0} />
        <StatusMetric icon={RefreshCw} label="Refund" tone="amber" value={summary?.refunds ?? 0} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full overflow-x-auto rounded-lg border border-slate-200 p-1 lg:w-auto">
            <TabButton active={activeTab === "workshops"} label={`Workshops (${formatNumber(workshops.length)})`} onClick={() => setActiveTab("workshops")} />
            <TabButton active={activeTab === "facilitators"} label={`Facilitators (${formatNumber(facilitators.length)})`} onClick={() => setActiveTab("facilitators")} />
            <TabButton active={activeTab === "registrations"} label="Registrations" onClick={() => setActiveTab("registrations")} />
          </div>
          {activeTab !== "registrations" ? (
            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or facilitator" value={search} />
            </label>
          ) : null}
        </div>

        {activeTab === "workshops" ? <WorkshopTable loading={loadingOverview} onView={openWorkshop} workshops={filteredWorkshops} /> : null}
        {activeTab === "facilitators" ? <FacilitatorTable facilitators={filteredFacilitators} loading={loadingOverview} /> : null}
        {activeTab === "registrations" ? (
          <div>
            <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_220px_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  onChange={(event) => { setRegistrationSearch(event.target.value); setRegistrationCursor(null); setCursorHistory([]); }}
                  placeholder="Search client or mobile"
                  value={registrationSearch}
                />
              </label>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                onChange={(event) => { setRegistrationStatus(event.target.value); setRegistrationCursor(null); setCursorHistory([]); }}
                value={registrationStatus}
              >
                <option value="All">All statuses</option><option value="Success">Success</option><option value="Failed">Failed</option><option value="Refund">Refund</option><option value="Paid">Paid</option><option value="Due">Due</option>
              </select>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={resetRegistrationFilters} type="button"><RotateCcw className="size-4" />Reset</button>
            </div>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{selectedWorkshop ? `Workshop: ${selectedWorkshop.name}` : "All historical registrations"}</div>
            <RegistrationTable loading={loadingRegistrations} registrations={registrations} />
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-500">Showing up to 50 records per page</p>
              <div className="flex gap-2">
                <PageButton disabled={!cursorHistory.length || loadingRegistrations} onClick={previousPage}><ChevronLeft className="size-4" /> Previous</PageButton>
                <PageButton disabled={!nextRegistrationCursor || loadingRegistrations} onClick={nextPage}>Next <ChevronRight className="size-4" /></PageButton>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AdminPlatformShell>
  );
}

function Metric({ icon: Icon, label, loading, value }: { icon: typeof UsersRound; label: string; loading: boolean; value?: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="size-5 text-indigo-600" /><p className="mt-4 text-2xl font-black text-slate-950">{loading ? "..." : formatNumber(value ?? 0)}</p><p className="mt-1 text-xs font-bold uppercase text-slate-500">{label}</p></div>;
}

function StatusMetric({ icon: Icon, label, tone, value }: { icon: typeof CheckCircle2; label: string; tone: "amber" | "emerald" | "rose"; value: number }) {
  const tones = { amber: "border-amber-200 bg-amber-50 text-amber-700", emerald: "border-emerald-200 bg-emerald-50 text-emerald-700", rose: "border-rose-200 bg-rose-50 text-rose-700" };
  return <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${tones[tone]}`}><div className="flex items-center gap-3"><Icon className="size-5" /><span className="text-sm font-black">{label}</span></div><span className="text-lg font-black">{formatNumber(value)}</span></div>;
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold ${active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={onClick} type="button">{label}</button>;
}

function WorkshopTable({ loading, onView, workshops }: { loading: boolean; onView: (workshop: Workshop) => void; workshops: Workshop[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Workshop</th><th className="px-4 py-3">Facilitator</th><th className="px-4 py-3 text-right">Batches</th><th className="px-4 py-3 text-right">Registrations</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <EmptyRow colSpan={5} label="Loading workshops..." /> : null}{!loading && !workshops.length ? <EmptyRow colSpan={5} label="No historical workshops found." /> : null}{!loading ? workshops.map((workshop) => <tr className="historical-row hover:bg-indigo-50/40" key={workshop.id}><td className="px-4 py-3"><button aria-label={`View ${workshop.name} registrations`} className="grid size-9 place-items-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => onView(workshop)} type="button"><Eye className="size-4" /></button></td><td className="px-4 py-3 font-bold text-slate-950">{workshop.name}</td><td className="px-4 py-3 text-slate-600">{workshop.facilitators.join(", ") || "-"}</td><td className="px-4 py-3 text-right font-bold">{formatNumber(workshop.batch_count)}</td><td className="px-4 py-3 text-right font-bold">{formatNumber(workshop.registration_count)}</td></tr>) : null}</tbody></table></div>;
}

function FacilitatorTable({ facilitators, loading }: { facilitators: Facilitator[]; loading: boolean }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Facilitator</th><th className="px-4 py-3 text-right">Workshop Masters</th><th className="px-4 py-3 text-right">Registrations</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <EmptyRow colSpan={3} label="Loading facilitators..." /> : null}{!loading && !facilitators.length ? <EmptyRow colSpan={3} label="No facilitators found." /> : null}{!loading ? facilitators.map((facilitator) => <tr className="historical-row hover:bg-emerald-50/40" key={facilitator.id}><td className="px-4 py-3 font-bold text-slate-950">{facilitator.name}</td><td className="px-4 py-3 text-right font-bold">{formatNumber(facilitator.workshop_count)}</td><td className="px-4 py-3 text-right font-bold">{formatNumber(facilitator.registration_count)}</td></tr>) : null}</tbody></table></div>;
}

function RegistrationTable({ loading, registrations }: { loading: boolean; registrations: Registration[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Workshop / Batch</th><th className="px-4 py-3">Facilitator</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <EmptyRow colSpan={7} label="Loading registrations..." /> : null}{!loading && !registrations.length ? <EmptyRow colSpan={7} label="No registrations match these filters." /> : null}{!loading ? registrations.map((registration) => <tr className="historical-row hover:bg-slate-50" key={registration.id}><td className="whitespace-nowrap px-4 py-3">{formatDate(registration.registered_at)}</td><td className="px-4 py-3"><p className="font-bold text-slate-950">{registration.client_name || "Unnamed Client"}</p><p className="text-xs text-slate-500">{registration.email || "No email"}</p></td><td className="whitespace-nowrap px-4 py-3">{registration.mobile}</td><td className="px-4 py-3">{registration.city || "-"}</td><td className="px-4 py-3"><p className="font-bold text-slate-900">{registration.workshop}</p><p className="text-xs text-slate-500">{registration.batch}</p></td><td className="px-4 py-3">{registration.facilitator}</td><td className="px-4 py-3"><StatusBadge code={registration.source_status_code} status={registration.status} /></td></tr>) : null}</tbody></table></div>;
}

function StatusBadge({ code, status }: { code: string | null; status: string }) {
  const tone = status === "Success" || status === "Paid" ? "bg-emerald-50 text-emerald-700" : status === "Refund" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>{status}{code ? ` (${code})` : ""}</span>;
}

function PageButton({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled} onClick={onClick} type="button">{children}</button>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td className="px-4 py-12 text-center font-semibold text-slate-500" colSpan={colSpan}>{label}</td></tr>;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
