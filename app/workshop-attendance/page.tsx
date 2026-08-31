"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { OperationalStat } from "@/components/operational-stat";
import { parseBulkAttendanceMobiles } from "@/lib/bulk-attendance";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DuplicateResponseFilter } from "@/components/duplicate-response-filter";
import { AdvancedResponseFilters } from "@/components/advanced-response-filters";
import { hydrateLiveState, readLocalArray, saveLiveState } from "@/lib/live-state";
import type { AttendanceEntry, AttendanceSession, BuilderField, BuilderFieldType, BuilderVisibilityOperator, RegistrationEntry } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { publicFormSlug } from "@/lib/public-slug";
import { hideDuplicateResponses } from "@/lib/response-dedupe";
import { applyResponseFilters, emptyResponseFilters, responseQuestionOptions, type ResponseFilterState } from "@/lib/response-filters";
import { ArrowDown, ArrowUp, BarChart3, CalendarDays, CheckSquare, Circle, Copy, Download, ExternalLink, Eye, Heading, Image as ImageIcon, Laptop, LayoutTemplate, Mail, MessageCircle, Palette, Phone, Plus, QrCode, RefreshCw, Ruler, Save, Search, Settings2, Smartphone, Star, Trash2, Type, Upload, UserCheck, UsersRound, UserX, Video, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const WORKSHOP_MASTER_STORAGE_KEY = "cfl_workshop_master_records_v1";
const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const ATTENDANCE_SESSIONS_STORAGE_KEY = "cfl_attendance_sessions_v1";
const ATTENDANCE_ENTRIES_STORAGE_KEY = "cfl_attendance_entries_v1";

type WorkshopRecord = {
  archived?: boolean;
  batch?: string;
  facilitator?: string;
  id: string;
  name: string;
};

const inputClass = "min-h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

const fieldTypeMeta: Record<BuilderFieldType, { icon: typeof Type; label: string; hasOptions: boolean }> = {
  short_text: { icon: Type, label: "Short Text", hasOptions: false },
  paragraph: { icon: Type, label: "Paragraph", hasOptions: false },
  email: { icon: Mail, label: "Email", hasOptions: false },
  mobile: { icon: Smartphone, label: "Mobile", hasOptions: false },
  number: { icon: Type, label: "Number", hasOptions: false },
  height: { icon: Ruler, label: "Height", hasOptions: false },
  date: { icon: CalendarDays, label: "Date", hasOptions: false },
  time: { icon: CalendarDays, label: "Time", hasOptions: false },
  dropdown: { icon: Circle, label: "Dropdown", hasOptions: true },
  radio: { icon: Circle, label: "Multiple Choice", hasOptions: true },
  checkbox: { icon: CheckSquare, label: "Checkboxes", hasOptions: true },
  yes_no: { icon: CheckSquare, label: "Yes / No", hasOptions: false },
  rating: { icon: Star, label: "Rating", hasOptions: false },
  consent: { icon: CheckSquare, label: "Consent", hasOptions: false },
  heading: { icon: Heading, label: "Section Heading", hasOptions: false },
  divider: { icon: Heading, label: "Divider", hasOptions: false }
};

const addableTypes: BuilderFieldType[] = ["short_text", "paragraph", "email", "mobile", "number", "height", "date", "time", "dropdown", "radio", "checkbox", "yes_no", "rating", "consent", "heading", "divider"];
type BuilderTab = "build" | "logic" | "design" | "share";
type SessionView = "responses" | "edit";
type ComparisonFilter = "registered" | "attended" | "absent" | "walk_ins";

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

function normalizedMobile(value?: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const mobile = digits.length >= 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(mobile) ? mobile : "";
}

function normalizedEmail(value?: string) {
  return String(value ?? "").trim().toLowerCase();
}

function contactKey(mobile?: string, email?: string) {
  const phone = normalizedMobile(mobile);
  if (phone) return `mobile:${phone}`;
  const mail = normalizedEmail(email);
  return mail ? `email:${mail}` : "";
}

function normalizedBatch(value?: string) {
  return String(value ?? "").trim().toLowerCase();
}

function sessionRegistrationCutoff(session: AttendanceSession, sessionEntries: AttendanceEntry[]) {
  if (!session.sessionDate) return null;
  if (session.endTime?.trim()) {
    const scheduledCutoff = new Date(`${session.sessionDate}T${session.endTime.trim()}`);
    return Number.isNaN(scheduledCutoff.getTime()) ? null : scheduledCutoff;
  }
  const lastCheckIn = sessionEntries
    .map((entry) => new Date(entry.submittedAt))
    .filter((date) => !Number.isNaN(date.getTime()) && date.toLocaleDateString("en-CA") === session.sessionDate)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (lastCheckIn) return lastCheckIn;
  const cutoff = new Date(`${session.sessionDate}T23:59:59.999`);
  return Number.isNaN(cutoff.getTime()) ? null : cutoff;
}

export default function WorkshopAttendancePage() {
  const [workshops, setWorkshops] = useState<WorkshopRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [comparisonFilter, setComparisonFilter] = useState<ComparisonFilter>("absent");
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [responseFilters, setResponseFilters] = useState<ResponseFilterState>({ ...emptyResponseFilters });
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
  const [builderTab, setBuilderTab] = useState<BuilderTab>("build");
  const [sessionView, setSessionView] = useState<SessionView>("responses");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("mobile");
  const [imageError, setImageError] = useState("");
  const [bulkMobiles, setBulkMobiles] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const workshopSearchRef = useRef<HTMLInputElement>(null);

  function loadLocal() {
    const loadedWorkshops = readLocalArray<WorkshopRecord>(WORKSHOP_MASTER_STORAGE_KEY).filter((item) => !item.archived);
    const loadedSessions = readLocalArray<AttendanceSession>(ATTENDANCE_SESSIONS_STORAGE_KEY);
    const loadedEntries = readLocalArray<AttendanceEntry>(ATTENDANCE_ENTRIES_STORAGE_KEY);
    const loadedRegistrations = readLocalArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY);
    setWorkshops(loadedWorkshops);
    setSessions(loadedSessions);
    setEntries(loadedEntries);
    setRegistrations(loadedRegistrations);
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
  const attendanceFilterRecords = selectedEntries.map((entry) => ({ ...entry, answers: { "Full Name": entry.attendeeName, Mobile: entry.mobile, Email: entry.email ?? "", City: entry.city ?? "", Status: entry.status ?? "checked_in", ...(entry.answers ?? {}) } as Record<string, string> }));
  const filteredEntries = applyResponseFilters(attendanceFilterRecords, responseFilters);
  const displayedEntries = hideDuplicates ? hideDuplicateResponses(filteredEntries, {
    email: (entry) => entry.email,
    mobile: (entry) => entry.mobile,
    name: (entry) => entry.attendeeName,
    scope: (entry) => entry.sessionId,
    submittedAt: (entry) => entry.submittedAt
  }) : filteredEntries;
  const attendanceQuestions = responseQuestionOptions(attendanceFilterRecords);
  const selectedAnswerOptions = selectedSession?.fields.find((field) => field.label === responseFilters.question)?.options?.filter(Boolean) ?? [];
  const totalAttendees = new Set(entries.map((entry) => `${entry.workshopId}-${entry.mobile}`)).size;
  const link = selectedSession ? attendanceLink(selectedSession.slug) : "";
  const registrationCutoff = selectedSession ? sessionRegistrationCutoff(selectedSession, selectedEntries) : null;
  const comparison = useMemo(() => {
    if (!selectedWorkshop || !selectedSession) {
      return { registered: [] as RegistrationEntry[], attended: [] as Array<{ attendance: AttendanceEntry; registration: RegistrationEntry }>, absent: [] as RegistrationEntry[], walkIns: [] as AttendanceEntry[] };
    }
    const sessionBatch = normalizedBatch(selectedSession.batch);
    const batchMatches = (registration: RegistrationEntry) => {
      const registrationBatch = normalizedBatch(registration.batch);
      return !sessionBatch || !registrationBatch || sessionBatch === registrationBatch;
    };
    const registeredBeforeSessionEnded = (registration: RegistrationEntry) => {
      if (!registrationCutoff) return true;
      const registeredAt = new Date(registration.createdAt);
      return !Number.isNaN(registeredAt.getTime()) && registeredAt.getTime() <= registrationCutoff.getTime();
    };
    const eligibleRegistrations = registrations.filter(registeredBeforeSessionEnded);
    const exactWorkshopRecords = eligibleRegistrations.filter((registration) => registration.workshopId === selectedWorkshop.id);
    const exactWorkshop = exactWorkshopRecords.filter(batchMatches);
    const workshopTitle = selectedWorkshop.name.trim().toLowerCase();
    const candidates = exactWorkshopRecords.length ? exactWorkshop : eligibleRegistrations.filter((registration) => (
      registration.workshopTitle.trim().toLowerCase() === workshopTitle && batchMatches(registration)
    ));
    const uniqueRegistrations = new Map<string, RegistrationEntry>();
    candidates.forEach((registration) => {
      const key = contactKey(registration.mobile, registration.email) || `registration:${registration.id}`;
      const current = uniqueRegistrations.get(key);
      if (!current || new Date(registration.createdAt) < new Date(current.createdAt)) uniqueRegistrations.set(key, registration);
    });
    const uniqueAttendance = new Map<string, AttendanceEntry>();
    selectedEntries.forEach((entry) => {
      const key = contactKey(entry.mobile, entry.email) || `attendance:${entry.id}`;
      const current = uniqueAttendance.get(key);
      if (!current || new Date(entry.submittedAt) < new Date(current.submittedAt)) uniqueAttendance.set(key, entry);
    });
    const attendanceByMobile = new Map<string, AttendanceEntry>();
    const attendanceByEmail = new Map<string, AttendanceEntry>();
    uniqueAttendance.forEach((entry) => {
      const mobile = normalizedMobile(entry.mobile);
      const email = normalizedEmail(entry.email);
      if (mobile) attendanceByMobile.set(mobile, entry);
      if (email) attendanceByEmail.set(email, entry);
    });
    const consumedAttendanceIds = new Set<string>();
    const attended: Array<{ attendance: AttendanceEntry; registration: RegistrationEntry }> = [];
    const absent: RegistrationEntry[] = [];
    uniqueRegistrations.forEach((registration) => {
      const mobile = normalizedMobile(registration.mobile);
      const email = normalizedEmail(registration.email);
      const attendance = (mobile ? attendanceByMobile.get(mobile) : undefined) ?? (email ? attendanceByEmail.get(email) : undefined);
      if (attendance && !consumedAttendanceIds.has(attendance.id)) {
        attended.push({ attendance, registration });
        consumedAttendanceIds.add(attendance.id);
      }
      else absent.push(registration);
    });
    const walkIns = Array.from(uniqueAttendance.values()).filter((entry) => !consumedAttendanceIds.has(entry.id));
    return { registered: Array.from(uniqueRegistrations.values()), attended, absent, walkIns };
  }, [registrationCutoff, registrations, selectedEntries, selectedSession, selectedWorkshop]);
  const attendanceRate = comparison.registered.length ? Math.round((comparison.attended.length / comparison.registered.length) * 1000) / 10 : 0;

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
    const slug = publicFormSlug("a", id);
    const session: AttendanceSession = {
      createdAt: now,
      description: "Please mark your attendance for this workshop session.",
      allowDuplicate: false,
      responseLimit: undefined,
      closedMessage: "This attendance form is no longer accepting responses.",
      batch: workshop.batch || "",
      closeMinutesAfter: 120,
      facilitator: workshop.facilitator || "CFL Facilitator",
      fields: defaultAttendanceFields(),
      id,
      lateAfterMinutes: 15,
      minimumDurationMinutes: 30,
      openDaysBefore: 0,
      openMinutesBefore: 60,
      published: true,
      redirectDelaySeconds: 3,
      sessionDate: new Date().toISOString().slice(0, 10),
      slug,
      title: `Session ${number}`,
      updatedAt: now,
      venue: "",
      successMessage: "Attendance marked successfully. You can now join the live session.",
      noZoomMessage: "Attendance is saved. The Zoom link has not been configured for this session.",
      submitButtonText: "Mark Attendance",
      formMode: "classic",
      theme: { accent: "#059669", align: "left", fieldRadius: "rounded", fontFamily: "Inter", fontSize: 16, titleBold: true, titleItalic: false, backgroundColor: "#f1f5f9", surfaceColor: "#ffffff" },
      workshopId: workshop.id,
      workshopName: workshop.name,
      workshopSlug: slugify(workshop.name) || workshop.id
    };
    persistSessions([session, ...sessions]);
    setSelectedWorkshopId(workshop.id);
    setSessionView("edit");
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

  async function addBulkAttendance() {
    if (!selectedSession || !selectedWorkshop) return;
    const parsed = parseBulkAttendanceMobiles(bulkMobiles);
    if (!parsed.mobiles.length) {
      setBulkMessage("Enter at least one valid 10-digit mobile number.");
      return;
    }

    const existingMobiles = new Set(selectedEntries.map((entry) => normalizedMobile(entry.mobile)).filter(Boolean));
    const newMobiles = parsed.mobiles.filter((mobile) => !existingMobiles.has(mobile));
    const duplicateCount = parsed.mobiles.length - newMobiles.length;
    if (!newMobiles.length) {
      setBulkMessage(`No new attendance added. ${duplicateCount} number${duplicateCount === 1 ? " was" : "s were"} already present.`);
      return;
    }

    setBulkSaving(true);
    const now = new Date().toISOString();
    const manualEntries: AttendanceEntry[] = newMobiles.map((mobile) => {
      const registration = registrations.find((item) => (
        normalizedMobile(item.mobile) === mobile
        && (item.workshopId === selectedWorkshop.id || item.workshopTitle.trim().toLowerCase() === selectedWorkshop.name.trim().toLowerCase())
        && (!selectedSession.batch || !item.batch || normalizedBatch(item.batch) === normalizedBatch(selectedSession.batch))
      ));
      return {
        attendeeName: registration?.fullName || `Manual attendee • ${mobile.slice(-4)}`,
        batch: selectedSession.batch || selectedWorkshop.batch || "",
        checkInAt: now,
        city: registration?.city || "",
        email: registration?.email || "",
        id: `att-${selectedSession.id}-${mobile}`,
        mobile: `+91 ${mobile}`,
        sessionId: selectedSession.id,
        sessionSlug: selectedSession.slug,
        source: "manual",
        status: "checked_in",
        submittedAt: now,
        workshopId: selectedWorkshop.id,
        workshopName: selectedWorkshop.name
      };
    });
    const next = [...manualEntries, ...entries].slice(0, 20_000);
    setEntries(next);
    const saved = await saveLiveState({ attendanceEntries: next });
    setBulkSaving(false);
    if (!saved) {
      setBulkMessage("Attendance was saved on this device, but server sync failed. Please try again.");
      return;
    }
    setBulkMobiles("");
    setBulkMessage(`${manualEntries.length} added${duplicateCount ? `, ${duplicateCount} duplicate skipped` : ""}${parsed.invalid.length ? `, ${parsed.invalid.length} invalid skipped` : ""}.`);
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
          placeholder: meta.hasOptions || type === "heading" || type === "divider" ? undefined : meta.label,
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

  function duplicateField(id: string) {
    if (!selectedSession) return;
    const index = selectedSession.fields.findIndex((field) => field.id === id);
    if (index < 0) return;
    const source = selectedSession.fields[index];
    const copy: BuilderField = { ...source, id: generateId(), label: `${source.label} Copy`, role: undefined };
    const fields = [...selectedSession.fields];
    fields.splice(index + 1, 0, copy);
    updateSession({ fields });
  }

  function updateThemeImage(kind: "bannerUrl" | "logoUrl", file?: File) {
    if (!selectedSession || !file) return;
    setImageError("");
    if (!file.type.startsWith("image/")) {
      setImageError("Please select a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError("Image must be smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!value) return;
      const theme = selectedSession.theme ?? { accent: "#059669", align: "left", fieldRadius: "rounded", fontFamily: "Inter", fontSize: 16, titleBold: true, titleItalic: false };
      updateSession({ theme: { ...theme, [kind]: value } });
    };
    reader.onerror = () => setImageError("Image could not be loaded. Please try another file.");
    reader.readAsDataURL(file);
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
      new Set(displayedEntries.flatMap((entry) => Object.keys(entry.answers ?? {})))
    );
    const headers = ["Session", "Workshop", "Name", "Mobile", "Email", "City", "Submitted At", ...extraLabels];
    const rows = displayedEntries.map((entry) => [
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

  function exportComparisonCsv() {
    if (!selectedSession || !selectedWorkshop) return;
    const rows = comparisonFilter === "registered"
      ? comparison.registered.map((registration) => ({
          name: registration.fullName,
          mobile: normalizedMobile(registration.mobile),
          email: registration.email ?? "",
          city: registration.city ?? "",
          registeredAt: registration.createdAt,
          attendanceStatus: comparison.attended.some((item) => item.registration.id === registration.id) ? "Attended" : "Absent"
        }))
      : comparisonFilter === "attended"
        ? comparison.attended.map(({ attendance, registration }) => ({
            name: registration.fullName,
            mobile: normalizedMobile(registration.mobile),
            email: registration.email ?? "",
            city: registration.city ?? "",
            registeredAt: registration.createdAt,
            attendanceStatus: attendance.status || "checked_in"
          }))
        : comparisonFilter === "absent"
          ? comparison.absent.map((registration) => ({
              name: registration.fullName,
              mobile: normalizedMobile(registration.mobile),
              email: registration.email ?? "",
              city: registration.city ?? "",
              registeredAt: registration.createdAt,
              attendanceStatus: "Absent"
            }))
          : comparison.walkIns.map((attendance) => ({
              name: attendance.attendeeName,
              mobile: normalizedMobile(attendance.mobile),
              email: attendance.email ?? "",
              city: attendance.city ?? "",
              registeredAt: attendance.submittedAt,
              attendanceStatus: "Walk-in"
            }));
    const headers = ["Name", "Mobile", "Email", "City", "Workshop", "Batch", "Session", "Session Date", "Registered / Checked-in At", "Status"];
    const values = rows.map((row) => [
      row.name,
      row.mobile,
      row.email,
      row.city,
      selectedWorkshop.name,
      selectedSession.batch || selectedWorkshop.batch || "Main Batch",
      selectedSession.title,
      selectedSession.sessionDate,
      row.registeredAt ? new Date(row.registeredAt).toLocaleString("en-IN") : "",
      row.attendanceStatus
    ]);
    const escapeCell = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = `\uFEFF${[headers, ...values].map((row) => row.map(escapeCell).join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${comparisonFilter}-${selectedSession.slug}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPlatformShell activeLabel="Workshop Attendance" description="Create session-wise attendance forms and track who attended every workshop session." title="Workshop Attendance">
      <section className="min-w-0 space-y-3">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Attendance workspace</p>
              <h2 className="text-lg font-black text-slate-950">Choose workshop</h2>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search workshops"
                className="min-h-9 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search workshops"
                ref={workshopSearchRef}
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Clear workshop search"
                  className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700"
                  onClick={() => {
                    setQuery("");
                    workshopSearchRef.current?.focus();
                  }}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <span className="inline-flex min-h-9 items-center rounded-lg bg-slate-100 px-3 text-xs font-black tabular-nums text-slate-600">{workshops.length}</span>
          </div>
          <div className="mt-2 flex min-w-0 gap-1.5 overflow-x-auto pb-1">
              {filteredWorkshops.map((workshop) => {
                const count = sessions.filter((session) => session.workshopId === workshop.id).length;
                const active = selectedWorkshop?.id === workshop.id;
                return (
                  <button
                    aria-pressed={active}
                    className={`w-[210px] shrink-0 rounded-lg border px-3 py-2 text-left transition ${active ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    key={workshop.id}
                    onClick={() => {
                      setSelectedWorkshopId(workshop.id);
                      setSelectedSessionId(sessions.find((session) => session.workshopId === workshop.id)?.id || "");
                      setSessionView("responses");
                    }}
                    type="button"
                  >
                    <p className="truncate text-xs font-black">{workshop.name}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">{count} sessions</p>
                  </button>
                );
              })}
              {filteredWorkshops.length === 0 ? (
                <div className="w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center">
                  <Search className="mx-auto size-5 text-slate-300" />
                  <p className="mt-1.5 text-xs font-black text-slate-600">{workshops.length ? "No workshops found" : "No workshops created yet"}</p>
                  {workshops.length ? <button className="mt-1 text-xs font-black text-emerald-700 hover:text-emerald-800" onClick={() => { setQuery(""); workshopSearchRef.current?.focus(); }} type="button">Clear search</button> : <a className="mt-2 inline-flex min-h-8 items-center justify-center rounded-lg bg-slate-950 px-3 text-xs font-black text-white" href="/workshop-master">Create workshop</a>}
                </div>
              ) : null}
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center rounded-xl border border-slate-200 bg-slate-50/80 px-1 py-1.5 shadow-sm">
            <OperationalStat label="Workshops" value={workshops.length} />
            <OperationalStat label="Sessions" tone="info" value={sessions.length} />
            <OperationalStat label="Entries" tone="success" value={entries.length} />
            <OperationalStat label="Unique attendees" value={totalAttendees} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Session desk</p>
                <h2 className="mt-0.5 truncate text-lg font-black text-slate-950">{selectedWorkshop?.name || "Select workshop"}</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Build, share and review attendance sessions.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60" disabled={refreshing} onClick={refreshAttendance} type="button">
                  <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                {selectedSession ? <button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100" onClick={() => setSessionView(sessionView === "edit" ? "responses" : "edit")} type="button">{sessionView === "edit" ? <UsersRound className="size-3.5" /> : <Settings2 className="size-3.5" />}{sessionView === "edit" ? "Responses" : "Edit form"}</button> : null}
                <button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" disabled={!selectedWorkshop} onClick={() => createSession()} type="button">
                  <Plus className="size-3.5" />
                  Add session
                </button>
              </div>
            </div>

            {workshopSessions.length > 0 ? (
              <div className="mt-2 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-2">
                {workshopSessions.map((session) => (
                  <button
                    aria-pressed={selectedSession?.id === session.id}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs font-black ${selectedSession?.id === session.id ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    key={session.id}
                    onClick={() => { setSelectedSessionId(session.id); setSessionView("responses"); }}
                    type="button"
                  >
                    <span>{session.title}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">{formatDate(session.sessionDate)} · {entries.filter((entry) => entry.sessionId === session.id).length} responses</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                <CalendarDays className="mx-auto size-6 text-slate-300" />
                <p className="mt-2 text-xs font-black text-slate-700">No sessions yet</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">Create the first session to generate an attendance form.</p>
              </div>
            )}
          </div>

          {selectedSession && sessionView === "responses" ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Attendance & follow-up</p>
                  <h3 className="mt-0.5 truncate text-lg font-black text-slate-950">{selectedSession.title}</h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{formatDate(selectedSession.sessionDate)} · {selectedSession.facilitator || "Facilitator not set"} · {selectedSession.batch || "Main Batch"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-50" onClick={copyLink} type="button"><Copy className="size-3.5" />{copied ? "Copied" : "Copy link"}</button>
                  <a className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-50" href={link} rel="noreferrer" target="_blank"><ExternalLink className="size-3.5" />Open form</a>
                  <button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-2.5 text-[11px] font-black text-white hover:bg-slate-800" onClick={() => setSessionView("edit")} type="button"><Settings2 className="size-3.5" />Edit form</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center border-b border-slate-200 bg-slate-50/80 px-1 py-1.5">
                <OperationalStat label="Responses" value={selectedEntries.length} />
                <OperationalStat label="Visible" value={displayedEntries.length} />
                <OperationalStat label="Fields" tone="info" value={selectedSession.fields.length} />
                <OperationalStat label="Registered" value={comparison.registered.length} />
                <OperationalStat label="Attended" tone="success" value={comparison.attended.length} />
                <OperationalStat label="Absent" tone="danger" value={comparison.absent.length} />
                <OperationalStat label="Walk-ins" tone="warning" value={comparison.walkIns.length} />
                <OperationalStat label="Rate" suffix="%" tone="info" value={attendanceRate} />
              </div>

              <section aria-labelledby="attendance-follow-up-title" className="border-b border-slate-200 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-auto min-w-0">
                    <h4 className="text-sm font-black text-slate-950" id="attendance-follow-up-title">Registration comparison</h4>
                    <details className="mt-0.5 text-[11px] font-semibold text-slate-500">
                      <summary className="cursor-pointer font-bold text-slate-500 hover:text-slate-700">How matching works</summary>
                      <p className="mt-1 max-w-4xl leading-5">
                        Registrations received by {registrationCutoff ? registrationCutoff.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "the session date"} are included. Mobile matching ignores +91, 91, leading zero, spaces and hyphens.
                      </p>
                    </details>
                  </div>
                  <button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={comparison[comparisonFilter === "walk_ins" ? "walkIns" : comparisonFilter].length === 0} onClick={exportComparisonCsv} type="button">
                    <Download className="size-3.5" />
                    Export {comparisonFilter === "walk_ins" ? "walk-ins" : comparisonFilter}
                  </button>
                </div>

                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Attendance comparison scope">
                  {([
                    ["registered", "Registered", comparison.registered.length],
                    ["attended", "Attended", comparison.attended.length],
                    ["absent", "Absent", comparison.absent.length],
                    ["walk_ins", "Walk-ins", comparison.walkIns.length]
                  ] as Array<[ComparisonFilter, string, number]>).map(([value, label, count]) => (
                    <button aria-pressed={comparisonFilter === value} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-black ${comparisonFilter === value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} key={value} onClick={() => setComparisonFilter(value)} type="button">
                      {label} <span className="ml-1 opacity-70">{count}</span>
                    </button>
                  ))}
                </div>

                <ComparisonTable
                  comparison={comparison}
                  filter={comparisonFilter}
                  sessionTitle={selectedSession.title}
                  workshopName={selectedWorkshop?.name || selectedSession.workshopName}
                />
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/50 px-3 py-2">
                <div><h4 className="text-sm font-black text-slate-950">Attendance responses</h4><p className="text-[11px] font-semibold text-slate-500">Filter, review and export this session.</p></div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <AdvancedResponseFilters answerOptions={selectedAnswerOptions} filters={responseFilters} onChange={setResponseFilters} questions={attendanceQuestions} resultCount={displayedEntries.length} totalCount={selectedEntries.length} />
                  <DuplicateResponseFilter checked={hideDuplicates} onChange={setHideDuplicates} rawCount={filteredEntries.length} visibleCount={displayedEntries.length} />
                  <button aria-label="Export attendance CSV" className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={selectedEntries.length === 0} onClick={exportAttendanceCsv} title="Export attendance CSV" type="button"><Download className="size-3.5" /></button>
                </div>
              </div>

              {selectedEntries.length === 0 ? <div className="m-3 grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center"><div><UsersRound className="mx-auto size-7 text-slate-300" /><p className="mt-2 text-sm font-black text-slate-700">No attendance recorded yet</p><p className="mt-0.5 text-xs font-semibold text-slate-500">Share the public form link to start collecting responses.</p></div></div> : displayedEntries.length === 0 ? (
                <div className="m-3 grid min-h-28 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                  <div>
                    <Search className="mx-auto size-6 text-slate-300" />
                    <p className="mt-2 text-sm font-black text-slate-700">No responses match these filters</p>
                    <button className="mt-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800" onClick={() => { setResponseFilters({ ...emptyResponseFilters }); setHideDuplicates(false); }} type="button">Clear filters</button>
                  </div>
                </div>
              ) : (
                <div className="max-h-[420px] w-full overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <caption className="sr-only">Attendance responses for {selectedSession.title}</caption>
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Check-in</th><th className="px-3 py-2">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{displayedEntries.map((entry) => <tr className="hover:bg-slate-50" key={entry.id}><td className="px-3 py-2 font-bold text-slate-900">{entry.attendeeName}</td><td className="px-3 py-2 font-semibold text-slate-500">{entry.mobile}</td><td className="px-3 py-2"><select aria-label={`Attendance status for ${entry.attendeeName}`} className="min-h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700" onChange={(event) => updateEntry(entry.id, { status: event.target.value as AttendanceEntry["status"] })} value={entry.status || "checked_in"}><option value="checked_in">Checked In</option><option value="late">Late</option><option value="joined_zoom">Joined Zoom</option><option value="completed">Completed</option></select></td><td className="px-3 py-2 font-semibold text-slate-500">{entry.submittedAt ? new Date(entry.submittedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}</td><td className="px-3 py-2"><div className="flex gap-1.5"><button aria-label={`View ${entry.attendeeName} answers`} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white" onClick={() => setEntryDetail(entry)} type="button"><Eye className="size-3.5" /></button><button aria-label={`Delete ${entry.attendeeName} attendance`} className="grid size-8 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => setDeleteEntryTarget(entry)} type="button"><Trash2 className="size-3.5" /></button></div></td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          ) : selectedSession ? (
            <div className="grid min-w-0 gap-4 min-[1720px]:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">2 · Session Settings</p>
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
                      <div className="relative"><Video className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-10`} onChange={(event) => updateSession({ zoomJoinUrl: event.target.value })} placeholder="Zoom or TagMango redirect URL" type="url" value={selectedSession.zoomJoinUrl || ""} /></div>
                      <span className="mt-1.5 block text-xs font-semibold text-slate-400">Supports secure Zoom links and zoom.tagmango.com redirect links.</span>
                    </label>
                    <div className="grid gap-3 md:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
                      <NumberSetting label="Open before" max={30} onChange={(value) => updateSession({ openDaysBefore: value })} suffix="days" value={selectedSession.openDaysBefore ?? 0} />
                      <NumberSetting label="Open before" max={1440} onChange={(value) => updateSession({ openMinutesBefore: value })} suffix="min" value={selectedSession.openMinutesBefore ?? 60} />
                      <NumberSetting label="Late after" onChange={(value) => updateSession({ lateAfterMinutes: value })} suffix="min" value={selectedSession.lateAfterMinutes ?? 15} />
                      <NumberSetting label="Close after" onChange={(value) => updateSession({ closeMinutesAfter: value })} suffix="min" value={selectedSession.closeMinutesAfter ?? 120} />
                      <NumberSetting label="Zoom redirect" onChange={(value) => updateSession({ redirectDelaySeconds: value })} suffix="sec" value={selectedSession.redirectDelaySeconds ?? 3} />
                      <NumberSetting label="Min. duration" onChange={(value) => updateSession({ minimumDurationMinutes: value })} suffix="min" value={selectedSession.minimumDurationMinutes ?? 30} />
                    </div>
                    <label className="md:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-600">Success Message</span>
                      <input className={inputClass} onChange={(event) => updateSession({ successMessage: event.target.value })} value={selectedSession.successMessage || ""} />
                    </label>
                    <div className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 md:col-span-2 sm:grid-cols-2">
                      <label className="flex min-h-[52px] items-center justify-between gap-4 rounded-lg bg-white px-3 py-2">
                        <span><span className="block text-sm font-black text-slate-700">Allow multiple submissions</span><span className="block text-xs font-semibold text-slate-400">The same mobile number may submit more than once.</span></span>
                        <input checked={Boolean(selectedSession.allowDuplicate)} className="size-5 accent-indigo-600" onChange={(event) => updateSession({ allowDuplicate: event.target.checked })} type="checkbox" />
                      </label>
                      <NumberSetting label="Response limit" max={20000} onChange={(value) => updateSession({ responseLimit: value || undefined })} suffix="max" value={selectedSession.responseLimit ?? 0} />
                      <label className="sm:col-span-2"><span className="mb-2 block text-xs font-black text-slate-600">Closed / limit reached message</span><input className={inputClass} maxLength={300} onChange={(event) => updateSession({ closedMessage: event.target.value })} value={selectedSession.closedMessage ?? "This attendance form is no longer accepting responses."} /></label>
                    </div>
                    <label className="md:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-600">Message when Zoom link is not configured</span>
                      <textarea className={`${inputClass} resize-none`} onChange={(event) => updateSession({ noZoomMessage: event.target.value })} placeholder="Attendance is saved. The Zoom link has not been configured for this session." rows={2} value={selectedSession.noZoomMessage ?? "Attendance is saved. The Zoom link has not been configured for this session."} />
                      <span className="mt-1.5 block text-xs font-semibold text-slate-400">Shown after attendance is submitted when this session has no Zoom link.</span>
                    </label>
                    <label className="md:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-600">Form Description</span>
                      <textarea className={`${inputClass} resize-none`} onChange={(event) => updateSession({ description: event.target.value })} rows={3} value={selectedSession.description} />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">3 · Attendance Form Fields</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">{selectedSession.fields.length} fields</h3>
                    </div>
                    <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700">
                      <input checked={selectedSession.published} className="size-5 accent-emerald-600" onChange={(event) => updateSession({ published: event.target.checked })} type="checkbox" />
                      Published
                    </label>
                  </div>

                  <nav aria-label="Form builder sections" className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5 lg:grid-cols-4">
                    {([
                      ["build", LayoutTemplate, "Build"],
                      ["logic", Settings2, "Logic"],
                      ["design", Palette, "Design"],
                      ["share", BarChart3, "Share & Results"]
                    ] as const).map(([tab, Icon, label]) => (
                      <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${builderTab === tab ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} key={tab} onClick={() => setBuilderTab(tab)} type="button">
                        <Icon className="size-4" />{label}
                      </button>
                    ))}
                  </nav>

                  {builderTab === "build" || builderTab === "logic" ? <>
                  <div className="mt-4 space-y-3">
                    {selectedSession.fields.map((field, index) => (
                      <FieldEditor
                        allFields={selectedSession.fields}
                        field={field}
                        index={index}
                        key={field.id}
                        logicMode={builderTab === "logic"}
                        onChange={(patch) => updateField(field.id, patch)}
                        onDuplicate={() => duplicateField(field.id)}
                        onMove={moveField}
                        onRemove={() => removeField(field.id)}
                        total={selectedSession.fields.length}
                      />
                    ))}
                  </div>

                  {builderTab === "build" ? <div className="mt-5 flex flex-wrap gap-2">
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
                  </div> : null}
                  </> : null}

                  {builderTab === "design" ? (
                    <div className="mt-5 space-y-5">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Brand images</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <ThemeImageControl
                            description="Transparent PNG works best"
                            imageUrl={selectedSession.theme?.logoUrl}
                            label="Form logo"
                            onChange={(file) => updateThemeImage("logoUrl", file)}
                            onRemove={() => updateSession({ theme: { ...selectedSession.theme!, logoUrl: undefined } })}
                            variant="logo"
                          />
                          <ThemeImageControl
                            description="Recommended 1600 × 600 px"
                            imageUrl={selectedSession.theme?.bannerUrl}
                            label="Cover image"
                            onChange={(file) => updateThemeImage("bannerUrl", file)}
                            onRemove={() => updateSession({ theme: { ...selectedSession.theme!, bannerUrl: undefined } })}
                            variant="banner"
                          />
                        </div>
                        {imageError ? <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-600">{imageError}</p> : null}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Form experience</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {(["classic", "steps", "guided"] as const).map((mode) => <button className={`min-h-12 rounded-xl border px-3 text-sm font-black capitalize ${selectedSession.formMode === mode || (!selectedSession.formMode && mode === "classic") ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`} key={mode} onClick={() => updateSession({ formMode: mode })} type="button">{mode === "steps" ? "Multi-step" : mode}</button>)}
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label><span className="mb-2 block text-sm font-bold text-slate-600">Accent color</span><div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2"><input className="size-10" onChange={(event) => updateSession({ theme: { ...selectedSession.theme!, accent: event.target.value } })} type="color" value={selectedSession.theme?.accent || "#059669"} /><span className="text-sm font-black text-slate-600">{selectedSession.theme?.accent || "#059669"}</span></div></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-600">Page background</span><div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2"><input className="size-10" onChange={(event) => updateSession({ theme: { ...selectedSession.theme!, backgroundColor: event.target.value } })} type="color" value={selectedSession.theme?.backgroundColor || "#f1f5f9"} /><span className="text-sm font-black text-slate-600">{selectedSession.theme?.backgroundColor || "#f1f5f9"}</span></div></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-600">Font style</span><select className={inputClass} onChange={(event) => updateSession({ theme: { ...selectedSession.theme!, fontFamily: event.target.value } })} value={selectedSession.theme?.fontFamily || "Inter"}><option>Inter</option><option>Arial</option><option>Georgia</option><option>Trebuchet MS</option></select></label>
                        <label><span className="mb-2 block text-sm font-bold text-slate-600">Field corners</span><select className={inputClass} onChange={(event) => updateSession({ theme: { ...selectedSession.theme!, fieldRadius: event.target.value as "soft" | "rounded" | "square" } })} value={selectedSession.theme?.fieldRadius || "rounded"}><option value="rounded">Rounded</option><option value="soft">Soft</option><option value="square">Square</option></select></label>
                      </div>
                      <label><span className="mb-2 block text-sm font-bold text-slate-600">Submit button text</span><input className={inputClass} onChange={(event) => updateSession({ submitButtonText: event.target.value })} value={selectedSession.submitButtonText || "Mark Attendance"} /></label>
                    </div>
                  ) : null}

                  {builderTab === "share" ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <Metric label="Responses" value={selectedEntries.length} />
                      <Metric label="Completion" value={selectedEntries.length ? 100 : 0} />
                      <Metric label="Fields" value={selectedSession.fields.length} />
                      <button className="min-h-12 rounded-xl bg-slate-950 px-4 text-sm font-black text-white sm:col-span-3" onClick={copyLink} type="button"><Copy className="mr-2 inline size-4" />{copied ? "Link copied" : "Copy public form link"}</button>
                    </div>
                  ) : null}
                </div>
              </div>

              <aside className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Live Preview</p><h3 className="mt-1 text-xl font-black">Public form</h3></div><div className="flex rounded-lg bg-slate-100 p-1"><button aria-label="Desktop preview" className={`grid size-8 place-items-center rounded-md ${previewDevice === "desktop" ? "bg-white shadow-sm" : "text-slate-400"}`} onClick={() => setPreviewDevice("desktop")} type="button"><Laptop className="size-4" /></button><button aria-label="Mobile preview" className={`grid size-8 place-items-center rounded-md ${previewDevice === "mobile" ? "bg-white shadow-sm" : "text-slate-400"}`} onClick={() => setPreviewDevice("mobile")} type="button"><Smartphone className="size-4" /></button></div></div>
                  <AttendancePreview device={previewDevice} session={selectedSession} />
                </div>
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
                      <h3 className="mt-1 text-xl font-black text-slate-950">{displayedEntries.length} attendees</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled={selectedEntries.length === 0} onClick={exportAttendanceCsv} title="Export attendance CSV" type="button">
                        <Download className="size-4" />
                      </button>
                      <UsersRound className="size-7 text-slate-300" />
                    </div>
                  </div>
                  <details className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <summary className="cursor-pointer text-sm font-black text-emerald-900">Add attendance by mobile numbers in bulk</summary>
                    <p className="mt-2 text-xs font-semibold leading-5 text-emerald-800/80">Paste one mobile per line, or separate numbers with commas. Existing numbers in this session are skipped automatically.</p>
                    <textarea className="mt-3 min-h-32 w-full resize-none rounded-xl border border-emerald-200 bg-white px-3.5 py-3 font-mono text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" onChange={(event) => { setBulkMobiles(event.target.value); setBulkMessage(""); }} placeholder={"9876543210\n8765432109\n+91 76543 21098"} value={bulkMobiles} />
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-bold text-slate-600">{bulkMessage}</p>
                      <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={bulkSaving || !bulkMobiles.trim()} onClick={addBulkAttendance} type="button"><Plus className="size-4" />{bulkSaving ? "Adding..." : "Add attendance"}</button>
                    </div>
                  </details>
                  <div className="mt-4 flex flex-wrap justify-end gap-2"><AdvancedResponseFilters answerOptions={selectedAnswerOptions} filters={responseFilters} onChange={setResponseFilters} questions={attendanceQuestions} resultCount={displayedEntries.length} totalCount={selectedEntries.length} /><DuplicateResponseFilter checked={hideDuplicates} onChange={setHideDuplicates} rawCount={filteredEntries.length} visibleCount={displayedEntries.length} /></div>
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
                        {displayedEntries.map((entry) => (
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

function ComparisonTable({
  comparison,
  filter,
  sessionTitle,
  workshopName
}: {
  comparison: {
    registered: RegistrationEntry[];
    attended: Array<{ attendance: AttendanceEntry; registration: RegistrationEntry }>;
    absent: RegistrationEntry[];
    walkIns: AttendanceEntry[];
  };
  filter: ComparisonFilter;
  sessionTitle: string;
  workshopName: string;
}) {
  const registrations = filter === "registered" ? comparison.registered : filter === "absent" ? comparison.absent : [];
  const count = filter === "attended" ? comparison.attended.length : filter === "walk_ins" ? comparison.walkIns.length : registrations.length;
  const attendedRegistrationIds = new Set(comparison.attended.map((item) => item.registration.id));
  const followUpMessage = (name: string) => encodeURIComponent(`Hello ${name}, you registered for ${workshopName}, but we missed you in ${sessionTitle}. Please let us know if you need any help.`);

  if (count === 0) {
    return (
      <div className="mt-2 grid min-h-24 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
        <div><UserCheck className="mx-auto size-7 text-slate-300" /><p className="mt-2 text-sm font-black text-slate-700">No {filter === "walk_ins" ? "walk-ins" : filter} found</p></div>
      </div>
    );
  }

  return (
    <div className="mt-2 max-h-[340px] w-full overflow-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[840px] text-left text-xs">
        <caption className="sr-only">{filter === "walk_ins" ? "Walk-in" : filter} registration comparison</caption>
        <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-[0.1em] text-slate-500">
          <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">Email / City</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Follow-up</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filter === "attended" ? comparison.attended.map(({ attendance, registration }) => {
            const mobile = normalizedMobile(registration.mobile || attendance.mobile);
            return (
              <tr className="hover:bg-slate-50" key={registration.id}>
                <td className="px-3 py-2 font-bold text-slate-900">{registration.fullName || attendance.attendeeName}</td>
                <td className="px-3 py-2 font-semibold text-slate-600">{mobile || "-"}</td>
                <td className="px-3 py-2"><p className="font-semibold text-slate-600">{registration.email || attendance.email || "-"}</p><p className="mt-0.5 text-[11px] text-slate-400">{registration.city || attendance.city || "-"}</p></td>
                <td className="px-3 py-2"><StatusBadge label="Attended" tone="emerald" /></td>
                <td className="px-3 py-2 font-semibold text-slate-500">{attendance.submittedAt ? new Date(attendance.submittedAt).toLocaleString("en-IN") : "-"}</td>
                <td className="px-3 py-2"><ContactActions message={followUpMessage(registration.fullName)} mobile={mobile} name={registration.fullName} /></td>
              </tr>
            );
          }) : filter === "walk_ins" ? comparison.walkIns.map((attendance) => {
            const mobile = normalizedMobile(attendance.mobile);
            return (
              <tr className="hover:bg-slate-50" key={attendance.id}>
                <td className="px-3 py-2 font-bold text-slate-900">{attendance.attendeeName}</td>
                <td className="px-3 py-2 font-semibold text-slate-600">{mobile || "-"}</td>
                <td className="px-3 py-2"><p className="font-semibold text-slate-600">{attendance.email || "-"}</p><p className="mt-0.5 text-[11px] text-slate-400">{attendance.city || "-"}</p></td>
                <td className="px-3 py-2"><StatusBadge label="Walk-in" tone="amber" /></td>
                <td className="px-3 py-2 font-semibold text-slate-500">{attendance.submittedAt ? new Date(attendance.submittedAt).toLocaleString("en-IN") : "-"}</td>
                <td className="px-3 py-2"><ContactActions message={followUpMessage(attendance.attendeeName)} mobile={mobile} name={attendance.attendeeName} /></td>
              </tr>
            );
          }) : registrations.map((registration) => {
            const mobile = normalizedMobile(registration.mobile);
            const attended = attendedRegistrationIds.has(registration.id);
            return (
              <tr className="hover:bg-slate-50" key={registration.id}>
                <td className="px-3 py-2 font-bold text-slate-900">{registration.fullName}</td>
                <td className="px-3 py-2 font-semibold text-slate-600">{mobile || "-"}</td>
                <td className="px-3 py-2"><p className="font-semibold text-slate-600">{registration.email || "-"}</p><p className="mt-0.5 text-[11px] text-slate-400">{registration.city || "-"}</p></td>
                <td className="px-3 py-2"><StatusBadge label={attended ? "Attended" : "Absent"} tone={attended ? "emerald" : "rose"} /></td>
                <td className="px-3 py-2 font-semibold text-slate-500">{registration.createdAt ? new Date(registration.createdAt).toLocaleString("en-IN") : "-"}</td>
                <td className="px-3 py-2"><ContactActions message={followUpMessage(registration.fullName)} mobile={mobile} name={registration.fullName} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "amber" | "emerald" | "rose" }) {
  const tones = { amber: "bg-amber-50 text-amber-700", emerald: "bg-emerald-50 text-emerald-700", rose: "bg-rose-50 text-rose-700" };
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${tones[tone]}`}>{label}</span>;
}

function ContactActions({ message, mobile, name }: { message: string; mobile: string; name: string }) {
  if (!mobile) return <span className="text-xs font-semibold text-slate-400">No valid mobile</span>;
  return (
    <div className="flex gap-1.5">
      <a aria-label={`Call ${name}`} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" href={`tel:+91${mobile}`} title="Call"><Phone className="size-3.5" /></a>
      <a aria-label={`WhatsApp ${name}`} className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" href={`https://wa.me/91${mobile}?text=${message}`} rel="noreferrer" target="_blank" title="WhatsApp"><MessageCircle className="size-3.5" /></a>
    </div>
  );
}

function NumberSetting({ label, max, onChange, suffix, value }: { label: string; max?: number; onChange: (value: number) => void; suffix: string; value: number }) {
  return <label><span className="mb-2 block text-xs font-black text-slate-500">{label}</span><div className="flex border border-slate-200 bg-white"><input className="min-w-0 flex-1 px-3 py-2.5 text-sm font-bold outline-none" max={max} min={0} onChange={(event) => onChange(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(0, Number(event.target.value) || 0)))} type="number" value={value} /><span className="grid place-items-center border-l border-slate-200 px-2 text-[10px] font-black uppercase text-slate-400">{suffix}</span></div></label>;
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

function ThemeImageControl({ description, imageUrl, label, onChange, onRemove, variant }: { description: string; imageUrl?: string; label: string; onChange: (file?: File) => void; onRemove: () => void; variant: "logo" | "banner" }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className={`grid place-items-center bg-white ${variant === "banner" ? "aspect-[8/3]" : "h-32"}`}>
        {imageUrl ? <img alt={`${label} preview`} className={variant === "banner" ? "h-full w-full object-cover" : "max-h-24 max-w-[80%] object-contain"} src={imageUrl} /> : <div className="text-center text-slate-300"><ImageIcon className="mx-auto size-8" /><p className="mt-2 text-xs font-black">No image selected</p></div>}
      </div>
      <div className="p-3">
        <p className="text-sm font-black text-slate-800">{label}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-400">{description} · Max 2 MB</p>
        <div className="mt-3 flex gap-2">
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800"><Upload className="size-3.5" />{imageUrl ? "Replace" : "Upload"}<input accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { onChange(event.target.files?.[0]); event.target.value = ""; }} type="file" /></label>
          {imageUrl ? <button className="min-h-9 rounded-lg bg-rose-50 px-3 text-xs font-black text-rose-600 hover:bg-rose-100" onClick={onRemove} type="button">Remove</button> : null}
        </div>
      </div>
    </div>
  );
}

function AttendancePreview({ device, session }: { device: "desktop" | "mobile"; session: AttendanceSession }) {
  const accent = session.theme?.accent || "#059669";
  const radius = session.theme?.fieldRadius === "square" ? "rounded-none" : session.theme?.fieldRadius === "soft" ? "rounded-lg" : "rounded-xl";
  const fields = session.fields.filter((field) => !field.visibility).slice(0, device === "mobile" ? 5 : 6);
  return (
    <div className={`mx-auto mt-4 overflow-hidden border border-slate-200 bg-white shadow-sm transition-all ${device === "mobile" ? "max-w-[300px]" : "max-w-full"}`} style={{ fontFamily: session.theme?.fontFamily || "Inter", borderTop: `6px solid ${accent}` }}>
      {session.theme?.bannerUrl ? <img alt="Cover preview" className="aspect-[8/3] w-full object-cover" src={session.theme.bannerUrl} /> : null}
      <div className="p-4">{session.theme?.logoUrl ? <img alt="Logo preview" className="mb-3 max-h-12 max-w-[55%] object-contain" src={session.theme.logoUrl} /> : null}<p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>CFL Session Attendance</p><h4 className="mt-1 text-lg font-black leading-tight">{session.workshopName}</h4><p className="mt-1 text-xs font-bold text-slate-500">{session.title}</p></div>
      <div className={`grid gap-3 border-t border-slate-100 p-4 ${device === "desktop" ? "grid-cols-2" : "grid-cols-1"}`}>
        {fields.map((field) => field.type === "divider" ? <hr className="col-span-full border-slate-200" key={field.id} /> : field.type === "heading" ? <p className="col-span-full text-sm font-black" key={field.id}>{field.label}</p> : <div className={field.width === "full" ? "col-span-full" : ""} key={field.id}><p className="mb-1 text-[10px] font-black text-slate-600">{field.label}{field.required ? " *" : ""}</p><div className={`h-9 border border-slate-200 bg-slate-50 ${radius}`} /></div>)}
        <div aria-hidden="true" className={`col-span-full grid min-h-10 place-items-center text-xs font-black text-white ${radius}`} style={{ backgroundColor: accent }}>{session.submitButtonText || "Mark Attendance"}</div>
      </div>
    </div>
  );
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
  allFields,
  field,
  index,
  logicMode,
  onChange,
  onDuplicate,
  onMove,
  onRemove,
  total
}: {
  allFields: BuilderField[];
  field: BuilderField;
  index: number;
  logicMode: boolean;
  onChange: (patch: Partial<BuilderField>) => void;
  onDuplicate: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: () => void;
  total: number;
}) {
  const meta = fieldTypeMeta[field.type];
  const Icon = meta.icon;
  const locked = field.role === "name" || field.role === "mobile";
  const visibilitySources = allFields.slice(0, index).filter((item) => item.type !== "heading" && item.type !== "divider");
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[34px_minmax(0,1fr)] sm:items-start min-[1800px]:grid-cols-[34px_minmax(0,1fr)_150px_auto]">
        <span className="grid size-9 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><Icon className="size-4" /></span>
        <div className="space-y-2">
          <input className={inputClass} onChange={(event) => onChange({ label: event.target.value })} onKeyDown={(event) => event.stopPropagation()} placeholder="Field label" value={field.label} />
          {field.type !== "heading" && field.type !== "divider" ? (
            <input className={inputClass} onChange={(event) => onChange({ placeholder: event.target.value })} onKeyDown={(event) => event.stopPropagation()} placeholder="Placeholder text" value={field.placeholder ?? ""} />
          ) : null}
          {meta.hasOptions ? <OptionBoxes field={field} onChange={onChange} /> : null}
          {logicMode ? (
            <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-indigo-700">Display logic</p>
              <select className={inputClass} onChange={(event) => onChange({ visibility: event.target.value ? { fieldId: event.target.value, operator: "equals", value: "" } : undefined })} value={field.visibility?.fieldId || ""}><option value="">Always show this field</option>{visibilitySources.map((source) => <option key={source.id} value={source.id}>Show based on: {source.label}</option>)}</select>
              {field.visibility ? <div className="grid gap-2 sm:grid-cols-2"><select className={inputClass} onChange={(event) => onChange({ visibility: { ...field.visibility!, operator: event.target.value as BuilderVisibilityOperator } })} value={field.visibility.operator}><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="contains">Contains</option><option value="answered">Is answered</option><option value="not_answered">Is not answered</option></select>{field.visibility.operator !== "answered" && field.visibility.operator !== "not_answered" ? <input className={inputClass} onChange={(event) => onChange({ visibility: { ...field.visibility!, value: event.target.value } })} placeholder="Answer value" value={field.visibility.value || ""} /> : null}</div> : null}
            </div>
          ) : (
            <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-black text-slate-600">Validation & helper text</summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><input className={`${inputClass} sm:col-span-2`} onChange={(event) => onChange({ helpText: event.target.value })} placeholder="Helper text shown below field" value={field.helpText || ""} /><select className={inputClass} onChange={(event) => onChange({ width: event.target.value as "full" | "half" })} value={field.width || "half"}><option value="half">Half width</option><option value="full">Full width</option></select>{["short_text", "paragraph", "email", "mobile"].includes(field.type) ? <><input className={inputClass} min={0} onChange={(event) => onChange({ minLength: Number(event.target.value) || undefined })} placeholder="Minimum characters" type="number" value={field.minLength || ""} /><input className={inputClass} min={0} onChange={(event) => onChange({ maxLength: Number(event.target.value) || undefined })} placeholder="Maximum characters" type="number" value={field.maxLength || ""} /></> : null}{["number", "rating"].includes(field.type) ? <><input className={inputClass} onChange={(event) => onChange({ min: Number(event.target.value) })} placeholder="Minimum" type="number" value={field.min ?? ""} /><input className={inputClass} onChange={(event) => onChange({ max: Number(event.target.value) })} placeholder="Maximum" type="number" value={field.max ?? ""} /></> : null}</div></details>
          )}
        </div>
        <span className="rounded-lg bg-white px-3 py-2.5 text-center text-xs font-black text-slate-500 sm:col-start-2 min-[1800px]:col-start-auto">{meta.label}</span>
        <div className="flex flex-wrap items-center gap-2 sm:col-start-2 min-[1800px]:col-start-auto">
          {field.type !== "heading" && field.type !== "divider" ? (
            <label className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-600">
              <input checked={Boolean(field.required)} className="size-4 accent-emerald-600" disabled={locked} onChange={(event) => onChange({ required: event.target.checked })} type="checkbox" />
              Required
            </label>
          ) : null}
          <button className="grid size-9 place-items-center rounded-lg bg-white text-slate-500 hover:text-slate-900 disabled:opacity-30" disabled={index === 0} onClick={() => onMove(index, -1)} type="button"><ArrowUp className="size-4" /></button>
          <button className="grid size-9 place-items-center rounded-lg bg-white text-slate-500 hover:text-slate-900 disabled:opacity-30" disabled={index === total - 1} onClick={() => onMove(index, 1)} type="button"><ArrowDown className="size-4" /></button>
          <button aria-label="Duplicate field" className="grid size-9 place-items-center rounded-lg bg-white text-slate-500 hover:text-slate-900" onClick={onDuplicate} title="Duplicate field" type="button"><Copy className="size-4" /></button>
          <button className="grid size-9 place-items-center rounded-lg bg-white text-rose-400 hover:text-rose-600 disabled:opacity-30" disabled={locked} onClick={onRemove} type="button"><Trash2 className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}
