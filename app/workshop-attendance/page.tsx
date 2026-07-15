"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { hydrateLiveState, readLocalArray, saveLiveState } from "@/lib/live-state";
import type { AttendanceEntry, AttendanceSession, BuilderField, BuilderFieldType } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { ArrowDown, ArrowUp, CalendarDays, CheckSquare, Circle, Copy, Download, ExternalLink, Heading, Mail, Plus, RefreshCw, Search, Smartphone, Trash2, Type, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const WORKSHOP_MASTER_STORAGE_KEY = "cfl_workshop_master_records_v1";
const ATTENDANCE_SESSIONS_STORAGE_KEY = "cfl_attendance_sessions_v1";
const ATTENDANCE_ENTRIES_STORAGE_KEY = "cfl_attendance_entries_v1";

type WorkshopRecord = {
  archived?: boolean;
  batch?: string;
  facilitator?: string;
  id: string;
  name: string;
};

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

const fieldTypeMeta: Record<BuilderFieldType, { icon: typeof Type; label: string; hasOptions: boolean }> = {
  short_text: { icon: Type, label: "Short Text", hasOptions: false },
  paragraph: { icon: Type, label: "Paragraph", hasOptions: false },
  email: { icon: Mail, label: "Email", hasOptions: false },
  mobile: { icon: Smartphone, label: "Mobile", hasOptions: false },
  number: { icon: Type, label: "Number", hasOptions: false },
  date: { icon: CalendarDays, label: "Date", hasOptions: false },
  dropdown: { icon: Circle, label: "Dropdown", hasOptions: true },
  radio: { icon: Circle, label: "Multiple Choice", hasOptions: true },
  checkbox: { icon: CheckSquare, label: "Checkboxes", hasOptions: true },
  heading: { icon: Heading, label: "Section Heading", hasOptions: false }
};

const addableTypes: BuilderFieldType[] = ["short_text", "paragraph", "email", "mobile", "number", "date", "dropdown", "radio", "checkbox", "heading"];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function defaultAttendanceFields(): BuilderField[] {
  return [
    { id: generateId(), label: "Full Name", placeholder: "Your full name", required: true, role: "name", type: "short_text" },
    { id: generateId(), label: "Mobile Number", placeholder: "10-digit mobile", required: true, role: "mobile", type: "mobile" },
    { id: generateId(), label: "Email", placeholder: "you@example.com", required: false, role: "email", type: "email" },
    { id: generateId(), label: "City", placeholder: "Your city", required: false, role: "city", type: "short_text" }
  ];
}

function attendanceLink(slug: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/attendance/${slug}`;
}

function formatDate(value?: string) {
  if (!value) return "Date not set";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function WorkshopAttendancePage() {
  const [workshops, setWorkshops] = useState<WorkshopRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedWorkshopId, setSelectedWorkshopId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function loadLocal() {
    const loadedWorkshops = readLocalArray<WorkshopRecord>(WORKSHOP_MASTER_STORAGE_KEY).filter((item) => !item.archived);
    const loadedSessions = readLocalArray<AttendanceSession>(ATTENDANCE_SESSIONS_STORAGE_KEY);
    const loadedEntries = readLocalArray<AttendanceEntry>(ATTENDANCE_ENTRIES_STORAGE_KEY);
    setWorkshops(loadedWorkshops);
    setSessions(loadedSessions);
    setEntries(loadedEntries);
    setSelectedWorkshopId((current) => current || loadedWorkshops[0]?.id || "");
    setSelectedSessionId((current) => current || loadedSessions[0]?.id || "");
  }

  useEffect(() => {
    loadLocal();
    hydrateLiveState().then(loadLocal);
  }, []);

  const filteredWorkshops = useMemo(() => {
    const value = query.trim().toLowerCase();
    return workshops.filter((workshop) => !value || workshop.name.toLowerCase().includes(value));
  }, [query, workshops]);

  const selectedWorkshop = workshops.find((item) => item.id === selectedWorkshopId) ?? filteredWorkshops[0] ?? null;
  const workshopSessions = sessions.filter((session) => session.workshopId === selectedWorkshop?.id);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? workshopSessions[0] ?? null;
  const selectedEntries = entries.filter((entry) => entry.sessionId === selectedSession?.id);
  const totalAttendees = new Set(entries.map((entry) => `${entry.workshopId}-${entry.mobile}`)).size;
  const link = selectedSession ? attendanceLink(selectedSession.slug) : "";

  function persistSessions(next: AttendanceSession[]) {
    setSessions(next);
    void saveLiveState({ attendanceSessions: next });
  }

  function persistEntries(next: AttendanceEntry[]) {
    setEntries(next);
    void saveLiveState({ attendanceEntries: next });
  }

  function createSession(workshop = selectedWorkshop) {
    if (!workshop) return;
    const now = new Date().toISOString();
    const number = sessions.filter((session) => session.workshopId === workshop.id).length + 1;
    const id = generateId();
    const slug = `${slugify(workshop.name) || "workshop"}-session-${number}-${id.slice(0, 6)}`;
    const session: AttendanceSession = {
      createdAt: now,
      description: "Please mark your attendance for this workshop session.",
      facilitator: workshop.facilitator || "CFL Facilitator",
      fields: defaultAttendanceFields(),
      id,
      published: true,
      sessionDate: new Date().toISOString().slice(0, 10),
      slug,
      title: `Session ${number}`,
      updatedAt: now,
      venue: "",
      workshopId: workshop.id,
      workshopName: workshop.name,
      workshopSlug: slugify(workshop.name) || workshop.id
    };
    persistSessions([session, ...sessions]);
    setSelectedWorkshopId(workshop.id);
    setSelectedSessionId(id);
  }

  function updateSession(patch: Partial<AttendanceSession>) {
    if (!selectedSession) return;
    const next = sessions.map((session) => (
      session.id === selectedSession.id ? { ...session, ...patch, updatedAt: new Date().toISOString() } : session
    ));
    persistSessions(next);
  }

  function deleteSession(id: string) {
    const nextSessions = sessions.filter((session) => session.id !== id);
    const nextEntries = entries.filter((entry) => entry.sessionId !== id);
    persistSessions(nextSessions);
    persistEntries(nextEntries);
    setSelectedSessionId(nextSessions[0]?.id || "");
  }

  function addField(type: BuilderFieldType) {
    if (!selectedSession) return;
    const meta = fieldTypeMeta[type];
    updateSession({
      fields: [
        ...selectedSession.fields,
        {
          id: generateId(),
          label: meta.label,
          options: meta.hasOptions ? ["Option 1", "Option 2"] : undefined,
          placeholder: meta.hasOptions || type === "heading" ? undefined : meta.label,
          required: false,
          type
        }
      ]
    });
  }

  function updateField(id: string, patch: Partial<BuilderField>) {
    if (!selectedSession) return;
    updateSession({ fields: selectedSession.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)) });
  }

  function moveField(index: number, direction: -1 | 1) {
    if (!selectedSession) return;
    const next = [...selectedSession.fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateSession({ fields: next });
  }

  function removeField(id: string) {
    if (!selectedSession) return;
    updateSession({ fields: selectedSession.fields.filter((field) => field.id !== id) });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function refreshAttendance() {
    setRefreshing(true);
    await hydrateLiveState();
    loadLocal();
    setRefreshing(false);
  }

  function exportAttendanceCsv() {
    if (!selectedSession) return;
    const extraLabels = Array.from(
      new Set(selectedEntries.flatMap((entry) => Object.keys(entry.answers ?? {})))
    );
    const headers = ["Session", "Workshop", "Name", "Mobile", "Email", "City", "Submitted At", ...extraLabels];
    const rows = selectedEntries.map((entry) => [
      selectedSession.title,
      entry.workshopName,
      entry.attendeeName,
      entry.mobile,
      entry.email ?? "",
      entry.city ?? "",
      entry.submittedAt ? new Date(entry.submittedAt).toLocaleString("en-IN") : "",
      ...extraLabels.map((label) => entry.answers?.[label] ?? "")
    ]);
    const escapeCell = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance-${selectedSession.slug}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPlatformShell activeLabel="Workshop Attendance" description="Create session-wise attendance forms and track who attended every workshop session." title="Workshop Attendance">
      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Attendance</p>
              <h2 className="text-xl font-black text-slate-950">Workshops</h2>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">{workshops.length}</span>
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Search className="size-4 text-slate-400" />
            <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Search workshop..." value={query} />
          </label>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {filteredWorkshops.map((workshop) => {
              const count = sessions.filter((session) => session.workshopId === workshop.id).length;
              const active = selectedWorkshop?.id === workshop.id;
              return (
                <button
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                  key={workshop.id}
                  onClick={() => {
                    setSelectedWorkshopId(workshop.id);
                    setSelectedSessionId(sessions.find((session) => session.workshopId === workshop.id)?.id || "");
                  }}
                  type="button"
                >
                  <p className="line-clamp-2 text-sm font-black">{workshop.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{count} sessions</p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Workshops" value={workshops.length} />
            <Metric label="Sessions" value={sessions.length} />
            <Metric label="Attendance Entries" value={entries.length} />
            <Metric label="Unique Attendees" value={totalAttendees} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Session Setup</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedWorkshop?.name || "Select workshop"}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Add sessions, build attendance forms, share links, and view attendance data.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50" disabled={refreshing} onClick={refreshAttendance} type="button">
                  <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700" onClick={() => createSession()} type="button">
                  <Plus className="size-4" />
                  Add Session
                </button>
              </div>
            </div>

            {workshopSessions.length > 0 ? (
              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {workshopSessions.map((session) => (
                  <button
                    className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm font-black ${selectedSession?.id === session.id ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    type="button"
                  >
                    <span>{session.title}</span>
                    <span className="mt-1 block text-xs text-slate-400">{formatDate(session.sessionDate)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <CalendarDays className="mx-auto size-10 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-700">No sessions yet</p>
                <p className="mt-1 text-sm font-semibold text-slate-400">Create the first session to generate an attendance form.</p>
              </div>
            )}
          </div>

          {selectedSession ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-600">Session Title</span>
                      <input className={inputClass} onChange={(event) => updateSession({ title: event.target.value })} value={selectedSession.title} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-600">Date</span>
                      <input className={inputClass} onChange={(event) => updateSession({ sessionDate: event.target.value })} type="date" value={selectedSession.sessionDate} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-600">Start Time</span>
                      <input className={inputClass} onChange={(event) => updateSession({ startTime: event.target.value })} type="time" value={selectedSession.startTime || ""} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-600">End Time</span>
                      <input className={inputClass} onChange={(event) => updateSession({ endTime: event.target.value })} type="time" value={selectedSession.endTime || ""} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-600">Facilitator</span>
                      <input className={inputClass} onChange={(event) => updateSession({ facilitator: event.target.value })} value={selectedSession.facilitator || ""} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-600">Venue</span>
                      <input className={inputClass} onChange={(event) => updateSession({ venue: event.target.value })} placeholder="Online / City / Address" value={selectedSession.venue || ""} />
                    </label>
                    <label className="md:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-600">Form Description</span>
                      <textarea className={inputClass} onChange={(event) => updateSession({ description: event.target.value })} rows={3} value={selectedSession.description} />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Form Builder</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">{selectedSession.fields.length} fields</h3>
                    </div>
                    <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700">
                      <input checked={selectedSession.published} className="size-5 accent-emerald-600" onChange={(event) => updateSession({ published: event.target.checked })} type="checkbox" />
                      Published
                    </label>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedSession.fields.map((field, index) => (
                      <FieldEditor
                        field={field}
                        index={index}
                        key={field.id}
                        onChange={(patch) => updateField(field.id, patch)}
                        onMove={moveField}
                        onRemove={() => removeField(field.id)}
                        total={selectedSession.fields.length}
                      />
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {addableTypes.map((type) => {
                      const meta = fieldTypeMeta[type];
                      const Icon = meta.icon;
                      return (
                        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" key={type} onClick={() => addField(type)} type="button">
                          <Icon className="size-3.5" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Share Attendance</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Public form link</h3>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <input aria-label="Public attendance form link" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" onFocus={(event) => event.target.select()} readOnly value={link} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white" onClick={copyLink} type="button">
                        <Copy className="size-4" />
                        {copied ? "Copied" : "Copy"}
                      </button>
                      <a className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" href={link} rel="noreferrer" target="_blank">
                        <ExternalLink className="size-4" />
                        Open
                      </a>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Attendance Data</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">{selectedEntries.length} attendees</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled={selectedEntries.length === 0} onClick={exportAttendanceCsv} title="Export attendance CSV" type="button">
                        <Download className="size-4" />
                      </button>
                      <UsersRound className="size-7 text-slate-300" />
                    </div>
                  </div>
                  <div className="mt-4 max-h-[360px] overflow-auto rounded-xl border border-slate-100">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-3 py-3">Name</th>
                          <th className="px-3 py-3">Mobile</th>
                          <th className="px-3 py-3">City</th>
                          <th className="px-3 py-3">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-3 py-3 font-bold text-slate-800">{entry.attendeeName}</td>
                            <td className="px-3 py-3 font-semibold text-slate-500">{entry.mobile}</td>
                            <td className="px-3 py-3 font-semibold text-slate-500">{entry.city || "-"}</td>
                            <td className="px-3 py-3 font-semibold text-slate-500">{entry.submittedAt ? new Date(entry.submittedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                          </tr>
                        ))}
                        {selectedEntries.length === 0 ? (
                          <tr><td className="px-3 py-8 text-center text-sm font-bold text-slate-400" colSpan={4}>No attendance yet. Share the public form link or refresh after participants submit.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-600 hover:bg-rose-100" onClick={() => deleteSession(selectedSession.id)} type="button">
                  <Trash2 className="size-4" />
                  Delete Session
                </button>
              </aside>
            </div>
          ) : null}
        </div>
      </section>
    </AdminPlatformShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function FieldEditor({
  field,
  index,
  onChange,
  onMove,
  onRemove,
  total
}: {
  field: BuilderField;
  index: number;
  onChange: (patch: Partial<BuilderField>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: () => void;
  total: number;
}) {
  const meta = fieldTypeMeta[field.type];
  const Icon = meta.icon;
  const locked = field.role === "name" || field.role === "mobile";
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="grid gap-3 lg:grid-cols-[34px_1fr_150px_auto] lg:items-start">
        <span className="grid size-9 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><Icon className="size-4" /></span>
        <div className="space-y-2">
          <input className={inputClass} onChange={(event) => onChange({ label: event.target.value })} placeholder="Field label" value={field.label} />
          {field.type !== "heading" ? (
            <input className={inputClass} onChange={(event) => onChange({ placeholder: event.target.value })} placeholder="Placeholder text" value={field.placeholder ?? ""} />
          ) : null}
          {meta.hasOptions ? (
            <textarea
              className={inputClass}
              onChange={(event) => onChange({ options: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })}
              placeholder="One option per line"
              rows={3}
              value={(field.options ?? []).join("\n")}
            />
          ) : null}
        </div>
        <span className="rounded-lg bg-white px-3 py-2.5 text-center text-xs font-black text-slate-500">{meta.label}</span>
        <div className="flex flex-wrap items-center gap-2">
          {field.type !== "heading" ? (
            <label className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-600">
              <input checked={Boolean(field.required)} className="size-4 accent-emerald-600" disabled={locked} onChange={(event) => onChange({ required: event.target.checked })} type="checkbox" />
              Required
            </label>
          ) : null}
          <button className="grid size-9 place-items-center rounded-lg bg-white text-slate-500 hover:text-slate-900 disabled:opacity-30" disabled={index === 0} onClick={() => onMove(index, -1)} type="button"><ArrowUp className="size-4" /></button>
          <button className="grid size-9 place-items-center rounded-lg bg-white text-slate-500 hover:text-slate-900 disabled:opacity-30" disabled={index === total - 1} onClick={() => onMove(index, 1)} type="button"><ArrowDown className="size-4" /></button>
          <button className="grid size-9 place-items-center rounded-lg bg-white text-rose-400 hover:text-rose-600 disabled:opacity-30" disabled={locked} onClick={onRemove} type="button"><Trash2 className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}
