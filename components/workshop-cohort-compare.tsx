"use client";

import { AlertCircle, BarChart3, BrainCircuit, ChevronDown, ChevronUp, Download, RefreshCw, Search, X } from "lucide-react";
import { hydrateLiveState, readLocalArray } from "@/lib/live-state";
import type { AttendanceEntry, AttendanceSession, RegistrationEntry } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type WorkshopOption = {
  archived?: boolean;
  id: string;
  name: string;
};

type CohortRow = {
  attendance: AttendanceEntry;
  mobileKey: string;
  registration?: RegistrationEntry;
};

const ATTENDANCE_ENTRIES_KEY = "cfl_attendance_entries_v1";
const ATTENDANCE_SESSIONS_KEY = "cfl_attendance_sessions_v1";

function mobileKey(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

export function WorkshopCohortCompare({
  registrations,
  workshops
}: {
  registrations: RegistrationEntry[];
  workshops: WorkshopOption[];
}) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [sourceSessionId, setSourceSessionId] = useState("");
  const [targetWorkshopId, setTargetWorkshopId] = useState("");
  const [status, setStatus] = useState<"all" | "converted" | "not_registered">("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [insight, setInsight] = useState("");
  const [insightError, setInsightError] = useState("");
  const [generatingInsight, setGeneratingInsight] = useState(false);

  function loadAttendanceFromStorage() {
    const nextSessions = readLocalArray<AttendanceSession>(ATTENDANCE_SESSIONS_KEY);
    setSessions(nextSessions);
    setEntries(readLocalArray<AttendanceEntry>(ATTENDANCE_ENTRIES_KEY));
  }

  useEffect(() => {
    loadAttendanceFromStorage();
    void hydrateLiveState().then(loadAttendanceFromStorage);
  }, []);

  const sourceSession = sessions.find((session) => session.id === sourceSessionId);
  const targetWorkshop = workshops.find((workshop) => workshop.id === targetWorkshopId);

  const comparison = useMemo(() => {
    const sourceByMobile = new Map<string, AttendanceEntry>();
    entries
      .filter((entry) => entry.sessionId === sourceSessionId)
      .forEach((entry) => {
        const key = mobileKey(entry.mobile);
        if (!key) return;
        const current = sourceByMobile.get(key);
        if (!current || new Date(entry.submittedAt).getTime() > new Date(current.submittedAt).getTime()) {
          sourceByMobile.set(key, entry);
        }
      });

    const targetByMobile = new Map<string, RegistrationEntry>();
    const targetName = targetWorkshop?.name.trim().toLowerCase();
    registrations
      .filter((entry) =>
        entry.workshopId === targetWorkshopId ||
        Boolean(targetName && entry.workshopTitle.trim().toLowerCase() === targetName)
      )
      .forEach((entry) => {
        const key = mobileKey(entry.mobile);
        if (!key) return;
        const current = targetByMobile.get(key);
        if (!current || new Date(entry.createdAt).getTime() > new Date(current.createdAt).getTime()) {
          targetByMobile.set(key, entry);
        }
      });

    const rows: CohortRow[] = Array.from(sourceByMobile.entries()).map(([key, attendance]) => ({
      attendance,
      mobileKey: key,
      registration: targetByMobile.get(key)
    }));
    rows.sort((a, b) => Number(Boolean(a.registration)) - Number(Boolean(b.registration)) || a.attendance.attendeeName.localeCompare(b.attendance.attendeeName));

    const converted = rows.filter((row) => row.registration).length;
    return {
      converted,
      conversionRate: rows.length ? Math.round((converted / rows.length) * 1000) / 10 : 0,
      notRegistered: rows.length - converted,
      rows,
      targetRegistrations: targetByMobile.size
    };
  }, [entries, registrations, sourceSessionId, targetWorkshop, targetWorkshopId]);

  const visibleRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    const digits = value.replace(/\D/g, "");
    return comparison.rows.filter((row) => {
      if (status === "converted" && !row.registration) return false;
      if (status === "not_registered" && row.registration) return false;
      if (!value) return true;
      return row.attendance.attendeeName.toLowerCase().includes(value) || (digits && row.mobileKey.includes(digits));
    });
  }, [comparison.rows, query, status]);

  async function refreshData() {
    setRefreshing(true);
    await hydrateLiveState();
    loadAttendanceFromStorage();
    setHasCompared(false);
    setRefreshing(false);
  }

  function exportComparison() {
    const lines = [
      ["Name", "Mobile", "Intro session", "Main workshop", "Status", "Attendance submitted", "Registration submitted"],
      ...comparison.rows.map((row) => [
        row.attendance.attendeeName,
        row.attendance.mobile,
        sourceSession?.title ?? "",
        targetWorkshop?.name ?? "",
        row.registration ? "Registered" : "Not registered",
        row.attendance.submittedAt,
        row.registration?.createdAt ?? ""
      ])
    ];
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "workshop-cohort-comparison.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function generateInsight() {
    setGeneratingInsight(true);
    setInsight("");
    setInsightError("");
    try {
      const response = await fetch("/api/ai/cohort-insights", {
        body: JSON.stringify({
          converted: comparison.converted,
          conversionRate: comparison.conversionRate,
          notRegistered: comparison.notRegistered,
          sourceAttendees: comparison.rows.length,
          sourceName: sourceSession?.title || sourceSession?.workshopName || "Intro session",
          targetName: targetWorkshop?.name || "Main workshop",
          targetRegistrations: comparison.targetRegistrations
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json() as { error?: string; insight?: string };
      if (!response.ok || !result.insight) throw new Error(result.error || "Local AI insight could not be generated.");
      setInsight(result.insight);
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "Local AI insight could not be generated.");
    } finally {
      setGeneratingInsight(false);
    }
  }

  return (
    <section className="mt-5 border-t border-slate-200 pt-5">
      <button className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100" onClick={() => setOpen((value) => !value)} type="button">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700"><BarChart3 className="size-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-slate-950">Compare attendance with registrations</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">See who attended the intro session and who registered for the main workshop.</span>
          </span>
        </span>
        {open ? <ChevronUp className="size-5 shrink-0 text-slate-500" /> : <ChevronDown className="size-5 shrink-0 text-slate-500" />}
      </button>

      {open ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-black text-slate-950">Attendance conversion report</h4>
              <p className="mt-1 text-sm text-slate-500">Select both lists below. Matching is done using the participant&apos;s mobile number.</p>
            </div>
            <button aria-label="Refresh comparison data" className="grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled={refreshing} onClick={refreshData} title="Refresh attendance data" type="button">
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="block text-sm font-black text-slate-700">
              <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-slate-950 text-xs text-white">1</span>
              Intro attendance session
              <select className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500" onChange={(event) => { setSourceSessionId(event.target.value); setHasCompared(false); }} value={sourceSessionId}>
                <option value="">Choose attendance session</option>
                {sessions.map((session) => <option key={session.id} value={session.id}>{session.title || session.workshopName} · {session.sessionDate}</option>)}
              </select>
              <span className="mt-1.5 block text-xs font-semibold text-slate-500">People who actually attended.</span>
            </label>
            <label className="block text-sm font-black text-slate-700">
              <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-slate-950 text-xs text-white">2</span>
              Main registration workshop
              <select className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500" onChange={(event) => { setTargetWorkshopId(event.target.value); setHasCompared(false); }} value={targetWorkshopId}>
                <option value="">Choose main workshop</option>
                {workshops.filter((workshop) => !workshop.archived).map((workshop) => <option key={workshop.id} value={workshop.id}>{workshop.name}</option>)}
              </select>
              <span className="mt-1.5 block text-xs font-semibold text-slate-500">Workshop registrations to check against.</span>
            </label>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={!sourceSessionId || !targetWorkshopId} onClick={() => { setHasCompared(true); setStatus("all"); setQuery(""); setInsight(""); setInsightError(""); }} type="button">
              <BarChart3 className="size-4" />
              <span><span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-white/20 text-xs">3</span>Compare</span>
            </button>
          </div>

          {!hasCompared ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-black text-slate-700">Choose the two lists, then click Compare.</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Results will appear here only after comparison.</p>
            </div>
          ) : comparison.rows.length === 0 ? (
            <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-black text-amber-900">No attendance responses found for this session.</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">Select the intro session that contains participant responses, or use the refresh button after attendance has been submitted.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <CompareStat label="Attended intro" value={comparison.rows.length} />
                <CompareStat label="Registered for main" value={comparison.converted} tone="success" />
                <CompareStat label="Follow-up needed" value={comparison.notRegistered} tone="warning" />
                <CompareStat label="Conversion rate" suffix="%" value={comparison.conversionRate} />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex rounded-lg border border-slate-200 p-1">
                  {([
                    ["all", "All attendees"],
                    ["converted", "Registered"],
                    ["not_registered", "Follow-up needed"]
                  ] as const).map(([value, label]) => (
                    <button className={`rounded-md px-3 py-2 text-xs font-black ${status === value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`} key={value} onClick={() => setStatus(value)} type="button">{label}</button>
                  ))}
                </div>
                <div className="flex flex-1 justify-end gap-2">
                  <label className="relative block min-w-[240px] max-w-md flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input aria-label="Search comparison by name or mobile" className="min-h-10 w-full rounded-lg border border-slate-200 py-2 pl-10 pr-10 text-sm outline-none focus:border-indigo-500" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or mobile" type="search" value={query} />
                    {query ? <button aria-label="Clear comparison search" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100" onClick={() => setQuery("")} type="button"><X className="size-4" /></button> : null}
                  </label>
                  <button aria-label="Export comparison" className="grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={exportComparison} title="Export comparison" type="button"><Download className="size-4" /></button>
                </div>
              </div>

              <div className="mt-3 max-h-[440px] overflow-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>{["Person", "Mobile", "Intro attendance", "Main registration", "Result"].map((heading) => <th className="px-4 py-3" key={heading}>{heading}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((row) => (
                      <tr className="hover:bg-slate-50" key={row.mobileKey}>
                        <td className="px-4 py-3 font-black text-slate-950">{row.attendance.attendeeName}</td>
                        <td className="px-4 py-3">{row.attendance.mobile}</td>
                        <td className="px-4 py-3 text-slate-600">{new Date(row.attendance.submittedAt).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-slate-600">{row.registration ? new Date(row.registration.createdAt).toLocaleString("en-IN") : "-"}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.registration ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.registration ? "Registered" : "Follow up"}</span></td>
                      </tr>
                    ))}
                    {!visibleRows.length ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No people match this filter.</td></tr> : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 pt-4">
                <div className="flex max-w-2xl gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700"><BrainCircuit className="size-4" /></div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Optional local AI summary</p>
                    <p className="text-xs leading-5 text-slate-500">Creates a short action summary from counts only. No names or mobile numbers are sent.</p>
                    {insight ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{insight}</p> : null}
                    {insightError ? <p className="mt-2 text-sm font-semibold text-rose-600">{insightError}</p> : null}
                  </div>
                </div>
                <button className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50" disabled={generatingInsight} onClick={generateInsight} type="button">
                  <BrainCircuit className="size-4" />
                  {generatingInsight ? "Analyzing..." : "Generate summary"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function CompareStat({ label, suffix = "", tone = "default", value }: { label: string; suffix?: string; tone?: "default" | "success" | "warning"; value: number }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-indigo-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className={`text-xl font-black ${color}`}>{value}{suffix}</p>
      <p className="mt-0.5 text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}
