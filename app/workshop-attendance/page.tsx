"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { hydrateLiveState, readLocalArray, saveLiveState } from "@/lib/live-state";
import type { AttendanceEntry, AttendanceSession, BuilderField, BuilderFieldType } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { ArrowDown, ArrowUp, CalendarDays, CheckSquare, Circle, Copy, Download, ExternalLink, Eye, Heading, Mail, Plus, QrCode, RefreshCw, Save, Search, Smartphone, Trash2, Type, UsersRound, Video, X } from "lucide-react";
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
  const [savingForm, setSavingForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<AttendanceSession | null>(null);
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<AttendanceEntry | null>(null);
  const [entryDetail, setEntryDetail] = useState<AttendanceEntry | null>(null);

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
  const selectedSession = workshopSessions.find((session) => session.id === selectedSessionId) ?? workshopSessions[0] ?? null;
  const selectedEntries = entries.filter((entry) => entry.sessionId === selectedSession?.id);
  const totalAttendees = new Set(entries.map((entry) => `${entry.workshopId}-${entry.mobile}`)).size;
  const link = selectedSession ? attendanceLink(selectedSession.slug) : "";

  useEffect(() => {
    let cancelled = false;
    if (!link) {
      setQrDataUrl("");
      return;
    }
    void import("qrcode").then((module) => module.toDataURL(link, { margin: 1, width: 240 })).then((value) => {
      if (!cancelled) setQrDataUrl(value);
    }).catch(() => {
      if (!cancelled) setQrDataUrl("");
    });
    return () => { cancelled = true; };
  }, [link]);

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
      allowDuplicate: false,
      batch: workshop.batch || "",
      closeMinutesAfter: 120,
      facilitator: workshop.facilitator || "CFL Facilitator",
      fields: defaultAttendanceFields(),
      id,
      lateAfterMinutes: 15,
      minimumDurationMinutes: 30,
      openMinutesBefore: 60,
      published: true,
      redirectDelaySeconds: 3,
      sessionDate: new Date().toISOString().slice(0, 10),
      slug,
      title: `Session ${number}`,
      updatedAt: now,
      venue: "",
      successMessage: "Attendance marked successfully. You can now join the live session.",
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
    setSaveMessage("");
    persistSessions(next);
  }

  async function saveSelectedForm() {
    if (!selectedSession) return;
    setSavingForm(true);
    setSaveMessage("");
    await saveLiveState({ attendanceSessions: sessions });
    setSavingForm(false);
    setSaveMessage("Attendance form updated successfully.");
    window.setTimeout(() => setSaveMessage(""), 2200);
  }

  function deleteSession(id: string) {
    const nextSessions = sessions.filter((session) => session.id !== id);
    const nextEntries = entries.filter((entry) => entry.sessionId !== id);
    persistSessions(nextSessions);
    persistEntries(nextEntries);
    setSelectedSessionId(nextSessions.find((session) => session.workshopId === selectedWorkshop?.id)?.id || "");
    setDeleteSessionTarget(null);
  }

  function updateEntry(id: string, patch: Partial<AttendanceEntry>) {
    persistEntries(entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function deleteEntry() {
    if (!deleteEntryTarget) return;
    persistEntries(entries.filter((entry) => entry.id !== deleteEntryTarget.id));
    setDeleteEntryTarget(null);
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
      <section className="min-w-0 space-y-4">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Attendance</p>
              <h2 className="text-xl font-black text-slate-950">Workshops</h2>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">{workshops.length}</span>
          </div>
          <div className="mt-4 flex min-w-0 flex-col gap-3 lg:flex-row">
            <label className="flex w-full shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 lg:w-80">
              <Search className="size-4 text-slate-400" />
              <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Search workshop..." value={query} />
            </label>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {filteredWorkshops.map((workshop) => {
                const count = sessions.filter((session) => session.workshopId === workshop.id).length;
                const active = selectedWorkshop?.id === workshop.id;
                return (
                  <button
                    className={`w-[240px] shrink-0 rounded-xl border px-3 py-3 text-left transition ${active ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
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
              {filteredWorkshops.length === 0 ? (
                <div className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <Search className="mx-auto size-6 text-slate-300" />
                  <p className="mt-2 text-sm font-black text-slate-600">{workshops.length ? "No workshops found" : "No workshops created yet"}</p>
                  {workshops.length ? <p className="mt-1 text-xs font-semibold text-slate-400">Try a different search.</p> : <a className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-xs font-black text-white" href="/workshop-master">Create workshop</a>}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
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
                {selectedSession ? (
                  <button className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70" disabled={savingForm} onClick={saveSelectedForm} type="button">
                    <Save className="size-4" />
                    {savingForm ? "Saving..." : "Update Form"}
                  </button>
                ) : null}
                <button className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" disabled={!selectedWorkshop} onClick={() => createSession()} type="button">
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
            <div className="grid min-w-0 gap-4 min-[1720px]:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">Attendance Form</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">{saveMessage || "Edit details, fields, and share link settings."}</p>
                    </div>
                    <button className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70" disabled={savingForm} onClick={saveSelectedForm} type="button">
                      <Save className="size-4" />
                      {savingForm ? "Saving..." : "Update Form"}
                    </button>
                  </div>
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
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-600">Batch</span>
                      <input className={inputClass} onChange={(event) => updateSession({ batch: event.target.value })} placeholder="Main Batch" value={selectedSession.batch || ""} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-slate-600">Zoom Meeting Link</span>
                      <div className="relative"><Video className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} onChange={(event) => updateSession({ zoomJoinUrl: event.target.value })} placeholder="https://zoom.us/j/..." type="url" value={selectedSession.zoomJoinUrl || ""} /></div>
                    </label>
                    <div className="grid gap-3 md:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
                      <NumberSetting label="Open before" onChange={(value) => updateSession({ openMinutesBefore: value })} suffix="min" value={selectedSession.openMinutesBefore ?? 60} />
                      <NumberSetting label="Late after" onChange={(value) => updateSession({ lateAfterMinutes: value })} suffix="min" value={selectedSession.lateAfterMinutes ?? 15} />
                      <NumberSetting label="Close after" onChange={(value) => updateSession({ closeMinutesAfter: value })} suffix="min" value={selectedSession.closeMinutesAfter ?? 120} />
                      <NumberSetting label="Zoom redirect" onChange={(value) => updateSession({ redirectDelaySeconds: value })} suffix="sec" value={selectedSession.redirectDelaySeconds ?? 3} />
                      <NumberSetting label="Min. duration" onChange={(value) => updateSession({ minimumDurationMinutes: value })} suffix="min" value={selectedSession.minimumDurationMinutes ?? 30} />
                    </div>
                    <label className="md:col-span-2 flex cursor-pointer items-center justify-between gap-4 border border-slate-200 bg-slate-50 p-4">
                      <span><span className="block text-sm font-black text-slate-800">Allow repeat check-ins</span><span className="mt-1 block text-xs font-bold text-slate-500">When off, one mobile number creates only one attendance response per session.</span></span>
                      <input checked={Boolean(selectedSession.allowDuplicate)} className="size-5 accent-emerald-600" onChange={(event) => updateSession({ allowDuplicate: event.target.checked })} type="checkbox" />
                    </label>
                    <label className="md:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-600">Success Message</span>
                      <input className={inputClass} onChange={(event) => updateSession({ successMessage: event.target.value })} value={selectedSession.successMessage || ""} />
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

              <aside className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Share Attendance</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Public form link</h3>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    {qrDataUrl ? <div className="mb-3 bg-white p-3 text-center"><img alt="Attendance check-in QR code" className="mx-auto size-44 object-contain" src={qrDataUrl} /><p className="mt-2 inline-flex items-center gap-2 text-xs font-black text-slate-500"><QrCode className="size-4" />Scan to mark attendance</p></div> : null}
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
                  {selectedEntries.length === 0 ? (
                    <div className="mt-4 grid min-h-36 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                      <div>
                        <UsersRound className="mx-auto size-8 text-slate-300" />
                        <p className="mt-3 text-sm font-black text-slate-700">No attendance recorded yet</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Share the public form link or refresh after participants submit.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 max-h-[420px] w-full overflow-auto rounded-xl border border-slate-100">
                      <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-3 py-3">Name</th>
                          <th className="px-3 py-3">Mobile</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Check-in</th>
                          <th className="px-3 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-3 py-3 font-bold text-slate-800">{entry.attendeeName}</td>
                            <td className="px-3 py-3 font-semibold text-slate-500">{entry.mobile}</td>
                            <td className="px-3 py-3"><select aria-label={`Attendance status for ${entry.attendeeName}`} className="border border-slate-200 bg-white px-2 py-1.5 text-xs font-black text-slate-700" onChange={(event) => updateEntry(entry.id, { status: event.target.value as AttendanceEntry["status"] })} value={entry.status || "checked_in"}><option value="checked_in">Checked In</option><option value="late">Late</option><option value="joined_zoom">Joined Zoom</option><option value="completed">Completed</option></select></td>
                            <td className="px-3 py-3 font-semibold text-slate-500">{entry.submittedAt ? new Date(entry.submittedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                            <td className="px-3 py-3"><div className="flex gap-1.5"><button aria-label={`View ${entry.attendeeName} answers`} className="grid size-8 place-items-center border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setEntryDetail(entry)} type="button"><Eye className="size-3.5" /></button><button aria-label={`Delete ${entry.attendeeName} attendance`} className="grid size-8 place-items-center bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => setDeleteEntryTarget(entry)} type="button"><Trash2 className="size-3.5" /></button></div></td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <button className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-600 hover:bg-rose-100" onClick={() => setDeleteSessionTarget(selectedSession)} type="button">
                  <Trash2 className="size-4" />
                  Delete Session
                </button>
              </aside>
            </div>
          ) : null}
        </div>
      </section>
      <ConfirmDialog confirmLabel="Delete Session" description="The attendance form and all responses for this session will be removed permanently." onCancel={() => setDeleteSessionTarget(null)} onConfirm={() => deleteSessionTarget && deleteSession(deleteSessionTarget.id)} open={Boolean(deleteSessionTarget)} title="Delete attendance session?">{deleteSessionTarget?.title}</ConfirmDialog>
      <ConfirmDialog confirmLabel="Delete Response" description="This attendance response will be removed permanently." onCancel={() => setDeleteEntryTarget(null)} onConfirm={deleteEntry} open={Boolean(deleteEntryTarget)} title="Delete attendance response?">{deleteEntryTarget?.attendeeName}</ConfirmDialog>
      {entryDetail ? <EntryDetailDialog entry={entryDetail} onClose={() => setEntryDetail(null)} /> : null}
    </AdminPlatformShell>
  );
}

function NumberSetting({ label, onChange, suffix, value }: { label: string; onChange: (value: number) => void; suffix: string; value: number }) {
  return <label><span className="mb-2 block text-xs font-black text-slate-500">{label}</span><div className="flex border border-slate-200 bg-white"><input className="min-w-0 flex-1 px-3 py-2.5 text-sm font-bold outline-none" min={0} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} type="number" value={value} /><span className="grid place-items-center border-l border-slate-200 px-2 text-[10px] font-black uppercase text-slate-400">{suffix}</span></div></label>;
}

function EntryDetailDialog({ entry, onClose }: { entry: AttendanceEntry; onClose: () => void }) {
  const answers = Object.entries(entry.answers ?? {});
  return <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 sm:place-items-center sm:p-4" role="dialog"><section className="max-h-[90vh] w-full overflow-hidden bg-white shadow-2xl sm:max-w-xl"><header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5"><div><h2 className="text-xl font-black">{entry.attendeeName}</h2><p className="mt-1 text-xs font-bold text-slate-500">{entry.mobile} · {entry.workshopName}</p></div><button aria-label="Close response details" className="grid size-9 place-items-center border border-slate-200 text-slate-500" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="max-h-[70vh] overflow-y-auto p-5"><dl className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-5"><Detail label="Email" value={entry.email || "-"} /><Detail label="City" value={entry.city || "-"} /><Detail label="Batch" value={entry.batch || "-"} /><Detail label="Submitted" value={new Date(entry.submittedAt).toLocaleString("en-IN")} /></dl>{answers.length ? <dl className="mt-2 divide-y divide-slate-200">{answers.map(([label, answer]) => <div className="py-4" key={label}><dt className="text-xs font-black uppercase text-slate-500">{label}</dt><dd className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-900">{answer}</dd></div>)}</dl> : <p className="py-10 text-center text-sm font-bold text-slate-500">No custom answers.</p>}</div></section></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-black uppercase text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-slate-800">{value}</dd></div>; }

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function normalizeOptionLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function OptionBoxes({ field, onChange }: { field: BuilderField; onChange: (patch: Partial<BuilderField>) => void }) {
  const options = field.options?.length ? field.options : ["Option 1", "Option 2"];

  function updateOption(optionIndex: number, value: string) {
    const next = options.map((option, currentIndex) => currentIndex === optionIndex ? value : option);
    onChange({ options: next.some((option) => option.trim()) ? next : [""] });
  }

  function pasteOptions(optionIndex: number, value: string) {
    const pasted = normalizeOptionLines(value);
    if (pasted.length <= 1) return false;
    const next = [...options.slice(0, optionIndex), ...pasted, ...options.slice(optionIndex + 1)];
    onChange({ options: next });
    return true;
  }

  function removeOption(optionIndex: number) {
    const next = options.filter((_, currentIndex) => currentIndex !== optionIndex);
    onChange({ options: next.length ? next : ["Option 1"] });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Options</p>
        <button
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          onClick={() => onChange({ options: [...options, `Option ${options.length + 1}`] })}
          type="button"
        >
          <Plus className="size-3.5" />
          Add option
        </button>
      </div>
      <div className="grid gap-2">
        {options.map((option, optionIndex) => (
          <div className="grid grid-cols-[34px_minmax(0,1fr)_36px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2" key={`${field.id}-option-${optionIndex}`}>
            <span className="grid size-8 place-items-center rounded-lg bg-white text-xs font-black text-slate-500">{optionIndex + 1}</span>
            <input
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              onChange={(event) => updateOption(optionIndex, event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              onPaste={(event) => {
                if (pasteOptions(optionIndex, event.clipboardData.getData("text"))) event.preventDefault();
              }}
              placeholder={`Option ${optionIndex + 1}`}
              value={option}
            />
            <button
              aria-label={`Remove option ${optionIndex + 1}`}
              className="grid size-9 place-items-center rounded-lg bg-white text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              disabled={options.length === 1}
              onClick={() => removeOption(optionIndex)}
              type="button"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs font-bold leading-5 text-slate-400">Spaces are supported. Paste multiple options with each option on a new line.</p>
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
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[34px_minmax(0,1fr)] sm:items-start min-[1800px]:grid-cols-[34px_minmax(0,1fr)_150px_auto]">
        <span className="grid size-9 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><Icon className="size-4" /></span>
        <div className="space-y-2">
          <input className={inputClass} onChange={(event) => onChange({ label: event.target.value })} onKeyDown={(event) => event.stopPropagation()} placeholder="Field label" value={field.label} />
          {field.type !== "heading" ? (
            <input className={inputClass} onChange={(event) => onChange({ placeholder: event.target.value })} onKeyDown={(event) => event.stopPropagation()} placeholder="Placeholder text" value={field.placeholder ?? ""} />
          ) : null}
          {meta.hasOptions ? <OptionBoxes field={field} onChange={onChange} /> : null}
        </div>
        <span className="rounded-lg bg-white px-3 py-2.5 text-center text-xs font-black text-slate-500 sm:col-start-2 min-[1800px]:col-start-auto">{meta.label}</span>
        <div className="flex flex-wrap items-center gap-2 sm:col-start-2 min-[1800px]:col-start-auto">
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
