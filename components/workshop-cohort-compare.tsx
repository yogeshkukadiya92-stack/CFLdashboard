"use client";

import { BarChart3, BrainCircuit, Download, RefreshCw, Search, X } from "lucide-react";
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
    setSourceSessionId((current) => current || nextSessions[0]?.id || "");
  }

  useEffect(() => {
    loadAttendanceFromStorage();
    void hydrateLiveState().then(loadAttendanceFromStorage);
  }, []);

  useEffect(() => {
    if (targetWorkshopId || workshops.length === 0) return;
    const source = sessions.find((session) => session.id === sourceSessionId);
    const preferred = workshops.find((workshop) => workshop.id !== source?.workshopId && !workshop.archived);
    setTargetWorkshopId(preferred?.id ?? workshops[0]?.id ?? "");
  }, [sessions, sourceSessionId, targetWorkshopId, workshops]);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Cohort Intelligence</p>
          <h4 className="mt-1 text-xl font-black text-slate-950">Intro attendance to main registration</h4>
          <p className="mt-1 text-sm text-slate-500">Compare people by exact mobile number and find who has not registered yet.</p>
        </div>
        <div className="flex gap-2">
          <button aria-label="Refresh comparison data" className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled={refreshing} onClick={refreshData} title="Refresh comparison data" type="button">
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={!comparison.rows.length} onClick={exportComparison} type="button">
            <Download className="size-4" />
            Export
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-black uppercase text-slate-500">
          Intro attendance session
          <select className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case text-slate-800 outline-none focus:border-indigo-500" onChange={(event) => setSourceSessionId(event.target.value)} value={sourceSessionId}>
            <option value="">Select attendance session</option>
            {sessions.map((session) => <option key={session.id} value={session.id}>{session.title || session.workshopName} - {session.sessionDate}</option>)}
          </select>
        </label>
        <label className="text-xs font-black uppercase text-slate-500">
          Main registration workshop
          <select className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case text-slate-800 outline-none focus:border-indigo-500" onChange={(event) => setTargetWorkshopId(event.target.value)} value={targetWorkshopId}>
            <option value="">Select main workshop</option>
            {workshops.map((workshop) => <option key={workshop.id} value={workshop.id}>{workshop.name}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <CompareStat label="Intro attendees" value={comparison.rows.length} />
        <CompareStat label="Converted" value={comparison.converted} tone="success" />
        <CompareStat label="Not registered" value={comparison.notRegistered} tone="warning" />
        <CompareStat label="Conversion" suffix="%" value={comparison.conversionRate} />
        <CompareStat label="All main registrations" value={comparison.targetRegistrations} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-200 p-1">
          {([
            ["all", "All"],
            ["converted", "Registered"],
            ["not_registered", "Not registered"]
          ] as const).map(([value, label]) => (
            <button className={`rounded-lg px-3 py-2 text-xs font-black ${status === value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`} key={value} onClick={() => setStatus(value)} type="button">{label}</button>
          ))}
        </div>
        <label className="relative block min-w-[260px] flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input aria-label="Search comparison by name or mobile" className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-10 pr-10 text-sm outline-none focus:border-indigo-500" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or mobile" type="search" value={query} />
          {query ? <button aria-label="Clear comparison search" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => setQuery("")} type="button"><X className="size-4" /></button> : null}
        </label>
      </div>

      <div className="mt-3 max-h-[440px] overflow-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Person", "Mobile", "Intro attendance", "Main registration", "Status"].map((heading) => <th className="px-4 py-3" key={heading}>{heading}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <tr className="hover:bg-slate-50" key={row.mobileKey}>
                <td className="px-4 py-3 font-black text-slate-950">{row.attendance.attendeeName}</td>
                <td className="px-4 py-3">{row.attendance.mobile}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(row.attendance.submittedAt).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-slate-600">{row.registration ? new Date(row.registration.createdAt).toLocaleString("en-IN") : "-"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.registration ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.registration ? "Registered" : "Not registered"}</span></td>
              </tr>
            ))}
            {!visibleRows.length ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>{sourceSessionId && targetWorkshopId ? "No matching people in this view." : "Select an attendance session and main workshop to compare."}</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 pt-4">
        <div className="flex max-w-2xl gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><BrainCircuit className="size-5" /></div>
          <div>
            <p className="text-sm font-black text-slate-950">Private local AI insight</p>
            <p className="text-xs leading-5 text-slate-500">Uses configured Ollama and sends aggregate counts only. Names and mobile numbers stay out of the AI prompt.</p>
            {insight ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{insight}</p> : null}
            {insightError ? <p className="mt-2 text-sm font-semibold text-rose-600">{insightError}</p> : null}
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50" disabled={!comparison.rows.length || generatingInsight} onClick={generateInsight} type="button">
          <BarChart3 className="size-4" />
          {generatingInsight ? "Analyzing..." : "Generate insight"}
        </button>
      </div>
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
