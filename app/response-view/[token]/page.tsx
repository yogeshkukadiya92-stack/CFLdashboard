"use client";

import { DuplicateResponseFilter } from "@/components/duplicate-response-filter";
import { AdvancedResponseFilters } from "@/components/advanced-response-filters";
import { hideDuplicateResponses } from "@/lib/response-dedupe";
import { applyResponseFilters, emptyResponseFilters, responseQuestionOptions, type ResponseFilterState } from "@/lib/response-filters";

import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LogOut,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ViewerGrant = {
  recipientName: string;
  permissions: { exportCsv: boolean; revealContact: boolean; viewAnswers: boolean };
  expiresAt?: string;
  workshopIds: string[];
  workshopNames: string[];
};

type ViewerWorkshop = { id: string; name: string; count: number };

type ViewerRegistration = {
  id: string;
  workshopId: string;
  workshopTitle: string;
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  status: "Paid" | "Due";
  amountPaid: number;
  amountDue: number;
  whatsappVerificationStatus?: "verified" | "not_verified" | "not_required";
  source?: "registration_link" | "landing_page" | "manual";
  createdAt: string;
  batch?: string;
  answers?: Record<string, string>;
};

type ViewerData = {
  authorized: true;
  grant: ViewerGrant;
  workshops: ViewerWorkshop[];
  registrations: ViewerRegistration[];
};

const inputClass = "w-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export default function ResponseViewerPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const [data, setData] = useState<ViewerData | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [workshopId, setWorkshopId] = useState("all");
  const [selected, setSelected] = useState<ViewerRegistration | null>(null);
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [responseFilters, setResponseFilters] = useState<ResponseFilterState>({ ...emptyResponseFilters });

  useEffect(() => {
    if (!token) return;
    void loadViewer();
  }, [token]);

  async function loadViewer() {
    setInitializing(true);
    setError("");
    try {
      const response = await fetch(`/api/response-view/${encodeURIComponent(token)}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "This response link is not available.");
      if (result.authorized) setData(result as ViewerData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This response link is not available.");
    } finally {
      setInitializing(false);
    }
  }

  async function unlock() {
    if (!accessCode.trim()) {
      setError("Enter the access code shared with you.");
      return;
    }
    setUnlocking(true);
    setError("");
    try {
      const response = await fetch(`/api/response-view/${encodeURIComponent(token)}`, {
        body: JSON.stringify({ accessCode }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not unlock this response link.");
      setData(result as ViewerData);
      setAccessCode("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not unlock this response link.");
    } finally {
      setUnlocking(false);
    }
  }

  async function logout() {
    await fetch(`/api/response-view/${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => undefined);
    setData(null);
    setSelected(null);
    setSearch("");
    setWorkshopId("all");
  }

  const matchingResponses = useMemo(() => {
    if (!data) return [];
    const value = search.trim().toLowerCase();
    return data.registrations.filter((entry) => {
      const inWorkshop = workshopId === "all" || entry.workshopId === workshopId || entry.workshopTitle === data.workshops.find((item) => item.id === workshopId)?.name;
      const inSearch = !value || [entry.fullName, entry.mobile, entry.email, entry.city, entry.workshopTitle, entry.batch ?? ""].some((item) => item.toLowerCase().includes(value));
      return inWorkshop && inSearch;
    });
  }, [data, search, workshopId]);
  const filterRecords = useMemo(() => matchingResponses.map((entry) => ({ ...entry, answers: { "Full Name": entry.fullName, Mobile: entry.mobile, Email: entry.email, City: entry.city, "Payment Status": entry.status, Source: entry.source ?? "Registration Link", ...(entry.answers ?? {}) }, submittedAt: entry.createdAt })), [matchingResponses]);
  const advancedFiltered = useMemo(() => applyResponseFilters(filterRecords, responseFilters), [filterRecords, responseFilters]);
  const filtered = useMemo(() => hideDuplicates ? hideDuplicateResponses(advancedFiltered, {
      email: (entry) => entry.email,
      mobile: (entry) => entry.mobile,
      name: (entry) => entry.fullName,
      scope: (entry) => entry.workshopId || entry.workshopTitle,
      submittedAt: (entry) => entry.createdAt
    }) : advancedFiltered, [advancedFiltered, hideDuplicates]);
  const responseQuestions = useMemo(() => responseQuestionOptions(filterRecords), [filterRecords]);

  if (initializing) return <ViewerState title="Opening secure responses" description="Checking your access..." />;

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 sm:grid sm:place-items-center sm:py-16">
        <section className="mx-auto w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          <div className="h-1.5 bg-emerald-600" />
          <div className="p-6 sm:p-8">
            <img alt="Coach For Life" className="mx-auto h-20 w-auto max-w-[220px] object-contain" src="/brand/coach-for-life-logo-stacked.png" />
            <div className="mt-7 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck className="size-6" /></span>
              <p className="mt-5 text-xs font-black uppercase tracking-widest text-emerald-700">Private response access</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">Workshop Responses</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-500">Enter the access code provided by Coach For Life to open this read-only report.</p>
            </div>
            {error ? <p className="mt-5 border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
            <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
              <label className="block text-sm font-black text-slate-700" htmlFor="access-code">Access code</label>
              <div className="relative mt-2">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input autoComplete="one-time-code" autoFocus className={`${inputClass} pl-10 pr-11`} id="access-code" maxLength={32} onChange={(event) => { setAccessCode(event.target.value); setError(""); }} placeholder="Enter access code" type={showCode ? "text" : "password"} value={accessCode} />
                <button aria-label={showCode ? "Hide access code" : "Show access code"} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-slate-500" onClick={() => setShowCode((value) => !value)} type="button">{showCode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
              <button className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-emerald-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60" disabled={unlocking} type="submit">{unlocking ? "Verifying..." : "Open Responses"}<ArrowRight className="size-4" /></button>
            </form>
            <p className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-slate-400"><ShieldCheck className="size-3.5" />Secure read-only access</p>
          </div>
        </section>
      </main>
    );
  }

  const verified = data.registrations.filter((entry) => entry.whatsappVerificationStatus === "verified").length;
  const due = data.registrations.filter((entry) => entry.status === "Due").length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4"><img alt="Coach For Life" className="h-11 w-auto max-w-[180px] object-contain" src="/brand/coach-for-life-logo-horizontal.png" /><div className="hidden h-8 w-px bg-slate-200 sm:block" /><div className="hidden min-w-0 sm:block"><p className="truncate text-sm font-black">Workshop Responses</p><p className="truncate text-xs font-semibold text-slate-500">Shared with {data.grant.recipientName}</p></div></div>
          <button aria-label="Sign out of response viewer" className="inline-flex items-center gap-2 border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50" onClick={() => void logout()} type="button"><LogOut className="size-4" /><span className="hidden sm:inline">Sign Out</span></button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Read-only report</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Registration Responses</h1><p className="mt-2 text-sm font-semibold text-slate-500">Live responses from {data.workshops.length} workshop{data.workshops.length === 1 ? "" : "s"}.</p></div>
          {data.grant.expiresAt ? <p className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><Clock3 className="size-4 text-amber-600" />Access expires {formatDateTime(data.grant.expiresAt)}</p> : null}
        </div>

        <section className="mt-6 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-3">
          <Stat icon={Users} label="Total responses" value={data.registrations.length} />
          <Stat icon={CheckCircle2} label="WhatsApp verified" value={verified} />
          <Stat icon={Clock3} label="Payment due" value={due} />
        </section>

        <section className="mt-6 border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                <FilterButton active={workshopId === "all"} count={data.registrations.length} label="All" onClick={() => setWorkshopId("all")} />
                {data.workshops.map((workshop) => <FilterButton active={workshopId === workshop.id} count={workshop.count} key={workshop.id} label={workshop.name} onClick={() => setWorkshopId(workshop.id)} />)}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <AdvancedResponseFilters filters={responseFilters} onChange={setResponseFilters} questions={responseQuestions} resultCount={filtered.length} totalCount={matchingResponses.length} />
                <DuplicateResponseFilter checked={hideDuplicates} onChange={setHideDuplicates} rawCount={advancedFiltered.length} visibleCount={filtered.length} />
                <label className="relative min-w-0 sm:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} py-2.5 pl-9`} onChange={(event) => setSearch(event.target.value)} placeholder="Search responses..." value={search} /></label>
                {data.grant.permissions.exportCsv ? <button className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={() => downloadCsv(filtered)} type="button"><Download className="size-4" />Export CSV</button> : null}
              </div>
            </div>
            <p className="mt-4 text-xs font-bold text-slate-500">Showing {filtered.length} of {data.registrations.length} responses{data.grant.permissions.revealContact ? "" : " · Contact details are protected"}</p>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-500"><tr>{["Participant", "Contact", "Workshop", "WhatsApp", "Payment", "Source", "Submitted", ""].map((heading) => <th className="px-5 py-3" key={heading}>{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{filtered.map((entry) => <ResponseRow canViewAnswers={data.grant.permissions.viewAnswers} entry={entry} key={entry.id} onSelect={setSelected} />)}{!filtered.length ? <tr><td className="px-5 py-16 text-center font-bold text-slate-500" colSpan={8}>No responses match your filters.</td></tr> : null}</tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-200 lg:hidden">
            {filtered.map((entry) => <MobileResponse canViewAnswers={data.grant.permissions.viewAnswers} entry={entry} key={entry.id} onSelect={setSelected} />)}
            {!filtered.length ? <p className="px-5 py-16 text-center text-sm font-bold text-slate-500">No responses match your filters.</p> : null}
          </div>
        </section>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-400"><ShieldCheck className="size-3.5" />Private view provided by Coach For Life</p>
      </div>

      {selected ? <AnswerDialog entry={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function ViewerState({ description, title }: { description: string; title: string }) {
  return <main className="grid min-h-screen place-items-center bg-slate-100 px-4"><div className="text-center"><img alt="Coach For Life" className="mx-auto h-20 w-auto max-w-[220px] object-contain" src="/brand/coach-for-life-logo-stacked.png" /><div className="mx-auto mt-7 size-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" /><h1 className="mt-5 text-xl font-black">{title}</h1><p className="mt-2 text-sm font-semibold text-slate-500">{description}</p></div></main>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <div className="flex items-center gap-4 bg-white px-5 py-5"><span className="grid size-11 place-items-center bg-emerald-50 text-emerald-700"><Icon className="size-5" /></span><div><p className="text-2xl font-black">{value}</p><p className="mt-0.5 text-xs font-bold text-slate-500">{label}</p></div></div>;
}

function FilterButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return <button className={`shrink-0 border px-3.5 py-2 text-xs font-black ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} onClick={onClick} type="button">{label} <span className={active ? "text-emerald-300" : "text-slate-400"}>{count}</span></button>;
}

function ResponseRow({ canViewAnswers, entry, onSelect }: { canViewAnswers: boolean; entry: ViewerRegistration; onSelect: (entry: ViewerRegistration) => void }) {
  const hasAnswers = Boolean(entry.answers && Object.keys(entry.answers).length);
  return <tr className="hover:bg-emerald-50/30"><td className="px-5 py-4"><p className="font-black text-slate-950">{entry.fullName || "Unnamed"}</p><p className="mt-1 text-xs font-semibold text-slate-500">{entry.city || "City not added"}</p></td><td className="px-5 py-4"><p className="font-bold text-slate-700">{entry.mobile || "-"}</p><p className="mt-1 text-xs text-slate-500">{entry.email || "-"}</p></td><td className="px-5 py-4"><p className="max-w-[220px] font-bold text-slate-700">{entry.workshopTitle}</p>{entry.batch ? <p className="mt-1 text-xs text-slate-500">{entry.batch}</p> : null}</td><td className="px-5 py-4"><WhatsAppBadge value={entry.whatsappVerificationStatus} /></td><td className="px-5 py-4"><PaymentBadge status={entry.status} /><p className="mt-1 text-xs font-semibold text-slate-500">INR {entry.amountPaid} paid · INR {entry.amountDue} due</p></td><td className="px-5 py-4"><span className="text-xs font-bold text-slate-600">{sourceLabel(entry.source)}</span></td><td className="whitespace-nowrap px-5 py-4 text-xs font-bold text-slate-600">{formatDateTime(entry.createdAt)}</td><td className="px-5 py-4">{canViewAnswers && hasAnswers ? <button aria-label={`View ${entry.fullName}'s answers`} className="grid size-9 place-items-center border border-slate-200 text-slate-600 hover:bg-slate-100" onClick={() => onSelect(entry)} title="View answers" type="button"><ChevronRight className="size-4" /></button> : null}</td></tr>;
}

function MobileResponse({ canViewAnswers, entry, onSelect }: { canViewAnswers: boolean; entry: ViewerRegistration; onSelect: (entry: ViewerRegistration) => void }) {
  const hasAnswers = Boolean(entry.answers && Object.keys(entry.answers).length);
  return <article className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">{entry.fullName || "Unnamed"}</h2><p className="mt-1 text-xs font-bold text-slate-500">{entry.workshopTitle}</p></div><WhatsAppBadge value={entry.whatsappVerificationStatus} /></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><MobileDetail label="Mobile" value={entry.mobile || "-"} /><MobileDetail label="City" value={entry.city || "-"} /><MobileDetail label="Payment" value={`${entry.status} · INR ${entry.amountDue} due`} /><MobileDetail label="Submitted" value={formatDateTime(entry.createdAt)} /></dl>{canViewAnswers && hasAnswers ? <button className="mt-4 inline-flex w-full items-center justify-between border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-700" onClick={() => onSelect(entry)} type="button"><span className="inline-flex items-center gap-2"><FileText className="size-4" />View detailed answers</span><ChevronRight className="size-4" /></button> : null}</article>;
}

function MobileDetail({ label, value }: { label: string; value: string }) { return <div><dt className="font-black uppercase text-slate-400">{label}</dt><dd className="mt-1 break-words font-bold text-slate-700">{value}</dd></div>; }

function WhatsAppBadge({ value }: { value?: ViewerRegistration["whatsappVerificationStatus"] }) {
  if (value === "verified") return <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700"><CheckCircle2 className="size-3" />Verified</span>;
  if (value === "not_required") return <span className="bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">Not required</span>;
  return <span className="bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">Not verified</span>;
}

function PaymentBadge({ status }: { status: ViewerRegistration["status"] }) { return <span className={`px-2.5 py-1 text-[11px] font-black ${status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{status}</span>; }

function AnswerDialog({ entry, onClose }: { entry: ViewerRegistration; onClose: () => void }) {
  const answers = Object.entries(entry.answers ?? {});
  return <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog"><section className="max-h-[90vh] w-full overflow-hidden bg-white shadow-2xl sm:max-w-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center bg-emerald-50 text-emerald-700"><UserRound className="size-5" /></span><div className="min-w-0"><h2 className="truncate text-lg font-black">{entry.fullName}</h2><p className="mt-1 truncate text-xs font-bold text-slate-500">{entry.workshopTitle}</p></div></div><button aria-label="Close answers" className="grid size-9 shrink-0 place-items-center border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="max-h-[70vh] overflow-y-auto p-5">{answers.length ? <dl className="divide-y divide-slate-200 border-y border-slate-200">{answers.map(([question, answer]) => <div className="py-4" key={question}><dt className="text-xs font-black uppercase leading-5 text-slate-500">{question}</dt><dd className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">{answer || "No answer"}</dd></div>)}</dl> : <p className="py-12 text-center text-sm font-bold text-slate-500">No custom answers are available.</p>}</div></section></div>;
}

function downloadCsv(rows: ViewerRegistration[]) {
  const answerHeaders = [...new Set(rows.flatMap((entry) => Object.keys(entry.answers ?? {})))];
  const headers = ["Participant", "Mobile", "Email", "City", "Workshop", "Batch", "WhatsApp", "Payment", "Paid", "Due", "Source", "Submitted", ...answerHeaders];
  const values = rows.map((entry) => [entry.fullName, entry.mobile, entry.email, entry.city, entry.workshopTitle, entry.batch ?? "", entry.whatsappVerificationStatus ?? "", entry.status, entry.amountPaid, entry.amountDue, sourceLabel(entry.source), entry.createdAt, ...answerHeaders.map((header) => entry.answers?.[header] ?? "")]);
  const csv = [headers, ...values].map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `workshop-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function sourceLabel(value?: ViewerRegistration["source"]) { return value === "landing_page" ? "Landing Page" : value === "manual" ? "Manual" : "Registration Link"; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
