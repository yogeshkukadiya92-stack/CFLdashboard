"use client";

import { BarChart3, Check, ChevronDown, ChevronUp, Download, MessageCircle, Search, UsersRound, X } from "lucide-react";
import type { AttendanceEntry, AttendanceSession, RegistrationEntry } from "@/lib/types";
import { useMemo, useState } from "react";

type WorkshopOption = {
  archived?: boolean;
  id: string;
  name: string;
};

type FormOption = {
  id: string;
  name: string;
  sourceId: string;
  type: "attendance" | "registration";
};

type OverlapRow = {
  email: string;
  mobile: string;
  mobileKey: string;
  name: string;
  workshopIds: string[];
  workshopNames: string[];
};

function normalizedMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

export function MultiWorkshopOverlap({
  registrations,
  attendanceEntries,
  attendanceSessions,
  workshops
}: {
  registrations: RegistrationEntry[];
  attendanceEntries: AttendanceEntry[];
  attendanceSessions: AttendanceSession[];
  workshops: WorkshopOption[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"all" | "repeat">("all");
  const [query, setQuery] = useState("");
  const [workshopQuery, setWorkshopQuery] = useState("");

  const availableWorkshops = useMemo<FormOption[]>(() => [
    ...workshops.map((workshop) => ({
      id: `registration:${workshop.id}`,
      name: workshop.name,
      sourceId: workshop.id,
      type: "registration" as const
    })),
    ...attendanceSessions.map((session) => ({
      id: `attendance:${session.id}`,
      name: session.title || `${session.workshopName} attendance`,
      sourceId: session.id,
      type: "attendance" as const
    }))
  ], [attendanceSessions, workshops]);
  const selectedWorkshops = useMemo(
    () => availableWorkshops.filter((workshop) => selectedIds.includes(workshop.id)),
    [availableWorkshops, selectedIds]
  );

  const rows = useMemo(() => {
    const people = new Map<string, {
      email: string;
      latestAt: number;
      mobile: string;
      name: string;
      workshopIds: Set<string>;
      workshopNames: Set<string>;
    }>();

    selectedWorkshops.forEach((workshop) => {
      const formEntries = workshop.type === "attendance"
        ? attendanceEntries
          .filter((entry) => entry.sessionId === workshop.sourceId)
          .map((entry) => ({
            createdAt: entry.submittedAt,
            email: entry.email || "",
            mobile: entry.mobile,
            name: entry.attendeeName
          }))
        : registrations
          .filter((entry) =>
            entry.workshopId === workshop.sourceId ||
            entry.workshopTitle.trim().toLowerCase() === workshop.name.trim().toLowerCase()
          )
          .map((entry) => ({
            createdAt: entry.createdAt,
            email: entry.email || "",
            mobile: entry.mobile,
            name: entry.fullName
          }));

      formEntries.forEach((entry) => {
          const key = normalizedMobile(entry.mobile);
          if (!key) return;
          const timestamp = Date.parse(entry.createdAt);
          const current = people.get(key);
          if (!current) {
            people.set(key, {
              email: entry.email || "",
              latestAt: Number.isNaN(timestamp) ? 0 : timestamp,
              mobile: entry.mobile,
              name: entry.name,
              workshopIds: new Set([workshop.id]),
              workshopNames: new Set([`${workshop.name} (${workshop.type === "attendance" ? "Attendance" : "Registration"})`])
            });
            return;
          }
          current.workshopIds.add(workshop.id);
          current.workshopNames.add(`${workshop.name} (${workshop.type === "attendance" ? "Attendance" : "Registration"})`);
          if (!Number.isNaN(timestamp) && timestamp > current.latestAt) {
            current.email = entry.email || current.email;
            current.latestAt = timestamp;
            current.mobile = entry.mobile;
            current.name = entry.name || current.name;
          }
        });
    });

    return Array.from(people.entries(), ([mobileKey, person]): OverlapRow => ({
      email: person.email,
      mobile: person.mobile,
      mobileKey,
      name: person.name,
      workshopIds: Array.from(person.workshopIds),
      workshopNames: Array.from(person.workshopNames)
    })).sort((a, b) => b.workshopIds.length - a.workshopIds.length || a.name.localeCompare(b.name));
  }, [attendanceEntries, registrations, selectedWorkshops]);

  const commonCount = rows.filter((row) => selectedIds.length >= 2 && row.workshopIds.length === selectedIds.length).length;
  const repeatCount = rows.filter((row) => row.workshopIds.length >= 2).length;
  const visibleRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    const digits = value.replace(/\D/g, "");
    return rows.filter((row) => {
      if (mode === "all" && row.workshopIds.length !== selectedIds.length) return false;
      if (mode === "repeat" && row.workshopIds.length < 2) return false;
      if (!value) return true;
      return row.name.toLowerCase().includes(value)
        || row.email.toLowerCase().includes(value)
        || Boolean(digits && row.mobileKey.includes(digits));
    });
  }, [mode, query, rows, selectedIds.length]);

  const filteredWorkshopOptions = availableWorkshops.filter((workshop) =>
    workshop.name.toLowerCase().includes(workshopQuery.trim().toLowerCase())
  );

  function toggleWorkshop(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setQuery("");
  }

  function exportRows() {
    const output = [
      ["Name", "Mobile", "Email", "Workshop count", "Workshops"],
      ...visibleRows.map((row) => [row.name, row.mobile, row.email, row.workshopIds.length, row.workshopNames.join(" | ")])
    ];
    const blob = new Blob([output.map((line) => line.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "multi-workshop-common-people.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function shareSummaryOnWhatsApp() {
    const viewLabel = mode === "all" ? "Common in all" : "Attended 2+";
    const message = [
      "Multi-Workshop Participant Summary",
      "",
      `Forms: ${selectedWorkshops.map((workshop) => `${workshop.name} (${workshop.type === "attendance" ? "Attendance" : "Registration"})`).join(", ")}`,
      `Selected forms: ${selectedIds.length}`,
      `Unique people: ${rows.length}`,
      `Common in all: ${commonCount}`,
      `Attended 2 or more: ${repeatCount}`,
      `Current view: ${viewLabel} (${visibleRows.length})`
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mt-4">
      <button className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100" onClick={() => setOpen((value) => !value)} type="button">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><UsersRound className="size-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-slate-950">Compare people across workshops</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">Select registration or attendance forms and find repeat or common participants by mobile number.</span>
          </span>
        </span>
        {open ? <ChevronUp className="size-5 shrink-0 text-slate-500" /> : <ChevronDown className="size-5 shrink-0 text-slate-500" />}
      </button>

      {open ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-base font-black text-slate-950">Select forms</h4>
                {selectedIds.length ? <button className="text-xs font-black text-rose-600 hover:underline" onClick={() => setSelectedIds([])} type="button">Clear all</button> : null}
              </div>
              <label className="relative mt-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input className="min-h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none focus:border-indigo-500" onChange={(event) => setWorkshopQuery(event.target.value)} placeholder="Search all forms" value={workshopQuery} />
              </label>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                {filteredWorkshopOptions.map((workshop) => {
                  const checked = selectedIds.includes(workshop.id);
                  return (
                    <label className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-0 hover:bg-slate-50" key={workshop.id}>
                      <input checked={checked} className="sr-only" onChange={() => toggleWorkshop(workshop.id)} type="checkbox" />
                      <span className={`grid size-5 shrink-0 place-items-center rounded border ${checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"}`}>{checked ? <Check className="size-3.5" /> : null}</span>
                      <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{workshop.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${workshop.type === "attendance" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"}`}>
                        {workshop.type === "attendance" ? "Attendance" : "Registration"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0">
              {selectedIds.length < 2 ? (
                <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <div><BarChart3 className="mx-auto size-7 text-slate-400" /><p className="mt-3 text-sm font-black text-slate-700">Select at least 2 forms</p><p className="mt-1 text-xs font-semibold text-slate-500">Common participant results will appear here.</p></div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <OverlapStat label="Selected" value={selectedIds.length} />
                    <OverlapStat label="Unique people" value={rows.length} />
                    <OverlapStat label="Common in all" value={commonCount} />
                    <OverlapStat label="Attended 2+" value={repeatCount} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex rounded-lg border border-slate-200 p-1">
                      <button className={`rounded-md px-3 py-2 text-xs font-black ${mode === "all" ? "bg-slate-950 text-white" : "text-slate-600"}`} onClick={() => setMode("all")} type="button">Common in all ({commonCount})</button>
                      <button className={`rounded-md px-3 py-2 text-xs font-black ${mode === "repeat" ? "bg-slate-950 text-white" : "text-slate-600"}`} onClick={() => setMode("repeat")} type="button">Attended 2+ ({repeatCount})</button>
                    </div>
                    <div className="flex gap-2">
                      <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700" onClick={shareSummaryOnWhatsApp} type="button"><MessageCircle className="size-4" />WhatsApp</button>
                      <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40" disabled={!visibleRows.length} onClick={exportRows} type="button"><Download className="size-4" />Export</button>
                    </div>
                  </div>
                  <label className="relative mt-3 block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input className="min-h-11 w-full rounded-lg border border-slate-200 pl-10 pr-10 text-sm font-semibold outline-none focus:border-indigo-500" onChange={(event) => setQuery(event.target.value)} placeholder="Search common people by name, mobile or email" value={query} />
                    {query ? <button aria-label="Clear search" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-slate-400" onClick={() => setQuery("")} type="button"><X className="size-4" /></button> : null}
                  </label>
                  <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Person</th><th className="px-3 py-3">Mobile</th><th className="px-3 py-3">Count</th><th className="px-3 py-3">Workshops</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleRows.length ? visibleRows.map((row) => <tr key={row.mobileKey}><td className="px-3 py-3"><p className="font-black text-slate-900">{row.name}</p><p className="mt-0.5 text-xs text-slate-500">{row.email || "-"}</p></td><td className="px-3 py-3 font-semibold text-slate-700">{row.mobile}</td><td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{row.workshopIds.length}</span></td><td className="px-3 py-3 text-xs font-semibold leading-5 text-slate-600">{row.workshopNames.join(" · ")}</td></tr>) : <tr><td className="px-3 py-10 text-center font-semibold text-slate-500" colSpan={4}>No matching people found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OverlapStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>;
}
