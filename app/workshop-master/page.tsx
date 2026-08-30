"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { isHeightField } from "@/components/height-input";
import { DuplicateResponseFilter } from "@/components/duplicate-response-filter";
import { AdvancedResponseFilters } from "@/components/advanced-response-filters";
import { WorkshopCohortCompare } from "@/components/workshop-cohort-compare";
import { MultiWorkshopOverlap } from "@/components/multi-workshop-overlap";
import { AlertCircle, Archive, ArrowDown, ArrowUp, BarChart3, Bold, CalendarDays, Check, CheckSquare, ChevronDown, Circle, Copy, Download, Edit3, ExternalLink, Eye, EyeOff, Files, Heading, Image, Italic, LayoutList, Link2, List, ListOrdered, Mail, MessageCircle, Monitor, Palette, PhoneCall, Plus, QrCode, RefreshCw, Route, Save, Search, Share2, Smartphone, Sparkles, Trash2, Type, Underline, Upload, UsersRound, X } from "lucide-react";
import { hydrateLiveState, readLocalArray, readLocalObject, saveLiveState } from "@/lib/live-state";
import { buildRegistrationUrl, normalizeBaseUrl } from "@/lib/registration-url";
import { publicFormSlug } from "@/lib/public-slug";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { hideDuplicateResponses, partitionDuplicateResponses } from "@/lib/response-dedupe";
import { activeResponseFilterCount, applyResponseFilters, emptyResponseFilters, responseQuestionOptions, type ResponseFilterState } from "@/lib/response-filters";
import type { AttendanceEntry, AttendanceSession, BuilderField, BuilderFieldType, BuilderForm, BuilderFormMode, BuilderTheme, FormAnalyticsRecord, RegistrationEntry, WorkshopBatch, WorkshopIntroductionSession } from "@/lib/types";
import { registrationMatchesBatch } from "@/lib/workshop-hierarchy";
import { generateId } from "@/lib/utils";
import { type ClipboardEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

type WorkshopRecord = {
  archived?: boolean;
  batch?: string;
  batches?: WorkshopBatch[];
  discountCodeEod?: string;
  discountDescription?: string;
  discountType?: DiscountType;
  discountValue?: string;
  feesWithTax?: string;
  id: string;
  isPartPaymentAllow?: boolean;
  name: string;
  maxOrderQty?: string;
  mfwEnrollmentEnabled?: boolean;
  mfwWorkshopEventId?: string;
  mfwWorkshopTitle?: string;
  minOrderQty?: string;
  minimumPartPayment?: string;
  orderQtyTitle?: string;
  type: string;
  facilitator: string;
  productGroup: string;
  isPaid: boolean;
  legacyBatchCount?: number;
  legacySource?: boolean;
  paymentUnknown?: boolean;
  transferLeadToCrm?: boolean;
};

function registrationWhatsAppStatus(entry: RegistrationEntry) {
  if (entry.registrationStatus !== "waiting") return entry.confirmationWhatsappStatus ?? (entry.confirmationWhatsappSentAt ? "sent" : "not sent");
  const participantStatus = entry.waitingWhatsappStatus ?? (entry.waitingWhatsappSentAt ? "sent" : "not sent");
  if (!entry.referralCodeId) return participantStatus;
  const referrerStatus = entry.referrerWaitingWhatsappStatus ?? (entry.referrerWaitingWhatsappSentAt ? "sent" : "not sent");
  if (participantStatus === "sent" && referrerStatus === "sent") return "sent";
  if (participantStatus === "failed" || referrerStatus === "failed") return "failed";
  return participantStatus === "not_configured" || referrerStatus === "not_configured" ? "not_configured" : "not sent";
}
type DiscountType = "percent" | "flat";
type RegistrationLinkConfig = {
  batch?: string;
  customBaseUrl?: string;
  facilitator?: string;
  fee?: number;
  id?: string;
  otpRequired?: boolean;
  paid?: boolean;
  partPayment?: boolean;
  publishUntil?: string;
  published?: boolean;
  slug?: string;
  title?: string;
  venue?: string;
};

const STORAGE_KEY = "cfl_workshop_master_records_v1";
const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const FORMS_STORAGE_KEY = "cfl_forms_v1";
const REGISTRATION_LINK_CONFIG_STORAGE_KEY = "cfl_registration_link_configs_v1";
const WORKSHOP_TYPES_STORAGE_KEY = "cfl_workshop_types_v1";
const FACILITATORS_STORAGE_KEY = "cfl_facilitators_v1";
const WORKSHOP_RESPONSE_FILTERS_STORAGE_KEY = "cfl_workshop_response_filters_v1";
const IMAGE_QUALITY = 0.7;
const MAX_LOGO_WIDTH = 240;
const BRAND_LOGO_SRC = "/brand/coach-for-life-logo-horizontal.png";
const defaultWorkshopTypes = ["1-2-1 Coaching", "Workshop", "Online Event", "Offline Event", "Hybrid Program"];
const defaultFacilitators = ["Dr Luv Patel"];
const productGroups = ["Health", "Spiritual", "Leadership", "Sales", "Fitness", "Business Growth"];
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const defaultTheme: BuilderTheme = {
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontSize: 16,
  accent: "#059669",
  titleBold: true,
  titleItalic: false,
  align: "left",
  backgroundColor: "#f1f5f9",
  surfaceColor: "#ffffff",
  fieldRadius: "rounded",
  logoAlign: "center",
  logoSize: 140
};
const themePresets: Array<{ accent: string; backgroundColor: string; label: string; surfaceColor: string }> = [
  { accent: "#059669", backgroundColor: "#f1f5f9", label: "CFL Green", surfaceColor: "#ffffff" },
  { accent: "#2563eb", backgroundColor: "#eff6ff", label: "Ocean", surfaceColor: "#ffffff" },
  { accent: "#0f172a", backgroundColor: "#e2e8f0", label: "Executive", surfaceColor: "#ffffff" },
  { accent: "#e11d48", backgroundColor: "#fff1f2", label: "Celebration", surfaceColor: "#ffffff" }
];
const formFonts = [
  { label: "Modern", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Friendly", value: "Nunito, Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Editorial", value: "Georgia, Cambria, serif" }
];
const fieldTypeMeta: Record<BuilderFieldType, { label: string; hasOptions: boolean }> = {
  short_text: { label: "Short Text", hasOptions: false },
  paragraph: { label: "Paragraph", hasOptions: false },
  email: { label: "Email", hasOptions: false },
  mobile: { label: "Mobile", hasOptions: false },
  number: { label: "Number", hasOptions: false },
  height: { label: "Height", hasOptions: false },
  date: { label: "Date", hasOptions: false },
  time: { label: "Time", hasOptions: false },
  dropdown: { label: "Dropdown", hasOptions: true },
  radio: { label: "Multiple Choice", hasOptions: true },
  checkbox: { label: "Checkboxes", hasOptions: true },
  yes_no: { label: "Yes / No", hasOptions: false },
  rating: { label: "Rating", hasOptions: false },
  consent: { label: "Consent", hasOptions: false },
  heading: { label: "Section Heading", hasOptions: false },
  divider: { label: "Divider", hasOptions: false }
};
const addableTypes: BuilderFieldType[] = ["short_text", "paragraph", "email", "mobile", "number", "height", "date", "dropdown", "radio", "checkbox", "heading"];
const richTextColors = ["#0f172a", "#059669", "#4f46e5", "#dc2626", "#ea580c", "#7c3aed"];

function defaultBuilderFields(): BuilderField[] {
  return [
    { id: generateId(), type: "short_text", label: "Full Name", placeholder: "Your full name", required: true, role: "name" },
    { id: generateId(), type: "mobile", label: "Mobile Number", placeholder: "10-digit mobile", required: true, role: "mobile" },
    { id: generateId(), type: "email", label: "Email", placeholder: "you@example.com", required: false, role: "email" },
    { id: generateId(), type: "short_text", label: "City", placeholder: "Your city", required: false, role: "city" }
  ];
}

function normalizeCoreFieldRequirements(fields: BuilderField[]) {
  return fields.map((field) => {
    if (field.role === "name" || field.role === "mobile") return { ...field, required: true };
    if (field.role === "email" || field.role === "city") return { ...field, required: false };
    return field;
  });
}

export default function WorkshopMasterPage() {
  const [showData, setShowData] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [group, setGroup] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [batch, setBatch] = useState("");
  const [feesWithTax, setFeesWithTax] = useState("");
  const [isPartPaymentAllow, setIsPartPaymentAllow] = useState(false);
  const [minimumPartPayment, setMinimumPartPayment] = useState("");
  const [discountCodeEod, setDiscountCodeEod] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountDescription, setDiscountDescription] = useState("");
  const [orderQtyTitle, setOrderQtyTitle] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("");
  const [maxOrderQty, setMaxOrderQty] = useState("");
  const [transferLeadToCrm, setTransferLeadToCrm] = useState(false);
  const [mfwEnrollmentEnabled, setMfwEnrollmentEnabled] = useState(false);
  const [mfwWorkshopEventId, setMfwWorkshopEventId] = useState("");
  const [mfwWorkshopTitle, setMfwWorkshopTitle] = useState("");
  const [mfwWorkshops, setMfwWorkshops] = useState<Array<{ id: string; title: string }>>([]);
  const [mfwLoading, setMfwLoading] = useState(false);
  const [mfwError, setMfwError] = useState("");
  const [records, setRecords] = useState<WorkshopRecord[]>([]);
  const [workshopTypes, setWorkshopTypes] = useState<string[]>(defaultWorkshopTypes);
  const [facilitators, setFacilitators] = useState<string[]>(defaultFacilitators);
  const [formTitle, setFormTitle] = useState("Workshop Registration");
  const [formTagline, setFormTagline] = useState("");
  const [formDescription, setFormDescription] = useState("Please fill in your details to confirm your seat.");
  const [formSubmitButtonText, setFormSubmitButtonText] = useState("Confirm Registration");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formMode, setFormMode] = useState<BuilderFormMode>("classic");
  const [formTheme, setFormTheme] = useState<BuilderTheme>(defaultTheme);
  const [formFields, setFormFields] = useState<BuilderField[]>(defaultBuilderFields);
  const [formHighlights, setFormHighlights] = useState<string[]>([]);
  const [formOtpRequired, setFormOtpRequired] = useState(false);
  const [formRequireAttendanceForConfirmation, setFormRequireAttendanceForConfirmation] = useState(false);
  const [formRequiredAttendanceSessionId, setFormRequiredAttendanceSessionId] = useState("");
  const [formWaitingMode, setFormWaitingMode] = useState(false);
  const [formRegistrationCapacity, setFormRegistrationCapacity] = useState("");
  const [formWaitingTitle, setFormWaitingTitle] = useState("Waiting List Registration");
  const [formWaitingMessage, setFormWaitingMessage] = useState("Seats are currently full. Your registration will be added to the waiting list.");
  const [formRepeaterSourceWorkshopIds, setFormRepeaterSourceWorkshopIds] = useState<string[]>([]);
  const [repeaterWorkshopQuery, setRepeaterWorkshopQuery] = useState("");
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("");
  const [whatsappConfirmationEnabled, setWhatsappConfirmationEnabled] = useState(false);
  const [whatsappConfirmationTemplate, setWhatsappConfirmationTemplate] = useState("");
  const [whatsappWaitingTemplate, setWhatsappWaitingTemplate] = useState("");
  const [whatsappReferrerWaitingTemplate, setWhatsappReferrerWaitingTemplate] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [recordScope, setRecordScope] = useState<"all" | "active" | "historical">("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [selectedParticipantBatchId, setSelectedParticipantBatchId] = useState("all");
  const [showParticipants, setShowParticipants] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [formAnalytics, setFormAnalytics] = useState<FormAnalyticsRecord[]>([]);
  const [linkWorkshop, setLinkWorkshop] = useState<WorkshopRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkshopRecord | null>(null);
  const [deleteResponseTarget, setDeleteResponseTarget] = useState<RegistrationEntry | null>(null);
  const [removeDuplicatesOpen, setRemoveDuplicatesOpen] = useState(false);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const [hideDuplicateParticipants, setHideDuplicateParticipants] = useState(false);
  const [hideWaitingParticipants, setHideWaitingParticipants] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [responseFilters, setResponseFilters] = useState<ResponseFilterState>({ ...emptyResponseFilters });
  const [followUpScope, setFollowUpScope] = useState<"needs_follow_up" | "completed" | "waiting" | "all">("needs_follow_up");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [followUpTarget, setFollowUpTarget] = useState<RegistrationEntry | null>(null);
  const [shareSelectedOpen, setShareSelectedOpen] = useState(false);
  const [promoteWaitingOpen, setPromoteWaitingOpen] = useState(false);
  const [promotingWaiting, setPromotingWaiting] = useState(false);

  useEffect(() => {
    function loadLocal() {
      setRecords(readLocalArray<WorkshopRecord>(STORAGE_KEY));
      setWorkshopTypes(readMasterNames(WORKSHOP_TYPES_STORAGE_KEY, defaultWorkshopTypes));
      setFacilitators(readMasterNames(FACILITATORS_STORAGE_KEY, defaultFacilitators));
      setRegistrations(readLocalArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY));
      setAttendanceEntries(readLocalArray<AttendanceEntry>("cfl_attendance_entries_v1"));
      setAttendanceSessions(readLocalArray<AttendanceSession>("cfl_attendance_sessions_v1"));
      setFormAnalytics(readLocalArray<FormAnalyticsRecord>("cfl_form_analytics_v1"));
    }

    loadLocal();
    hydrateLiveState().then(loadLocal);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let etag = "";

    function loadRegistrationsFromStorage(event?: StorageEvent) {
      if (event && event.key !== REGISTRATION_STORAGE_KEY) return;
      setRegistrations(readLocalArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY));
    }

    async function syncRegistrations() {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const response = await fetch("/api/registrations/live", {
          cache: "no-store",
          headers: etag ? { "If-None-Match": etag } : undefined
        });
        if (response.status === 304 || !response.ok || cancelled) return;
        const state = await response.json() as { dbEnabled?: boolean; registrations?: RegistrationEntry[] };
        if (!state.dbEnabled || !Array.isArray(state.registrations)) return;
        etag = response.headers.get("etag") ?? "";
        window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(state.registrations));
        setRegistrations(state.registrations);
      } catch {
        // Keep the last successful list visible while the next sync retries.
      } finally {
        inFlight = false;
      }
    }

    function syncWhenVisible() {
      if (!document.hidden) void syncRegistrations();
    }

    void syncRegistrations();
    const interval = window.setInterval(syncRegistrations, 4000);
    window.addEventListener("storage", loadRegistrationsFromStorage);
    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("storage", loadRegistrationsFromStorage);
      window.removeEventListener("focus", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, []);

  const progress = useMemo(() => Math.round(([name, type, facilitator, group].filter(Boolean).length / 4) * 100), [facilitator, group, name, type]);
  const filteredRecords = useMemo(() => {
    const value = search.trim().toLowerCase();
    return records.filter((record) => {
      if (recordScope === "active" && record.archived) return false;
      if (recordScope === "historical" && !record.archived) return false;
      if (!value) return true;
      return (
      [record.name, record.type, record.facilitator, record.productGroup, record.isPaid ? "paid" : "free"].some((item) =>
        item.toLowerCase().includes(value)
      )
      );
    });
  }, [recordScope, records, search]);
  const paidCount = records.filter((record) => record.isPaid).length;
  const freeCount = records.filter((record) => !record.isPaid && !record.paymentUnknown).length;
  const historicalCount = records.filter((record) => record.archived).length;
  const selectedWorkshop = records.find((record) => record.id === selectedWorkshopId) ?? null;
  const editingAnalytics = editingId
    ? formAnalytics.find((item) => item.workshopId === editingId || item.formId === `form-${editingId}-main`) ?? null
    : null;
  const selectedParticipants = useMemo(() => {
    if (!selectedWorkshop) return [];
    const exactMatches = registrations.filter((entry) => entry.workshopId === selectedWorkshop.id);
    const workshopMatches = exactMatches.length
      ? exactMatches
      : registrations.filter((entry) => entry.workshopTitle.trim().toLowerCase() === selectedWorkshop.name.trim().toLowerCase());
    if (selectedParticipantBatchId === "all") return workshopMatches;
    const selectedBatch = selectedWorkshop.batches?.find((item) => item.id === selectedParticipantBatchId);
    return selectedBatch ? workshopMatches.filter((entry) => registrationMatchesBatch(entry, selectedBatch)) : workshopMatches;
  }, [registrations, selectedParticipantBatchId, selectedWorkshop]);
  const waitingParticipants = useMemo(() => selectedParticipants
    .filter((entry) => entry.registrationStatus === "waiting")
    .sort((first, second) => (first.waitingPosition ?? Number.MAX_SAFE_INTEGER) - (second.waitingPosition ?? Number.MAX_SAFE_INTEGER)), [selectedParticipants]);
  const selectedWaitingParticipants = useMemo(() => waitingParticipants.filter((entry) => selectedParticipantIds.includes(entry.id)), [selectedParticipantIds, waitingParticipants]);
  const duplicateParticipantIds = useMemo(() => {
    const { duplicates } = partitionDuplicateResponses(selectedParticipants, {
      email: (entry) => entry.email,
      mobile: (entry) => entry.mobile,
      name: (entry) => entry.fullName,
      scope: (entry) => entry.workshopId || entry.workshopTitle,
      submittedAt: (entry) => entry.createdAt
    });
    return duplicates.map((entry) => entry.id);
  }, [selectedParticipants]);
  const participantFilterRecords = useMemo(() => selectedParticipants.map((entry) => ({
    ...entry,
    answers: {
      ...(entry.answers ?? {}),
      "Full Name": entry.fullName,
      Mobile: entry.mobile,
      Email: entry.email,
      City: entry.city,
      "Payment Status": entry.status,
      Source: entry.source ?? "Registration Link"
    },
    submittedAt: entry.createdAt
  })), [selectedParticipants]);
  const filteredParticipants = useMemo(() => applyResponseFilters(participantFilterRecords, responseFilters), [participantFilterRecords, responseFilters]);
  const searchedParticipants = useMemo(() => {
    const query = participantSearch.trim().toLowerCase();
    if (!query) return filteredParticipants;
    const digits = query.replace(/\D/g, "");
    return filteredParticipants.filter((entry) =>
      entry.fullName.toLowerCase().includes(query) ||
      (digits.length > 0 && entry.mobile.replace(/\D/g, "").includes(digits))
    );
  }, [filteredParticipants, participantSearch]);
  const followUpParticipants = useMemo(() => searchedParticipants.filter((entry) => {
    if (followUpScope === "waiting") return entry.registrationStatus === "waiting";
    const completed = Boolean(entry.confirmationStatus && entry.confirmationStatus !== "pending" && entry.confirmationNote?.trim());
    if (followUpScope === "completed") return completed;
    if (followUpScope === "needs_follow_up") return !completed;
    return true;
  }), [followUpScope, searchedParticipants]);
  const displayedParticipants = useMemo(() => {
    const withoutWaiting = hideWaitingParticipants
      ? followUpParticipants.filter((entry) => entry.registrationStatus !== "waiting")
      : followUpParticipants;
    const visibleParticipants = hideDuplicateParticipants ? hideDuplicateResponses(withoutWaiting, {
      email: (entry) => entry.email,
      mobile: (entry) => entry.mobile,
      name: (entry) => entry.fullName,
      scope: (entry) => entry.workshopId || entry.workshopTitle,
      submittedAt: (entry) => entry.createdAt
    }) : withoutWaiting;

    return [...visibleParticipants].sort((first, second) =>
      submittedAtTimestamp(second.createdAt) - submittedAtTimestamp(first.createdAt)
    );
  }, [followUpParticipants, hideDuplicateParticipants, hideWaitingParticipants]);
  const participantQuestions = useMemo(() => responseQuestionOptions(participantFilterRecords), [participantFilterRecords]);
  const activeParticipantFilterCount = activeResponseFilterCount(responseFilters) + Number(hideDuplicateParticipants) + Number(hideWaitingParticipants);

  useEffect(() => {
    if (!selectedWorkshopId) return;
    try {
      const saved = readLocalObject<Record<string, { filters?: ResponseFilterState; hideDuplicates?: boolean; hideWaiting?: boolean; showParticipants?: boolean }>>(WORKSHOP_RESPONSE_FILTERS_STORAGE_KEY);
      window.localStorage.setItem(WORKSHOP_RESPONSE_FILTERS_STORAGE_KEY, JSON.stringify({
        ...saved,
        [selectedWorkshopId]: {
          filters: responseFilters,
          hideDuplicates: hideDuplicateParticipants,
          hideWaiting: hideWaitingParticipants,
          showParticipants
        }
      }));
    } catch {
      // Filters are convenience state; ignore storage issues.
    }
  }, [hideDuplicateParticipants, hideWaitingParticipants, responseFilters, selectedWorkshopId, showParticipants]);

  useEffect(() => {
    if (!selectedWorkshop) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedWorkshopId(null);
      setSelectedParticipantBatchId("all");
      setShowParticipants(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedWorkshopId]);

  async function saveRecords(next: WorkshopRecord[]) {
    setRecords(next);
    return saveLiveState({ workshops: next });
  }

  async function loadMfwWorkshops() {
    setMfwLoading(true);
    setMfwError("");
    try {
      const response = await fetch("/api/integrations/mfw/workshops", { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as { error?: string; workshops?: Array<{ id: string; title: string }> };
      if (!response.ok) throw new Error(result.error || "Could not load MFW workshops.");
      setMfwWorkshops(Array.isArray(result.workshops) ? result.workshops : []);
    } catch (error) {
      setMfwError(error instanceof Error ? error.message : "Could not load MFW workshops.");
    } finally {
      setMfwLoading(false);
    }
  }

  useEffect(() => {
    if (mfwEnrollmentEnabled) void loadMfwWorkshops();
  }, [mfwEnrollmentEnabled]);

  function clearForm(clearMessage = true) {
    setName("");
    setType("");
    setFacilitator("");
    setGroup("");
    setIsPaid(false);
    setBatch("");
    setFeesWithTax("");
    setIsPartPaymentAllow(false);
    setMinimumPartPayment("");
    setDiscountCodeEod("");
    setDiscountType("percent");
    setDiscountValue("");
    setDiscountDescription("");
    setOrderQtyTitle("");
    setMinOrderQty("");
    setMaxOrderQty("");
    setTransferLeadToCrm(false);
    setMfwEnrollmentEnabled(false);
    setMfwWorkshopEventId("");
    setMfwWorkshopTitle("");
    setMfwError("");
    resetBuilderForm();
    if (clearMessage) setMessage("");
    setEditingId(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !type || !facilitator || !group) {
      setMessage("Please fill Workshop Name, Type, Facilitator and Product Group.");
      return;
    }
    if (mfwEnrollmentEnabled && !mfwWorkshopEventId) {
      setMessage("Please select an MFW workshop or turn off MFW enrollment.");
      return;
    }
    if (formRequireAttendanceForConfirmation && !formRequiredAttendanceSessionId) {
      setMessage("Please select the required attendance form or turn off attendance confirmation.");
      return;
    }
    if (editingId) {
      const updatedRecord = buildWorkshopRecord(editingId);
      const nextRecords = records.map((record) => record.id === editingId ? updatedRecord : record);
      const [recordsSaved, formSaved] = await Promise.all([saveRecords(nextRecords), saveBuilderForm(updatedRecord)]);
      setMessage(recordsSaved && formSaved ? "Workshop updated successfully. Changes are saved." : "Workshop updated locally, but server sync failed. Please try Update again.");
      setShowData(false);
      return;
    } else {
      const newRecord = buildWorkshopRecord(generateId());
      const [recordsSaved, formSaved] = await Promise.all([saveRecords([newRecord, ...records]), saveBuilderForm(newRecord)]);
      setMessage(recordsSaved && formSaved ? "Workshop saved successfully." : "Workshop saved locally, but server sync failed. Please try Save again.");
    }
    clearForm(false);
    setShowData(true);
  }

  function editRecord(record: WorkshopRecord) {
    setName(record.name);
    setType(record.type);
    setFacilitator(record.facilitator);
    setGroup(record.productGroup);
    setIsPaid(record.isPaid);
    setBatch(record.batch ?? "");
    setFeesWithTax(record.feesWithTax ?? "");
    setIsPartPaymentAllow(Boolean(record.isPartPaymentAllow));
    setMinimumPartPayment(record.minimumPartPayment ?? "");
    setDiscountCodeEod(record.discountCodeEod ?? "");
    setDiscountType(record.discountType ?? "percent");
    setDiscountValue(record.discountValue ?? "");
    setDiscountDescription(record.discountDescription ?? "");
    setOrderQtyTitle(record.orderQtyTitle ?? "");
    setMinOrderQty(record.minOrderQty ?? "");
    setMaxOrderQty(record.maxOrderQty ?? "");
    setTransferLeadToCrm(Boolean(record.transferLeadToCrm));
    setMfwEnrollmentEnabled(Boolean(record.mfwEnrollmentEnabled));
    setMfwWorkshopEventId(record.mfwWorkshopEventId ?? "");
    setMfwWorkshopTitle(record.mfwWorkshopTitle ?? "");
    setEditingId(record.id);
    loadBuilderForm(record);
    setShowData(false);
    setSelectedWorkshopId(null);
    setShowParticipants(false);
    setMessage("Editing selected workshop.");
    window.requestAnimationFrame(() => window.scrollTo({ behavior: "smooth", top: 0 }));
  }

  function startDraftFromRecord(record: WorkshopRecord, mode: "full" | "form-only" = "full") {
    if (mode === "full") {
      setName(`${record.name} Copy`);
      setType(record.type);
      setFacilitator(record.facilitator);
      setGroup(record.productGroup);
      setIsPaid(record.isPaid);
      setBatch(record.batch ?? "");
      setFeesWithTax(record.feesWithTax ?? "");
      setIsPartPaymentAllow(Boolean(record.isPartPaymentAllow));
      setMinimumPartPayment(record.minimumPartPayment ?? "");
      setDiscountCodeEod(record.discountCodeEod ?? "");
      setDiscountType(record.discountType ?? "percent");
      setDiscountValue(record.discountValue ?? "");
      setDiscountDescription(record.discountDescription ?? "");
      setOrderQtyTitle(record.orderQtyTitle ?? "");
      setMinOrderQty(record.minOrderQty ?? "");
      setMaxOrderQty(record.maxOrderQty ?? "");
      setTransferLeadToCrm(Boolean(record.transferLeadToCrm));
      setMfwEnrollmentEnabled(false);
      setMfwWorkshopEventId("");
      setMfwWorkshopTitle("");
    }
    loadBuilderForm(record);
    setEditingId(null);
    setShowData(false);
    setSelectedWorkshopId(null);
    setShowParticipants(false);
    setMessage(mode === "full" ? "Duplicated as a new draft. Change the name and click Save." : "Copied this registration form into a new draft. Fill workshop details and click Save.");
    window.requestAnimationFrame(() => window.scrollTo({ behavior: "smooth", top: 0 }));
  }

  function duplicateCurrentFormDraft() {
    setName(name ? `${name} Copy` : "");
    setEditingId(null);
    setMessage("Current form duplicated as a new draft. Update workshop details and click Save.");
    window.requestAnimationFrame(() => window.scrollTo({ behavior: "smooth", top: 0 }));
  }

  async function openWorkshop(record: WorkshopRecord) {
    setRegistrations(readLocalArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY));
    setSelectedParticipantBatchId("all");
    setParticipantSearch("");
    setFollowUpScope("needs_follow_up");
    setSelectedParticipantIds([]);
    try {
      const saved = readLocalObject<Record<string, { filters?: ResponseFilterState; hideDuplicates?: boolean; hideWaiting?: boolean; showParticipants?: boolean }>>(WORKSHOP_RESPONSE_FILTERS_STORAGE_KEY);
      const workshopState = saved[record.id];
      const hideWaiting = Boolean(workshopState?.hideWaiting);
      setResponseFilters({ ...emptyResponseFilters, ...(workshopState?.filters ?? {}) });
      setHideDuplicateParticipants(Boolean(workshopState?.hideDuplicates));
      setHideWaitingParticipants(hideWaiting);
      setFollowUpScope(hideWaiting ? "all" : "needs_follow_up");
      setShowParticipants(true);
    } catch {
      setResponseFilters({ ...emptyResponseFilters });
      setHideDuplicateParticipants(false);
      setHideWaitingParticipants(false);
      setShowParticipants(true);
    }
    setSelectedWorkshopId(record.id);
    try {
      const response = await fetch("/api/crm/registrations/sync", {
        body: JSON.stringify({ workshopId: record.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) return;
      const result = await response.json() as { recovered?: number; registrations?: RegistrationEntry[] };
      if (Array.isArray(result.registrations)) {
        setRegistrations(result.registrations);
        window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(result.registrations));
      }
      if (result.recovered) setMessage(`${result.recovered} imported registrations restored and synced.`);
    } catch {
      // Keep locally available registrations visible if CRM recovery is unavailable.
    }
  }

  function deleteRecord(id: string) {
    saveRecords(records.filter((record) => record.id !== id));
    deleteBuilderForm(id);
    if (selectedWorkshopId === id) setSelectedWorkshopId(null);
    setDeleteTarget(null);
    setMessage("Workshop deleted.");
  }

  async function deleteRegistrationResponse(id: string) {
    const response = await fetch("/api/crm/registrations/sync", {
      body: JSON.stringify({ ids: [id] }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE"
    });
    const result = response.ok ? await response.json() as { registrations?: RegistrationEntry[] } : null;
    const next = Array.isArray(result?.registrations)
      ? result.registrations
      : registrations.filter((entry) => entry.id !== id);
    setRegistrations(next);
    window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(next));
    setDeleteResponseTarget(null);
    setMessage("Registration response deleted.");
    if (!response.ok) await saveLiveState({ registrations: next });
  }

  async function updateRegistrationFollowUp(status: RegistrationEntry["confirmationStatus"], note: string) {
    if (!followUpTarget || !status) return;
    const response = await fetch("/api/admin/registration-follow-up", {
      body: JSON.stringify({ registrationId: followUpTarget.id, status, note }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
    const result = await response.json().catch(() => ({})) as { error?: string; registration?: RegistrationEntry };
    if (!response.ok || !result.registration) throw new Error(result.error || "Could not update follow-up.");
    const next = registrations.map((entry) => entry.id === result.registration?.id ? result.registration : entry);
    setRegistrations(next);
    window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(next));
    setFollowUpTarget(null);
    setMessage(result.registration.mfwSyncStatus === "synced"
      ? "Confirmation updated and participant enrolled in MFW."
      : result.registration.mfwSyncStatus === "failed"
        ? `Confirmation updated. MFW enrollment needs retry: ${result.registration.mfwSyncError || "Sync failed."}`
        : "Confirmation and call note updated.");
  }

  async function removeDuplicateRegistrationResponses() {
    if (!duplicateParticipantIds.length || removingDuplicates) return;
    setRemovingDuplicates(true);
    try {
      const response = await fetch("/api/crm/registrations/sync", {
        body: JSON.stringify({ ids: duplicateParticipantIds }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Remove request failed.");
      const result = await response.json() as { registrations?: RegistrationEntry[] };
      const removedIds = new Set(duplicateParticipantIds);
      const next = Array.isArray(result.registrations)
        ? result.registrations
        : registrations.filter((entry) => !removedIds.has(entry.id));
      setRegistrations(next);
      window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(next));
      setHideDuplicateParticipants(false);
      setRemoveDuplicatesOpen(false);
      setMessage(`${duplicateParticipantIds.length} duplicate registrations permanently removed.`);
    } catch {
      setMessage("Duplicate registrations could not be removed. Please try again.");
    } finally {
      setRemovingDuplicates(false);
    }
  }

  async function promoteSelectedWaitingRegistrations() {
    if (!selectedWorkshop || !selectedWaitingParticipants.length || promotingWaiting) return;
    setPromotingWaiting(true);
    try {
      const response = await fetch("/api/admin/registration-waiting", {
        body: JSON.stringify({
          registrationIds: selectedWaitingParticipants.map((entry) => entry.id),
          workshopId: selectedWorkshop.id
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      const result = await response.json().catch(() => ({})) as { error?: string; promoted?: number; registrations?: RegistrationEntry[] };
      if (!response.ok || !Array.isArray(result.registrations)) throw new Error(result.error || "Promotion failed.");
      setRegistrations(result.registrations);
      window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(result.registrations));
      setSelectedParticipantIds([]);
      setPromoteWaitingOpen(false);
      setMessage(`${result.promoted ?? selectedWaitingParticipants.length} waiting registration${(result.promoted ?? selectedWaitingParticipants.length) === 1 ? "" : "s"} converted successfully.`);
    } catch {
      setMessage("Waiting registrations could not be converted. Please try again.");
    } finally {
      setPromotingWaiting(false);
    }
  }

  async function retryRegistrationWhatsApp(registrationId: string) {
    try {
      const response = await fetch("/api/admin/registration-whatsapp", {
        body: JSON.stringify({ registrationId }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json() as { error?: string; registration?: RegistrationEntry };
      if (!response.ok || !result.registration) throw new Error(result.error || "WhatsApp retry failed.");
      setRegistrations((current) => current.map((entry) => entry.id === registrationId ? result.registration as RegistrationEntry : entry));
      setMessage("WhatsApp delivery checked and updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "WhatsApp delivery could not be retried.");
    }
  }

  function sendResponseSummaryOnWhatsApp() {
    if (!selectedWorkshop) return;

    const totalRegistrations = displayedParticipants.length;
    const todaysRegistrations = displayedParticipants.filter((entry) => isTodayInIndia(entry.createdAt)).length;
    const message = [
      "Workshop Registration Summary",
      "",
      `Workshop: ${selectedWorkshop.name}`,
      `Total Registrations: ${totalRegistrations}`,
      `Today's Registrations: ${todaysRegistrations}`
    ].join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    setMessage("Workshop registration summary is ready to share.");
  }

  function buildWorkshopRecord(id: string): WorkshopRecord {
    const existing = records.find((record) => record.id === id);
    const now = new Date().toISOString();
    const batches = existing?.batches?.length ? existing.batches : [{
      id: `batch-${id}-${generateId()}`,
      name: batch.trim() || "Main Batch",
      facilitator,
      status: "open" as const,
      introductionSessions: [],
      createdAt: now,
      updatedAt: now
    }];
    return {
      batch: batch.trim() || "Main Batch",
      batches,
      discountCodeEod,
      discountDescription,
      discountType,
      discountValue,
      facilitator,
      feesWithTax,
      id,
      isPaid,
      isPartPaymentAllow,
      maxOrderQty,
      mfwEnrollmentEnabled,
      mfwWorkshopEventId: mfwEnrollmentEnabled ? mfwWorkshopEventId : undefined,
      mfwWorkshopTitle: mfwEnrollmentEnabled ? mfwWorkshopTitle : undefined,
      minOrderQty,
      minimumPartPayment,
      name,
      orderQtyTitle,
      productGroup: group,
      transferLeadToCrm,
      type
    };
  }

  function resetBuilderForm() {
    setFormTitle("Workshop Registration");
    setFormTagline("");
    setFormDescription("Please fill in your details to confirm your seat.");
    setFormSubmitButtonText("Confirm Registration");
    setFormLogoUrl("");
    setFormMode("classic");
    setFormTheme(defaultTheme);
    setFormFields(defaultBuilderFields());
    setFormHighlights([]);
    setFormOtpRequired(false);
    setFormRequireAttendanceForConfirmation(false);
    setFormRequiredAttendanceSessionId("");
    setFormWaitingMode(false);
    setFormRegistrationCapacity("");
    setFormWaitingTitle("Waiting List Registration");
    setFormWaitingMessage("Seats are currently full. Your registration will be added to the waiting list.");
    setFormRepeaterSourceWorkshopIds([]);
    setRepeaterWorkshopQuery("");
    setWhatsappGroupUrl("");
    setWhatsappConfirmationEnabled(false);
    setWhatsappConfirmationTemplate("");
    setWhatsappWaitingTemplate("");
    setWhatsappReferrerWaitingTemplate("");
  }

  function buildRegistrationForm(record: WorkshopRecord): BuilderForm {
    return {
      id: `form-${record.id}-main`,
      workshopId: record.id,
      workshopName: record.name,
      workshopSlug: workshopSlug(record.name) || record.id,
      batch: record.batch || "Main Batch",
      title: formTitle.trim() || `${record.name} Registration`,
      tagline: formTagline.trim() || undefined,
      description: sanitizeRichTextHtml(formDescription),
      mode: formMode,
      theme: { ...defaultTheme, ...formTheme, logoUrl: formLogoUrl || undefined },
      paid: record.isPaid,
      fee: Number(record.feesWithTax || 0),
      partPayment: Boolean(record.isPartPaymentAllow),
      otpRequired: formOtpRequired,
      requireAttendanceForConfirmation: formRequireAttendanceForConfirmation,
      attendanceOnlyConfirmation: formRequireAttendanceForConfirmation,
      requiredAttendanceSessionId: formRequireAttendanceForConfirmation ? formRequiredAttendanceSessionId || undefined : undefined,
      waitingMode: formWaitingMode,
      registrationCapacity: Math.max(0, Number(formRegistrationCapacity) || 0) || undefined,
      waitingTitle: formWaitingTitle.trim() || undefined,
      waitingMessage: formWaitingMessage.trim() || undefined,
      repeaterSourceWorkshopIds: formRepeaterSourceWorkshopIds,
      highlights: formHighlights.map((item) => item.trim()).filter(Boolean),
      whatsappGroupUrl: whatsappGroupUrl.trim() || undefined,
      whatsappConfirmationEnabled,
      whatsappConfirmationTemplate: whatsappConfirmationTemplate.trim() || undefined,
      whatsappWaitingTemplate: whatsappWaitingTemplate.trim() || undefined,
      whatsappReferrerWaitingTemplate: whatsappReferrerWaitingTemplate.trim() || undefined,
      submitButtonText: formSubmitButtonText.trim() || undefined,
      fields: normalizeCoreFieldRequirements(formFields),
      updatedAt: new Date().toISOString()
    };
  }

  async function saveBuilderForm(record: WorkshopRecord) {
    try {
      const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
      const existing = forms.find((item) => item.workshopId === record.id);
      const form = { ...buildRegistrationForm(record), allowReferralConfirmation: existing?.allowReferralConfirmation, referralCodes: existing?.referralCodes, eligibilityWaitingMessage: existing?.eligibilityWaitingMessage };
      const next = [form, ...forms.filter((item) => item.id !== form.id && item.workshopId !== record.id)];
      return saveLiveState({ forms: next });
    } catch {
      // Workshop save should still work if local form storage is unavailable.
      return false;
    }
  }

  function loadBuilderForm(record: WorkshopRecord) {
    try {
      const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
      const savedForm = forms.find((item) => item.workshopId === record.id || item.workshopSlug === workshopSlug(record.name));
      if (!savedForm) {
        setFormTitle(`${record.name} Registration`);
        setFormTagline("");
        setFormDescription("Please fill in your details to confirm your seat.");
        setFormSubmitButtonText(record.isPaid ? "Register & Pay" : "Confirm Registration");
        setFormLogoUrl("");
        setFormMode("classic");
        setFormTheme(defaultTheme);
        setFormFields(defaultBuilderFields());
        setFormHighlights([]);
        setFormOtpRequired(false);
        setFormRequireAttendanceForConfirmation(false);
        setFormRequiredAttendanceSessionId("");
        setFormWaitingMode(false);
        setFormRegistrationCapacity("");
        setFormWaitingTitle("Waiting List Registration");
        setFormWaitingMessage("Seats are currently full. Your registration will be added to the waiting list.");
        setFormRepeaterSourceWorkshopIds([]);
        setRepeaterWorkshopQuery("");
        setWhatsappGroupUrl("");
        setWhatsappConfirmationEnabled(false);
        setWhatsappConfirmationTemplate("");
        setWhatsappWaitingTemplate("");
        setWhatsappReferrerWaitingTemplate("");
        return;
      }
      setFormTitle(savedForm.title || `${record.name} Registration`);
      setFormTagline(savedForm.tagline ?? "");
      setFormDescription(savedForm.description || "");
      setFormSubmitButtonText(savedForm.submitButtonText || (savedForm.paid ? "Register & Pay" : "Confirm Registration"));
      setFormLogoUrl(savedForm.theme?.logoUrl ?? "");
      setFormMode(savedForm.mode ?? "classic");
      setFormTheme({ ...defaultTheme, ...savedForm.theme, logoUrl: undefined });
      setFormFields(savedForm.fields?.length ? normalizeCoreFieldRequirements(savedForm.fields) : defaultBuilderFields());
      setFormHighlights(savedForm.highlights ?? []);
      setFormOtpRequired(Boolean(savedForm.otpRequired));
      setFormRequireAttendanceForConfirmation(Boolean(savedForm.attendanceOnlyConfirmation));
      setFormRequiredAttendanceSessionId(savedForm.requiredAttendanceSessionId ?? "");
      setFormWaitingMode(Boolean(savedForm.waitingMode));
      setFormRegistrationCapacity(savedForm.registrationCapacity ? String(savedForm.registrationCapacity) : "");
      setFormWaitingTitle(savedForm.waitingTitle || "Waiting List Registration");
      setFormWaitingMessage(savedForm.waitingMessage || "Seats are currently full. Your registration will be added to the waiting list.");
      setFormRepeaterSourceWorkshopIds(savedForm.repeaterSourceWorkshopIds ?? []);
      setRepeaterWorkshopQuery("");
      setWhatsappGroupUrl(savedForm.whatsappGroupUrl ?? "");
      setWhatsappConfirmationEnabled(Boolean(savedForm.whatsappConfirmationEnabled));
      setWhatsappConfirmationTemplate(savedForm.whatsappConfirmationTemplate ?? "");
      setWhatsappWaitingTemplate(savedForm.whatsappWaitingTemplate ?? "");
      setWhatsappReferrerWaitingTemplate(savedForm.whatsappReferrerWaitingTemplate ?? "");
    } catch {
      resetBuilderForm();
    }
  }

  async function updateSelectedWaitingMode(enabled: boolean) {
    if (!selectedWorkshop) return;
    const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
    const existing = forms.find((item) => item.workshopId === selectedWorkshop.id || item.workshopSlug === workshopSlug(selectedWorkshop.name));
    const updated = existing
      ? { ...existing, waitingMode: enabled, updatedAt: new Date().toISOString() }
      : { ...buildRegistrationForm(selectedWorkshop), waitingMode: enabled };
    const saved = await saveLiveState({ forms: [updated, ...forms.filter((item) => item.id !== updated.id && item.workshopId !== selectedWorkshop.id)] });
    if (saved) {
      setFormWaitingMode(enabled);
      setMessage(enabled ? "Waiting Mode is ON. New registrations will join the waiting list." : "Waiting Mode is OFF. New registrations will be confirmed normally.");
    } else {
      setMessage("Could not update Waiting Mode. Please try again.");
    }
  }

  function deleteBuilderForm(id: string) {
    try {
      const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
      void saveLiveState({ forms: forms.filter((item) => item.workshopId !== id) });
    } catch {
      // ignore storage cleanup failures
    }
  }

  function updateFormField(id: string, patch: Partial<BuilderField>) {
    setFormFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field));
  }

  function addFormField(fieldType: BuilderFieldType) {
    const meta = fieldTypeMeta[fieldType];
    setFormFields((current) => [
      ...current,
      {
        id: generateId(),
        type: fieldType,
        label: meta.label,
        required: false,
        options: meta.hasOptions ? ["Option 1", "Option 2"] : undefined
      }
    ]);
  }

  function moveFormField(index: number, direction: -1 | 1) {
    setFormFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function duplicateFormField(id: string) {
    setFormFields((current) => {
      const index = current.findIndex((field) => field.id === id);
      if (index < 0) return current;
      const next = [...current];
      next.splice(index + 1, 0, { ...current[index], id: generateId(), role: undefined });
      return next;
    });
  }

  function removeFormField(id: string) {
    setFormFields((current) => current.filter((field) => field.id !== id));
  }

  function exportCsv() {
    const headers = ["Workshop", "Type", "Facilitator", "Product Group", "Paid", "Batch", "Fee", "CRM"];
    const rows = filteredRecords.map((record) => [
      record.name,
      record.type,
      record.facilitator,
      record.productGroup,
      record.isPaid ? "Paid" : "Free",
      record.batch || "Main Batch",
      record.feesWithTax || "0",
      record.transferLeadToCrm ? "Yes" : "No"
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "workshop-master-list.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${filteredRecords.length} workshop records.`);
  }

  function exportSelectedRegistrations() {
    if (!selectedWorkshop) return;

    const coreAnswerKeys = new Set(["Full Name", "Mobile", "Email", "City", "Payment Status", "Source"]);
    const customAnswerKeys = Array.from(new Set(
      displayedParticipants.flatMap((entry) => Object.keys((entry.answers ?? {}) as Record<string, unknown>))
    )).filter((key) => !coreAnswerKeys.has(key));
    const headers = [
      "Registration / Unique ID",
      "Name",
      "Mobile",
      "Email",
      "City",
      "Source",
      "WhatsApp Verification",
      "Call Confirmation",
      "Call Note",
      "Confirmation Updated By",
      "Confirmation Updated At",
      "Payment Status",
      "Paid",
      "Due",
      "Submitted",
      ...customAnswerKeys
    ];
    const rows = displayedParticipants.map((entry) => [
      entry.registrationNumber ?? "",
      entry.fullName,
      entry.mobile,
      entry.email,
      entry.city,
      entry.source ?? "Registration Link",
      entry.whatsappVerificationStatus ?? "Not Required",
      entry.confirmationStatus ?? "pending",
      entry.confirmationNote ?? "",
      entry.confirmationUpdatedBy ?? "",
      entry.confirmationUpdatedAt ? formatSubmittedAt(entry.confirmationUpdatedAt) : "",
      entry.status,
      entry.amountPaid,
      entry.amountDue,
      formatSubmittedAt(entry.createdAt),
      ...customAnswerKeys.map((key) => ((entry.answers ?? {}) as Record<string, unknown>)[key] ?? "")
    ]);
    const cell = (value: unknown) => {
      const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = "\ufeff" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = selectedWorkshop.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workshop";
    link.href = url;
    link.download = `${filename}-registrations.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded ${displayedParticipants.length} registration responses.`);
  }

  function exportWaitingList() {
    if (!selectedWorkshop || !waitingParticipants.length) return;
    const headers = ["Waiting Number", "Name", "Mobile", "Email", "City", "Batch", "Source", "Submitted"];
    const rows = waitingParticipants.map((entry) => [
      entry.waitingPosition ?? "",
      entry.fullName,
      entry.mobile,
      entry.email,
      entry.city,
      entry.batch ?? "Main Batch",
      entry.source ?? "Registration Link",
      formatSubmittedAt(entry.createdAt)
    ]);
    const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = "\ufeff" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = selectedWorkshop.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workshop";
    link.href = url;
    link.download = `${filename}-waiting-list.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded ${waitingParticipants.length} waiting registrations.`);
  }

  return (
    <AdminPlatformShell activeLabel="Workshop Master" description="Create workshop/product masters and configure registration fields in one platform." title="Manage Workshop">
      {!showData ? (
      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5" onSubmit={submit}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">Form completion</p>
            <p className="text-3xl font-black text-slate-950">{progress}%</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50" onClick={duplicateCurrentFormDraft} type="button">
              <Files className="size-4" />
              Duplicate Form
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50" onClick={() => setShowData(true)} type="button">
              <Eye className="size-4" />
              View Workshops ({records.length})
            </button>
          </div>
        </div>

        {message ? (
          <div className={`mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${message.includes("Please") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {message.includes("Please") ? <AlertCircle className="size-4" /> : <Check className="size-4" />}
            {message}
          </div>
        ) : null}

        <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-2 block text-sm font-black text-slate-700">Select existing workshop</span>
              <select className={inputClass} onChange={(event) => { const record = records.find((item) => item.id === event.target.value); if (record) editRecord(record); }} value={editingId ?? ""}>
                <option value="">Choose a saved workshop</option>
                {records.filter((record) => !record.archived).map((record) => <option key={record.id} value={record.id}>{record.name} · {record.batches?.length || record.legacyBatchCount || 1} batches</option>)}
              </select>
            </label>
            <button className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white" onClick={() => clearForm()} type="button"><Plus className="size-4" />Create new workshop</button>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">Create a workshop once, then manage every batch and introduction session below it.</p>
        </section>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-slate-600">Workshop/Product Name</label>
          <input className={inputClass} onChange={(event) => setName(event.target.value)} placeholder="Enter workshop or product name" value={name} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <SelectBox label="Workshop Type" onChange={setType} options={workshopTypes} value={type} />
          <SelectBox label="Default Facilitator" onChange={setFacilitator} options={facilitators} value={facilitator} />
          <SelectBox label="Product Group" onChange={setGroup} options={productGroups} value={group} />
          <label className="flex min-h-[74px] items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            <input checked={isPaid} className="size-5 accent-indigo-600" onChange={(event) => setIsPaid(event.target.checked)} type="checkbox" />
            Is Paid?
          </label>
        </div>

        <section className={`mt-6 rounded-2xl border p-4 md:p-5 ${mfwEnrollmentEnabled ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">MFW Integration · Optional</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Enroll confirmed registrations in My Fitness World</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">When a registration is marked Confirmed, the user will be assigned to the selected MFW workshop. CFL confirmation continues even if MFW is temporarily unavailable.</p>
            </div>
            <label className="inline-flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700">
              <input
                checked={mfwEnrollmentEnabled}
                className="size-5 accent-emerald-600"
                onChange={(event) => {
                  setMfwEnrollmentEnabled(event.target.checked);
                  if (!event.target.checked) setMfwError("");
                }}
                type="checkbox"
              />
              Enable MFW enrollment
            </label>
          </div>
          {mfwEnrollmentEnabled ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">MFW Workshop</span>
                <select
                  className={inputClass}
                  disabled={mfwLoading}
                  onChange={(event) => {
                    const selected = mfwWorkshops.find((workshop) => workshop.id === event.target.value);
                    setMfwWorkshopEventId(event.target.value);
                    setMfwWorkshopTitle(selected?.title ?? (event.target.value === mfwWorkshopEventId ? mfwWorkshopTitle : ""));
                  }}
                  value={mfwWorkshopEventId}
                >
                  <option value="">{mfwLoading ? "Loading MFW workshops..." : "Select MFW workshop"}</option>
                  {mfwWorkshopEventId && !mfwWorkshops.some((workshop) => workshop.id === mfwWorkshopEventId) ? <option value={mfwWorkshopEventId}>{mfwWorkshopTitle || mfwWorkshopEventId} · Saved mapping</option> : null}
                  {mfwWorkshops.map((workshop) => <option key={workshop.id} value={workshop.id}>{workshop.title}</option>)}
                </select>
              </label>
              <button className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-60" disabled={mfwLoading} onClick={() => void loadMfwWorkshops()} type="button">
                <RefreshCw className={`size-4 ${mfwLoading ? "animate-spin" : ""}`} />
                Refresh MFW
              </button>
              {mfwError ? <p className="text-sm font-bold text-rose-700 md:col-span-2" role="alert">{mfwError}</p> : null}
              {!mfwError && mfwWorkshopEventId ? <p className="text-xs font-bold text-emerald-700 md:col-span-2">Mapped to: {mfwWorkshopTitle || mfwWorkshopEventId}</p> : null}
            </div>
          ) : null}
        </section>

        <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Workshop Schedule Settings</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Pricing, discount, CRM and order rules</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">These defaults are reused when schedules and registration links are created.</p>
            </div>
            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
              <input checked={transferLeadToCrm} className="size-5 accent-indigo-600" onChange={(event) => setTransferLeadToCrm(event.target.checked)} type="checkbox" />
              Transfer lead to CRM
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Batch</span>
              <input className={inputClass} onChange={(event) => setBatch(event.target.value)} placeholder="Main Batch" value={batch} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Fees With Tax</span>
              <input className={inputClass} disabled={!isPaid} inputMode="numeric" onChange={(event) => setFeesWithTax(event.target.value)} placeholder="0" value={feesWithTax} />
            </label>
            <label className="flex min-h-[74px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
              <input checked={isPartPaymentAllow} className="size-5 accent-indigo-600" disabled={!isPaid} onChange={(event) => setIsPartPaymentAllow(event.target.checked)} type="checkbox" />
              Is Part Payment Allow?
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Minimum Part Payment</span>
              <input className={inputClass} disabled={!isPaid || !isPartPaymentAllow} inputMode="numeric" onChange={(event) => setMinimumPartPayment(event.target.value)} placeholder="0" value={minimumPartPayment} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Discount Code/EOD</span>
              <input className={inputClass} onChange={(event) => setDiscountCodeEod(event.target.value)} placeholder="DISCOUNT10" value={discountCodeEod} />
            </label>
            <div>
              <span className="mb-2 block text-sm font-bold text-slate-600">Discount Type</span>
              <div className="flex min-h-[48px] items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold">
                <label className="inline-flex items-center gap-2"><input checked={discountType === "percent"} className="accent-indigo-600" onChange={() => setDiscountType("percent")} type="radio" />%</label>
                <label className="inline-flex items-center gap-2"><input checked={discountType === "flat"} className="accent-indigo-600" onChange={() => setDiscountType("flat")} type="radio" />Flat Amount</label>
              </div>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Discount Value</span>
              <input className={inputClass} inputMode="numeric" onChange={(event) => setDiscountValue(event.target.value)} placeholder="0" value={discountValue} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-600">Discount Description</span>
              <input className={inputClass} onChange={(event) => setDiscountDescription(event.target.value)} placeholder="Short note for offer" value={discountDescription} />
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Order Qty Title</span>
              <input className={inputClass} onChange={(event) => setOrderQtyTitle(event.target.value)} placeholder="Seats" value={orderQtyTitle} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Min Order Qty</span>
              <input className={inputClass} inputMode="numeric" onChange={(event) => setMinOrderQty(event.target.value)} placeholder="1" value={minOrderQty} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Max Order Qty</span>
              <input className={inputClass} inputMode="numeric" onChange={(event) => setMaxOrderQty(event.target.value)} placeholder="10" value={maxOrderQty} />
            </label>
          </div>
        </div>

        {editingId ? (
          <WorkshopHierarchyManager
            registrations={registrations}
            workshop={records.find((record) => record.id === editingId)!}
            onChange={async (batches) => {
              const next = records.map((record) => record.id === editingId ? { ...record, batches, batch: batches[0]?.name || record.batch } : record);
              await saveRecords(next);
              setMessage("Batch and introduction session structure saved.");
            }}
          />
        ) : (
          <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <CalendarDays className="mx-auto size-6 text-slate-400" />
            <p className="mt-2 font-black text-slate-800">Save the workshop to create batches</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">After the workshop master is saved, add batch dates, capacity and introduction sessions without creating the workshop again.</p>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3.5 md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Registration Form Builder</p>
              <h3 className="mt-0.5 text-lg font-black text-slate-950">Create registration form with workshop</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">Configure the public registration experience.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">{formFields.length} fields</span>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Form Title</span>
              <input className={inputClass} onChange={(event) => setFormTitle(event.target.value)} placeholder="Workshop Registration" value={formTitle} />
            </label>
            <FormLogoUploader value={formLogoUrl} onChange={setFormLogoUrl} />
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-600">Form Tagline</span>
              <input
                className={inputClass}
                onChange={(event) => setFormTagline(event.target.value)}
                placeholder="Short subtitle shown below the form title"
                value={formTagline}
              />
              <span className="mt-1 block text-xs font-semibold text-slate-400">Shown below the title on the public registration form.</span>
            </label>
            <div className="md:col-span-2">
              <FormExperienceControls
                mode={formMode}
                onModeChange={setFormMode}
                onThemeChange={(patch) => setFormTheme((current) => ({ ...current, ...patch }))}
                theme={formTheme}
              />
            </div>
            <div className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-600">Form Description</span>
              <RichTextEditor onChange={setFormDescription} value={formDescription} />
            </div>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-600">Submit Button Text</span>
              <input className={inputClass} maxLength={60} onChange={(event) => setFormSubmitButtonText(event.target.value)} placeholder={isPaid ? "Register & Pay" : "Confirm Registration"} value={formSubmitButtonText} />
              <span className="mt-1 block text-xs font-semibold text-slate-400">Shown on the final button of the public registration form.</span>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-600">WhatsApp Group Invite Link</span>
              <input className={inputClass} onChange={(event) => setWhatsappGroupUrl(event.target.value)} placeholder="https://chat.whatsapp.com/xxxxxxxx" value={whatsappGroupUrl} />
              <span className="mt-1 block text-xs font-semibold text-slate-400">After registration, the thank-you page can redirect to this group link after 5 seconds.</span>
            </label>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 md:col-span-2">
              <label className="flex min-h-[48px] items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-black text-slate-700">Send registration status on WhatsApp</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">Uses separate templates for confirmed participants, waiting participants and valid waiting referrers.</span>
                </span>
                <input checked={whatsappConfirmationEnabled} className="size-5 shrink-0 accent-emerald-600" onChange={(event) => setWhatsappConfirmationEnabled(event.target.checked)} type="checkbox" />
              </label>
              {whatsappConfirmationEnabled ? (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="block"><span className="mb-2 block text-xs font-bold text-slate-600">Participant Confirmation Template</span><input className={inputClass} onChange={(event) => setWhatsappConfirmationTemplate(event.target.value)} placeholder="registration_confirmed" value={whatsappConfirmationTemplate} /></label>
                  <label className="block"><span className="mb-2 block text-xs font-bold text-slate-600">Participant Waiting Template</span><input className={inputClass} onChange={(event) => setWhatsappWaitingTemplate(event.target.value)} placeholder="registration_waiting" value={whatsappWaitingTemplate} /></label>
                  <label className="block"><span className="mb-2 block text-xs font-bold text-slate-600">Referrer Waiting Template</span><input className={inputClass} onChange={(event) => setWhatsappReferrerWaitingTemplate(event.target.value)} placeholder="referrer_registration_waiting" value={whatsappReferrerWaitingTemplate} /></label>
                </div>
              ) : null}
            </div>
            <label className="flex min-h-[58px] items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-white px-4 py-3 md:col-span-2">
              <span>
                <span className="block text-sm font-black text-slate-700">WhatsApp OTP Verification</span>
                <span className="mt-0.5 block text-xs font-semibold text-slate-400">Turn on when participants must verify a WhatsApp OTP before submitting this registration form.</span>
              </span>
              <input checked={formOtpRequired} className="size-5 shrink-0 accent-emerald-600" onChange={(event) => setFormOtpRequired(event.target.checked)} type="checkbox" />
            </label>
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 md:col-span-2">
              <label className="flex min-h-[48px] items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-black text-slate-800">Confirm only attended participants</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">When ON, only mobile numbers found in the selected attendance form are confirmed. Everyone else joins the waiting list.</span>
                </span>
                <input
                  checked={formRequireAttendanceForConfirmation}
                  className="size-5 shrink-0 accent-sky-600"
                  onChange={(event) => {
                    setFormRequireAttendanceForConfirmation(event.target.checked);
                    if (!event.target.checked) setFormRequiredAttendanceSessionId("");
                  }}
                  type="checkbox"
                />
              </label>
              {formRequireAttendanceForConfirmation ? (
                <label className="mt-3 block">
                  <span className="mb-2 block text-xs font-black text-slate-600">Required Attendance Form</span>
                  <select className={inputClass} onChange={(event) => setFormRequiredAttendanceSessionId(event.target.value)} value={formRequiredAttendanceSessionId}>
                    <option value="">Select attendance form</option>
                    {attendanceSessions.map((session) => <option key={session.id} value={session.id}>{session.workshopName} · {session.title} · {session.sessionDate}</option>)}
                  </select>
                  {!attendanceSessions.length ? <span className="mt-2 block text-xs font-bold text-rose-600">Create an attendance form first, then return here to select it.</span> : null}
                </label>
              ) : null}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 md:col-span-2">
              <label className="flex min-h-[48px] items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-black text-slate-800">Waiting Mode</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">When enabled, every new form submission goes directly to the waiting list.</span>
                </span>
                <input checked={formWaitingMode} className="size-5 shrink-0 accent-amber-600" onChange={(event) => setFormWaitingMode(event.target.checked)} type="checkbox" />
              </label>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-600">Registration Capacity</span>
                  <input className={inputClass} inputMode="numeric" min={1} onChange={(event) => setFormRegistrationCapacity(event.target.value.replace(/\D/g, ""))} placeholder="No limit" value={formRegistrationCapacity} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-600">Waiting Heading</span>
                  <input className={inputClass} maxLength={80} onChange={(event) => setFormWaitingTitle(event.target.value)} placeholder="Waiting List Registration" value={formWaitingTitle} />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-xs font-black text-slate-600">Waiting Message</span>
                  <input className={inputClass} maxLength={240} onChange={(event) => setFormWaitingMessage(event.target.value)} value={formWaitingMessage} />
                </label>
              </div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-black text-slate-800">Repeater Source Workshops</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">Only participants matching a selected workshop by mobile number will enter Waiting · Repeater review.</span>
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">{formRepeaterSourceWorkshopIds.length} selected</span>
              </div>
              <label className="relative mt-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input className={`${inputClass} pl-10`} onChange={(event) => setRepeaterWorkshopQuery(event.target.value)} placeholder="Search past workshops" value={repeaterWorkshopQuery} />
              </label>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-violet-100 bg-white">
                {records
                  .filter((workshop) => workshop.id !== editingId && workshop.name.toLowerCase().includes(repeaterWorkshopQuery.trim().toLowerCase()))
                  .map((workshop) => {
                    const checked = formRepeaterSourceWorkshopIds.includes(workshop.id);
                    return (
                      <label className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-0 hover:bg-violet-50" key={workshop.id}>
                        <input
                          checked={checked}
                          className="size-4 accent-violet-600"
                          onChange={(event) => setFormRepeaterSourceWorkshopIds((current) => event.target.checked
                            ? [...new Set([...current, workshop.id])]
                            : current.filter((id) => id !== workshop.id))}
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{workshop.name}</span>
                        {workshop.archived ? <span className="text-[10px] font-black uppercase text-slate-400">Past</span> : null}
                      </label>
                    );
                  })}
                {!records.some((workshop) => workshop.id !== editingId && workshop.name.toLowerCase().includes(repeaterWorkshopQuery.trim().toLowerCase())) ? <p className="px-4 py-6 text-center text-sm font-bold text-slate-500">No other workshop found.</p> : null}
              </div>
              {formRepeaterSourceWorkshopIds.length ? <button className="mt-3 text-xs font-black text-rose-600 hover:underline" onClick={() => setFormRepeaterSourceWorkshopIds([])} type="button">Clear selection</button> : null}
            </div>
          </div>

          {editingAnalytics ? (
            <FormAnalyticsSummary analytics={editingAnalytics} fields={formFields} />
          ) : null}

          <div className="mt-4 space-y-2">
            {formFields.map((field, index) => (
              <FieldEditor
                field={field}
                fields={formFields}
                index={index}
                key={field.id}
                onChange={(patch) => updateFormField(field.id, patch)}
                onDuplicate={() => duplicateFormField(field.id)}
                onMoveDown={() => moveFormField(index, 1)}
                onMoveUp={() => moveFormField(index, -1)}
                onRemove={() => removeFormField(field.id)}
                total={formFields.length}
              />
            ))}
          </div>

          <div className="mt-3 border-t border-emerald-100 pt-3">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Add field</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {addableTypes.map((fieldType) => (
                <button
                  className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 sm:min-h-0"
                  key={fieldType}
                  onClick={() => addFormField(fieldType)}
                  type="button"
                >
                  <Plus className="size-3.5" />
                  {fieldTypeMeta[fieldType].label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 border-t border-emerald-100 pt-3">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">What's Included</p>
            <div className="space-y-2">
              {formHighlights.map((item, index) => (
                <div className="flex gap-2" key={index}>
                  <input
                    className={inputClass}
                    onChange={(event) => setFormHighlights((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                    placeholder="e.g. Certificate of completion"
                    value={item}
                  />
                  <button className="grid size-11 shrink-0 place-items-center rounded-xl text-rose-500 hover:bg-rose-50" onClick={() => setFormHighlights((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => setFormHighlights((current) => [...current, ""])} type="button">
                <Plus className="size-3.5" />
                Add Item
              </button>
            </div>
          </div>
            </div>

            <WorkshopFormLivePreview
              description={formDescription}
              fields={formFields}
              highlights={formHighlights}
              logoUrl={formLogoUrl}
              mode={formMode}
              paid={isPaid}
              submitButtonText={formSubmitButtonText}
              theme={formTheme}
              title={formTitle || `${name || "Workshop"} Registration`}
              tagline={formTagline}
            />
          </div>
        </div>

        <div className="sticky bottom-3 z-20 mt-5 flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg shadow-slate-900/10 backdrop-blur">
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => clearForm()} type="button">
            <RefreshCw className="size-4" />
            Clear
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700" type="submit">
            <Save className="size-4" />
            {editingId ? "Update" : "Save"}
          </button>
        </div>
      </form>
      ) : null}

      {showData ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Total Workshops</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Workshop Master List</h3>
              <p className="mt-1 text-sm text-slate-500">All saved workshops/products appear here. Search, edit, delete or export them.</p>
            </div>
            <div className="flex flex-wrap items-start justify-end gap-2">
              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniStat label="Total" value={records.length} />
                <MiniStat label="Paid" value={paidCount} />
                <MiniStat label="Free" value={freeCount} />
                <MiniStat label="Historical" value={historicalCount} />
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
                onClick={() => {
                  clearForm();
                  setShowData(false);
                }}
                type="button"
              >
                Create Workshop
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full flex-col gap-3 lg:max-w-3xl lg:flex-row">
              <div className="flex rounded-xl border border-slate-200 p-1">
                {(["active", "historical", "all"] as const).map((scope) => (
                  <button
                    className={`rounded-lg px-3 py-2 text-sm font-bold capitalize ${recordScope === scope ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                    key={scope}
                    onClick={() => setRecordScope(scope)}
                    type="button"
                  >
                    {scope}
                  </button>
                ))}
              </div>
              <label className="relative block min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search workshop, type, facilitator..."
                  value={search}
                />
              </label>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800" onClick={exportCsv} type="button">
              <Download className="size-4" />
              Export CSV
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{["Action", "Workshop", "Type", "Facilitator", "Group", "Paid", "Batch"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length ? filteredRecords.map((record) => (
                  <tr className="hover:bg-indigo-50/40 [contain-intrinsic-size:auto_64px] [content-visibility:auto]" key={record.id}>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {record.archived ? (
                          <a aria-label={`View ${record.name} historical data`} className="grid size-9 place-items-center rounded-xl bg-amber-500 text-white hover:bg-amber-600" href="/historical-data" title="View historical data"><Archive className="size-4" /></a>
                        ) : (
                          <>
                            <button aria-label="Edit registration link" className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setLinkWorkshop(record)} title="Edit registration link" type="button"><Link2 className="size-4" /></button>
                            <button className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => editRecord(record)} title="Edit" type="button"><Edit3 className="size-4" /></button>
                            <button className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white hover:bg-violet-700" onClick={() => startDraftFromRecord(record)} title="Duplicate workshop form" type="button"><Files className="size-4" /></button>
                            <button className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => setDeleteTarget(record)} title="Delete" type="button"><Trash2 className="size-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {record.archived ? <a className="text-left font-black text-amber-700 underline-offset-4 hover:underline" href="/historical-data">{record.name}</a> : <button className="text-left font-black text-indigo-700 underline-offset-4 hover:underline" onClick={() => openWorkshop(record)} type="button">{record.name}</button>}
                    </td>
                    <td className="px-4 py-4">{record.type}</td>
                    <td className="px-4 py-4">{record.facilitator}</td>
                    <td className="px-4 py-4">{record.productGroup}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${record.paymentUnknown ? "bg-amber-50 text-amber-700" : record.isPaid ? "bg-slate-950 text-white" : "bg-emerald-50 text-emerald-700"}`}>
                        {record.paymentUnknown ? "Unknown" : record.isPaid ? "Paid" : "Free"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{record.legacyBatchCount ? `${record.legacyBatchCount} batches` : record.batch || "Main Batch"}</td>
                  </tr>
                )) : <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No workshop records yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <WorkshopCohortCompare registrations={registrations} workshops={records} />
          <MultiWorkshopOverlap
            attendanceEntries={attendanceEntries}
            attendanceSessions={attendanceSessions}
            registrations={registrations}
            workshops={records}
          />

          {selectedWorkshop ? (
            <div
              aria-labelledby="opened-workshop-title"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5"
              onMouseDown={(event) => {
                if (event.target !== event.currentTarget) return;
                setSelectedWorkshopId(null);
                setSelectedParticipantBatchId("all");
                setShowParticipants(false);
              }}
              role="dialog"
            >
              <section className="max-h-[calc(100dvh-1rem)] w-full max-w-[1600px] overflow-y-auto overscroll-contain rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Workshop Opened</p>
                  <h4 className="mt-2 text-2xl font-black text-slate-950" id="opened-workshop-title">{selectedWorkshop.name}</h4>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {selectedWorkshop.type} | {selectedWorkshop.facilitator} | {selectedWorkshop.productGroup}
                  </p>
                  {selectedWorkshop.batches?.length ? (
                    <label className="mt-3 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Participant batch
                      <select
                        className="mt-1 block min-h-11 min-w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-500"
                        onChange={(event) => {
                          setSelectedParticipantBatchId(event.target.value);
                          setSelectedParticipantIds([]);
                        }}
                        value={selectedParticipantBatchId}
                      >
                        <option value="all">All batches</option>
                        {selectedWorkshop.batches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className={`inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-sm font-black ${formWaitingMode ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-700"}`}>
                    <input checked={formWaitingMode} className="size-5 accent-amber-600" onChange={(event) => void updateSelectedWaitingMode(event.target.checked)} type="checkbox" />
                    Waiting Mode {formWaitingMode ? "ON" : "OFF"}
                  </label>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                    onClick={sendResponseSummaryOnWhatsApp}
                    title="Share workshop registration summary on WhatsApp"
                    type="button"
                  >
                    <MessageCircle className="size-4" />
                    Share Summary
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    onClick={exportSelectedRegistrations}
                    title="Download this workshop's registration responses as an Excel-compatible CSV"
                    type="button"
                  >
                    <Download className="size-4" />
                    Download Excel
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!waitingParticipants.length}
                    onClick={exportWaitingList}
                    title="Download only waiting-list registrations"
                    type="button"
                  >
                    <Download className="size-4" />
                    Download Waiting List
                  </button>
                  <a
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50"
                    href={`/process/import-data-workshop-wise?workshopId=${encodeURIComponent(selectedWorkshop.id)}`}
                    title={`Bulk import registrations into ${selectedWorkshop.name}`}
                  >
                    <Upload className="size-4" />
                    Import Data
                  </a>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
                    onClick={() => setShowParticipants((value) => !value)}
                    type="button"
                  >
                    <UsersRound className="size-4" />
                    {showParticipants ? "Hide Data" : `View Data (${selectedParticipants.length})`}
                  </button>
                  <button
                    aria-label="Close workshop details"
                    className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    onClick={() => {
                      setSelectedWorkshopId(null);
                      setSelectedParticipantBatchId("all");
                      setShowParticipants(false);
                    }}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {formWaitingMode ? (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                  <AlertCircle className="mt-0.5 size-5 shrink-0" />
                  All new form submissions are going directly to the waiting list.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <MiniStat label="Users" value={displayedParticipants.length} />
                <MiniStat label="Paid" value={displayedParticipants.filter((entry) => entry.status === "Paid").length} />
                <MiniStat label="Due" value={displayedParticipants.filter((entry) => entry.status === "Due").length} />
                <MiniStat label="Waiting" value={selectedParticipants.filter((entry) => entry.registrationStatus === "waiting").length} />
                {activeParticipantFilterCount ? <MiniStat label="Saved filters" value={activeParticipantFilterCount} /> : null}
              </div>

              {showParticipants ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
                    <p className="text-xs font-bold text-slate-500">
                      Filters stay saved for this workshop. WhatsApp summary uses the same visible registrations shown below.
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <AdvancedResponseFilters filters={responseFilters} onChange={setResponseFilters} questions={participantQuestions} resultCount={displayedParticipants.length} totalCount={selectedParticipants.length} />
                      <DuplicateResponseFilter checked={hideDuplicateParticipants} onChange={setHideDuplicateParticipants} rawCount={searchedParticipants.length} visibleCount={displayedParticipants.length} />
                      <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-black ${hideWaitingParticipants ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                        <input
                          checked={hideWaitingParticipants}
                          className="size-5 accent-amber-600"
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setHideWaitingParticipants(checked);
                            if (checked) setFollowUpScope("all");
                            if (checked) setSelectedParticipantIds((current) => current.filter((id) => !waitingParticipants.some((entry) => entry.id === id)));
                          }}
                          type="checkbox"
                        />
                        <EyeOff className="size-4" />
                        Hide waiting list ({waitingParticipants.length})
                      </label>
                      <button
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 text-sm font-black text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                        disabled={!duplicateParticipantIds.length}
                        onClick={() => setRemoveDuplicatesOpen(true)}
                        title="Permanently remove older duplicate registrations"
                        type="button"
                      >
                        <Trash2 className="size-4" />
                        Remove duplicates ({duplicateParticipantIds.length})
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 border-b border-slate-200 p-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {([
                        ["needs_follow_up", "Needs follow-up"],
                        ["completed", "Completed"],
                        ["waiting", `Waiting List (${waitingParticipants.length})`],
                        ["all", "All responses"]
                      ] as const).map(([value, label]) => (
                        <button
                          className={`min-h-10 rounded-lg px-3 text-xs font-black ${followUpScope === value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                          key={value}
                          onClick={() => {
                            setFollowUpScope(value);
                            if (value === "waiting") setHideWaitingParticipants(false);
                            setSelectedParticipantIds([]);
                          }}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="relative block w-full max-w-lg">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        aria-label="Search responses by name or mobile number"
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                        onChange={(event) => setParticipantSearch(event.target.value)}
                        placeholder="Search by name or mobile number"
                        type="search"
                        value={participantSearch}
                      />
                      {participantSearch ? (
                        <button
                          aria-label="Clear response search"
                          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => setParticipantSearch("")}
                          type="button"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </label>
                  </div>
                  {selectedParticipantIds.length ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-black text-emerald-900">{selectedParticipantIds.length} participant{selectedParticipantIds.length === 1 ? "" : "s"} selected</p>
                      <div className="flex flex-wrap gap-2">
                        <button className="min-h-10 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-black text-emerald-800" onClick={() => setSelectedParticipantIds([])} type="button">Clear</button>
                        {selectedWaitingParticipants.length ? (
                          <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-600 px-3 text-xs font-black text-white hover:bg-amber-700" onClick={() => setPromoteWaitingOpen(true)} type="button">
                            <CheckSquare className="size-4" />
                            Confirm selected ({selectedWaitingParticipants.length})
                          </button>
                        ) : null}
                        <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white hover:bg-emerald-800" onClick={() => setShareSelectedOpen(true)} type="button"><Share2 className="size-4" />Share Selected</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="overflow-x-auto">
                  <table className="min-w-[1240px] w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">
                          <input
                            aria-label="Select all visible responses"
                            checked={displayedParticipants.length > 0 && displayedParticipants.every((entry) => selectedParticipantIds.includes(entry.id))}
                            className="size-4 accent-emerald-600"
                            onChange={(event) => setSelectedParticipantIds((current) => event.target.checked
                              ? Array.from(new Set([...current, ...displayedParticipants.map((entry) => entry.id)]))
                              : current.filter((id) => !displayedParticipants.some((entry) => entry.id === id)))}
                            type="checkbox"
                          />
                        </th>
                        {["Action", "User", "Mobile", "Email", "City", "Source", "WhatsApp", "Confirmation", "MFW", "Call Note", "Payment", "Paid", "Due", "Submitted"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
	                      {displayedParticipants.length ? displayedParticipants.map((entry) => (
	                        <tr className="hover:bg-indigo-50/40" key={entry.id}>
                          <td className="px-4 py-4">
                            <input aria-label={`Select ${entry.fullName}`} checked={selectedParticipantIds.includes(entry.id)} className="size-4 accent-emerald-600" onChange={(event) => setSelectedParticipantIds((current) => event.target.checked ? [...new Set([...current, entry.id])] : current.filter((id) => id !== entry.id))} type="checkbox" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                            <button aria-label={`Update follow-up for ${entry.fullName}`} className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => setFollowUpTarget(entry)} title="Update confirmation and call note" type="button"><PhoneCall className="size-4" /></button>
                            <button
                              aria-label={`Delete response from ${entry.fullName}`}
                              className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                              onClick={() => setDeleteResponseTarget(entry)}
                              title="Delete response"
                              type="button"
                            >
                              <Trash2 className="size-4" />
                            </button>
                            </div>
                          </td>
	                          <td className="px-4 py-4 font-black text-slate-950">
                              {entry.fullName}
                              {entry.registrationStatus === "waiting" ? <span className={`mt-1 block w-fit rounded-full px-2 py-1 text-[11px] font-black ${entry.waitingReason === "repeater_review" ? "bg-indigo-100 text-indigo-800" : "bg-amber-100 text-amber-800"}`}>Waiting WL-{entry.waitingPosition ?? "-"} · {entry.waitingReason === "repeater_review" ? "Repeater review" : entry.waitingReason === "attendance_pending" ? "Attendance pending" : entry.waitingReason === "eligibility_pending" ? "Eligibility pending" : entry.waitingReason === "session_mismatch" ? "Session mismatch" : entry.waitingReason === "invalid_referral" ? "Invalid referral" : entry.waitingReason === "capacity" ? "Capacity full" : "Manual"}</span> : null}
                              {entry.isRepeater ? <span className="mt-1 block w-fit rounded-full bg-violet-100 px-2 py-1 text-[11px] font-black text-violet-800">Repeater{entry.repeaterSourceWorkshopTitle ? ` · ${entry.repeaterSourceWorkshopTitle}` : ""}</span> : null}
                              {entry.registrationStatus !== "waiting" && entry.registrationNumber ? <span className="mt-1 block w-fit rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-800" title="Registration / Unique ID">{entry.registrationNumber}</span> : null}
                              {entry.registrationStatus !== "waiting" && entry.confirmationSource ? <span className="mt-1 block text-[11px] font-bold text-emerald-700">Confirmed via {entry.confirmationSource.replaceAll("_", " + ")}</span> : null}
                            </td>
	                          <td className="px-4 py-4">{entry.mobile}</td>
	                          <td className="px-4 py-4">{entry.email}</td>
                          <td className="px-4 py-4">{entry.city}</td>
                          <td className="px-4 py-4"><RegistrationSourceBadge source={entry.source} /></td>
                          <td className="px-4 py-4">
                            <WhatsAppVerificationBadge status={entry.whatsappVerificationStatus} />
                            <div className="mt-2 flex items-center gap-2">
                              <span className={`text-[11px] font-black ${registrationWhatsAppStatus(entry) === "sent" ? "text-emerald-700" : registrationWhatsAppStatus(entry) === "failed" ? "text-rose-700" : "text-slate-500"}`}>
                                Status: {registrationWhatsAppStatus(entry)}
                              </span>
                              {registrationWhatsAppStatus(entry) !== "sent" ? <button aria-label={`Retry WhatsApp for ${entry.fullName}`} className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => void retryRegistrationWhatsApp(entry.id)} title="Retry registration WhatsApp" type="button"><MessageCircle className="size-4" /></button> : null}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <RegistrationConfirmationBadge status={entry.confirmationStatus} />
                            {entry.confirmationUpdatedBy ? <p className="mt-1 text-xs text-slate-500">{entry.confirmationUpdatedBy}{entry.confirmationUpdatedAt ? ` · ${formatSubmittedAt(entry.confirmationUpdatedAt)}` : ""}</p> : null}
                          </td>
                          <td className="px-4 py-4"><MfwSyncBadge entry={entry} /></td>
                          <td className="max-w-[240px] px-4 py-4 text-xs leading-5 text-slate-600">{entry.confirmationNote || "-"}</td>
                          <td className="px-4 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${entry.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">INR {entry.amountPaid.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-4">INR {entry.amountDue.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-4">{formatSubmittedAt(entry.createdAt)}</td>
                        </tr>
	                      )) : (
	                        <tr>
	                          <td className="px-4 py-8 text-center text-slate-500" colSpan={15}>
	                            {participantSearch ? "No response found for this name or mobile number." : "No users registered in this workshop yet."}
	                          </td>
	                        </tr>
                      )}
                    </tbody>
                  </table></div>
                </div>
              ) : null}
              </section>
            </div>
          ) : null}
        </section>
      ) : null}

      {linkWorkshop ? <RegistrationLinkModal workshop={linkWorkshop} onClose={() => setLinkWorkshop(null)} /> : null}
      {followUpTarget ? <FollowUpModal entry={followUpTarget} onClose={() => setFollowUpTarget(null)} onSave={updateRegistrationFollowUp} /> : null}
      {shareSelectedOpen && selectedWorkshop ? (
        <ShareSelectedResponsesModal
          entries={selectedParticipants.filter((entry) => selectedParticipantIds.includes(entry.id))}
          onClose={() => setShareSelectedOpen(false)}
          onCreated={() => {
            setShareSelectedOpen(false);
            setSelectedParticipantIds([]);
          }}
          workshop={selectedWorkshop}
        />
      ) : null}
      <ConfirmDialog
        confirmLabel={promotingWaiting ? "Converting..." : `Convert ${selectedWaitingParticipants.length} to Registration`}
        description="Selected people, including repeaters under review, will leave the waiting list and become confirmed registrations. MFW enrollment and confirmation WhatsApp will run after confirmation."
        onCancel={() => {
          if (!promotingWaiting) setPromoteWaitingOpen(false);
        }}
        onConfirm={() => void promoteSelectedWaitingRegistrations()}
        open={promoteWaitingOpen}
        title="Confirm selected waiting registrations?"
      >
        {selectedWaitingParticipants.length} selected waiting participant{selectedWaitingParticipants.length === 1 ? "" : "s"} will be confirmed.
      </ConfirmDialog>
      <ConfirmDialog
        confirmLabel="Delete Workshop"
        description="This removes the workshop master and its linked registration form."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget ? deleteRecord(deleteTarget.id) : undefined}
        open={Boolean(deleteTarget)}
        title="Delete workshop?"
      >
        {deleteTarget ? `${deleteTarget.name} · ${deleteTarget.facilitator}` : null}
      </ConfirmDialog>
      <ConfirmDialog
        confirmLabel="Delete Response"
        description="This removes this participant response from the workshop response list."
        onCancel={() => setDeleteResponseTarget(null)}
        onConfirm={() => deleteResponseTarget ? void deleteRegistrationResponse(deleteResponseTarget.id) : undefined}
        open={Boolean(deleteResponseTarget)}
        title="Delete response?"
      >
        {deleteResponseTarget ? `${deleteResponseTarget.fullName} · ${deleteResponseTarget.mobile}` : null}
      </ConfirmDialog>
      <ConfirmDialog
        confirmLabel={removingDuplicates ? "Removing..." : `Remove ${duplicateParticipantIds.length} Duplicates`}
        description="The newest registration for each matching mobile, email or name will be kept. Older duplicates will be permanently deleted."
        onCancel={() => {
          if (!removingDuplicates) setRemoveDuplicatesOpen(false);
        }}
        onConfirm={() => void removeDuplicateRegistrationResponses()}
        open={removeDuplicatesOpen}
        title="Remove duplicate registrations?"
      >
        This action affects only {selectedWorkshop?.name || "the selected workshop"} and cannot be undone.
      </ConfirmDialog>
    </AdminPlatformShell>
  );
}

function FollowUpModal({
  entry,
  onClose,
  onSave
}: {
  entry: RegistrationEntry;
  onClose: () => void;
  onSave: (status: RegistrationEntry["confirmationStatus"], note: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<RegistrationEntry["confirmationStatus"]>(entry.confirmationStatus ?? "pending");
  const [note, setNote] = useState(entry.confirmationNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave(status, note);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update follow-up.");
      setSaving(false);
    }
  }

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-0 sm:place-items-center sm:p-4" role="dialog">
      <section className="w-full max-w-xl rounded-t-2xl bg-white shadow-2xl sm:rounded-lg">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div><p className="text-xs font-black uppercase text-emerald-700">Participant follow-up</p><h2 className="mt-1 text-xl font-black">{entry.fullName}</h2><p className="mt-1 text-sm font-bold text-slate-500">{entry.mobile}</p></div>
          <button aria-label="Close follow-up editor" className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>
        <div className="p-5">
          {error ? <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
          <label className="block text-sm font-black text-slate-700">Confirmation
            <select className={`${inputClass} mt-2`} onChange={(event) => setStatus(event.target.value as RegistrationEntry["confirmationStatus"])} value={status}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="not_confirmed">Not confirmed</option>
              <option value="no_answer">No answer</option>
              <option value="callback">Call back</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="mt-4 block text-sm font-black text-slate-700">Call note
            <textarea className={`${inputClass} mt-2 min-h-32 resize-y`} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="Add call outcome or follow-up details..." value={note} />
          </label>
          <button className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-60" disabled={saving} onClick={() => void save()} type="button"><Save className="size-4" />{saving ? "Saving..." : "Save follow-up"}</button>
        </div>
      </section>
    </div>
  );
}

function ShareSelectedResponsesModal({
  entries,
  onClose,
  onCreated,
  workshop
}: {
  entries: RegistrationEntry[];
  onClose: () => void;
  onCreated: () => void;
  workshop: WorkshopRecord;
}) {
  const [recipientName, setRecipientName] = useState("");
  const [recipientContact, setRecipientContact] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [copied, setCopied] = useState("");

  async function createLink() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/response-access", {
        body: JSON.stringify({
          accessCode,
          active: true,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : "",
          permissions: { exportCsv: false, manageConfirmations: true, revealContact: true, viewAnswers: false },
          recipientContact,
          recipientName,
          registrationIds: entries.map((entry) => entry.id),
          workshopIds: [workshop.id]
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json().catch(() => ({})) as { error?: string; path?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Could not create sharing link.");
      setCreatedLink(`${window.location.origin}${result.path}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create sharing link.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  }

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-0 sm:place-items-center sm:p-4" role="dialog">
      <section className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-lg">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div><p className="text-xs font-black uppercase text-emerald-700">Restricted response access</p><h2 className="mt-1 text-xl font-black">Share {entries.length} selected participant{entries.length === 1 ? "" : "s"}</h2><p className="mt-1 text-sm font-bold text-slate-500">{workshop.name}</p></div>
          <button aria-label="Close share dialog" className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500" onClick={createdLink ? onCreated : onClose} type="button"><X className="size-4" /></button>
        </header>
        <div className="p-5">
          {error ? <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
          {createdLink ? (
            <div>
              <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">Secure link created. Only the selected participants are included.</p>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="break-all font-mono text-xs font-bold text-slate-700">{createdLink}</p><button className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white" onClick={() => void copy(createdLink, "Link copied")} type="button"><Copy className="size-4" />{copied === "Link copied" ? copied : "Copy link"}</button></div>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Access code</p><p className="mt-1 font-mono text-lg font-black">{accessCode}</p><button className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-black" onClick={() => void copy(accessCode, "Code copied")} type="button"><Copy className="size-4" />{copied === "Code copied" ? copied : "Copy code"}</button></div>
              <button className="mt-5 min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-sm font-black text-white" onClick={onCreated} type="button">Done</button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-black text-slate-700">Recipient name<input className={`${inputClass} mt-2`} maxLength={150} onChange={(event) => setRecipientName(event.target.value)} placeholder="Person or team name" value={recipientName} /></label>
                <label className="text-sm font-black text-slate-700">Mobile or email<input className={`${inputClass} mt-2`} maxLength={200} onChange={(event) => setRecipientContact(event.target.value)} placeholder="Optional" value={recipientContact} /></label>
                <label className="text-sm font-black text-slate-700">Access code<input className={`${inputClass} mt-2`} maxLength={32} minLength={4} onChange={(event) => setAccessCode(event.target.value)} placeholder="Minimum 4 characters" value={accessCode} /></label>
                <label className="text-sm font-black text-slate-700">Expires on<input className={`${inputClass} mt-2`} min={new Date().toISOString().slice(0, 16)} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} /></label>
              </div>
              <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-600">The recipient can see contact details and update confirmation status and call notes for these selected participants only.</p>
              <button className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50" disabled={saving || !recipientName.trim() || accessCode.trim().length < 4 || entries.length === 0} onClick={() => void createLink()} type="button"><Share2 className="size-4" />{saving ? "Creating..." : "Create secure sharing link"}</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function workshopSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function registrationSlug(workshop: WorkshopRecord) {
  return publicFormSlug("r", workshop.id);
}

function readMasterNames(key: string, defaults: string[]) {
  try {
    const records = readLocalArray<{ name?: string }>(key);
    const names = records.map((record) => record.name?.trim()).filter(Boolean) as string[];
    return names.length ? names : defaults;
  } catch {
    return defaults;
  }
}

function compressImage(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas not supported"));
          return;
        }
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        const outputType = file.type === "image/jpeg" || file.type === "image/jpg" ? "image/jpeg" : "image/png";
        resolve(outputType === "image/jpeg" ? canvas.toDataURL(outputType, IMAGE_QUALITY) : canvas.toDataURL(outputType));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildFormPages(fields: BuilderField[], mode: BuilderFormMode) {
  if (mode === "classic") return [{ fields, title: "" }];
  if (mode === "guided") {
    let sectionTitle = "";
    return fields.flatMap((field) => {
      if (field.type === "heading") {
        sectionTitle = field.label;
        return [];
      }
      return [{ fields: [field], title: sectionTitle }];
    });
  }

  const pages: Array<{ fields: BuilderField[]; title: string }> = [];
  let current = { fields: [] as BuilderField[], title: "Your details" };
  fields.forEach((field) => {
    if (field.type === "heading") {
      if (current.fields.length) pages.push(current);
      current = { fields: [], title: field.label || `Step ${pages.length + 1}` };
      return;
    }
    current.fields.push(field);
  });
  if (current.fields.length) pages.push(current);
  return pages.length ? pages : [{ fields: [], title: "Your details" }];
}

function FormExperienceControls({
  mode,
  onModeChange,
  onThemeChange,
  theme
}: {
  mode: BuilderFormMode;
  onModeChange: (mode: BuilderFormMode) => void;
  onThemeChange: (patch: Partial<BuilderTheme>) => void;
  theme: BuilderTheme;
}) {
  const modes: Array<{ icon: typeof LayoutList; label: string; value: BuilderFormMode }> = [
    { icon: LayoutList, label: "Classic", value: "classic" },
    { icon: Route, label: "Multi-step", value: "steps" },
    { icon: Sparkles, label: "Guided", value: "guided" }
  ];

  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 marker:content-none">
        <span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><Palette className="size-4" /></span><span><span className="block text-sm font-black text-slate-800">Experience & Theme</span><span className="block text-[11px] font-semibold text-slate-500">{modes.find((item) => item.value === mode)?.label} · {formFonts.find((font) => font.value === theme.fontFamily)?.label || "Custom"}</span></span></span>
        <ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-200 px-3.5 pb-3.5 pt-3">
      <div>
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Form experience</span>
        <div className="grid grid-cols-3 gap-2">
          {modes.map((item) => {
            const Icon = item.icon;
            return <button className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition ${mode === item.value ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`} key={item.value} onClick={() => onModeChange(item.value)} type="button"><Icon className="size-4" />{item.label}</button>;
          })}
        </div>
        {mode === "steps" ? <p className="mt-2 text-xs font-semibold text-slate-500">Section Heading fields create separate steps.</p> : null}
        {mode === "guided" ? <p className="mt-2 text-xs font-semibold text-slate-500">Customers see one question at a time with keyboard-friendly navigation.</p> : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Theme presets</span>
          <div className="grid grid-cols-2 gap-2">
            {themePresets.map((preset) => <button className="flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-bold text-slate-700 hover:border-emerald-300" key={preset.label} onClick={() => onThemeChange(preset)} type="button"><span className="size-4 shrink-0 rounded-full border border-white shadow ring-1 ring-slate-200" style={{ backgroundColor: preset.accent }} />{preset.label}</button>)}
          </div>
        </div>
        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Font style</span>
          <select className={inputClass} onChange={(event) => onThemeChange({ fontFamily: event.target.value })} value={theme.fontFamily}>{formFonts.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}</select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Accent color</span>
          <span className="flex min-h-[48px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3"><input className="size-7 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => onThemeChange({ accent: event.target.value })} type="color" value={theme.accent} /><span className="text-xs font-black uppercase text-slate-600">{theme.accent}</span></span>
        </label>
        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Page background</span>
          <span className="flex min-h-[48px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3"><input className="size-7 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => onThemeChange({ backgroundColor: event.target.value })} type="color" value={theme.backgroundColor || "#f1f5f9"} /><span className="text-xs font-black uppercase text-slate-600">{theme.backgroundColor}</span></span>
        </label>
        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Field corners</span>
          <select className={inputClass} onChange={(event) => onThemeChange({ fieldRadius: event.target.value as BuilderTheme["fieldRadius"] })} value={theme.fieldRadius || "rounded"}><option value="soft">Soft</option><option value="rounded">Rounded</option><option value="square">Compact</option></select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Logo size</span>
          <span className="flex min-h-[48px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
            <input
              aria-label="Logo size"
              className="h-2 flex-1 accent-emerald-600"
              max={240}
              min={72}
              onChange={(event) => onThemeChange({ logoSize: Number(event.target.value) })}
              step={4}
              type="range"
              value={theme.logoSize || defaultTheme.logoSize || 140}
            />
            <span className="w-12 text-right text-xs font-black text-slate-600">{theme.logoSize || defaultTheme.logoSize || 140}px</span>
          </span>
        </label>
        <div>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Logo position</span>
          <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-white p-1">
            {(["left", "center", "right"] as const).map((value) => (
              <button
                className={`rounded-lg px-3 py-2.5 text-xs font-black capitalize ${(theme.logoAlign || defaultTheme.logoAlign) === value ? "bg-slate-950 text-white" : "text-slate-500"}`}
                key={value}
                onClick={() => onThemeChange({ logoAlign: value })}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Content alignment</span>
          <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1"><button className={`rounded-lg px-3 py-2.5 text-xs font-black ${theme.align === "left" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => onThemeChange({ align: "left" })} type="button">Left</button><button className={`rounded-lg px-3 py-2.5 text-xs font-black ${theme.align === "center" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => onThemeChange({ align: "center" })} type="button">Center</button></div>
        </div>
      </div>
      </div>
    </details>
  );
}

function FormAnalyticsSummary({ analytics, fields }: { analytics: FormAnalyticsRecord; fields: BuilderField[] }) {
  const conversion = analytics.starts ? Math.round((analytics.completions / analytics.starts) * 100) : 0;
  const topDropOff = Object.entries(analytics.dropOffByField ?? {}).sort((a, b) => b[1] - a[1])[0];
  const dropOffLabel = topDropOff ? fields.find((field) => field.id === topDropOff[0])?.label || "Unknown field" : "No drop-off yet";
  return (
    <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
      <div className="flex items-center gap-2"><BarChart3 className="size-4 text-indigo-700" /><p className="text-sm font-black text-slate-800">Form performance</p></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[{ label: "Views", value: analytics.views }, { label: "Started", value: analytics.starts }, { label: "Completed", value: analytics.completions }, { label: "Conversion", value: `${conversion}%` }].map((metric) => <div className="rounded-xl border border-indigo-100 bg-white px-3 py-3" key={metric.label}><p className="text-lg font-black text-indigo-800">{metric.value}</p><p className="text-[11px] font-bold text-slate-500">{metric.label}</p></div>)}
      </div>
      <p className="mt-3 text-xs font-bold text-slate-600">Top drop-off: <span className="text-slate-950">{dropOffLabel}{topDropOff ? ` (${topDropOff[1]})` : ""}</span></p>
    </div>
  );
}

function WorkshopFormLivePreview({
  description,
  fields,
  highlights,
  logoUrl,
  mode,
  paid,
  submitButtonText,
  tagline,
  theme,
  title
}: {
  description: string;
  fields: BuilderField[];
  highlights: string[];
  logoUrl: string;
  mode: BuilderFormMode;
  paid: boolean;
  submitButtonText: string;
  tagline: string;
  theme: BuilderTheme;
  title: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const [previewPage, setPreviewPage] = useState(0);
  const visibleHighlights = highlights.map((item) => item.trim()).filter(Boolean);
  const displayLogoUrl = logoUrl || BRAND_LOGO_SRC;
  const pages = useMemo(() => buildFormPages(fields, mode), [fields, mode]);
  const activePage = pages[Math.min(previewPage, Math.max(0, pages.length - 1))] ?? { fields, title: "" };
  const accent = theme.accent || defaultTheme.accent;
  const radiusClass = theme.fieldRadius === "square" ? "rounded-md" : theme.fieldRadius === "soft" ? "rounded-lg" : "rounded-xl";
  const logoAlign = theme.logoAlign || defaultTheme.logoAlign || "center";
  const logoSize = Math.min(Math.max(theme.logoSize || defaultTheme.logoSize || 140, 72), 240);
  const logoPositionClass = logoAlign === "center" ? "mx-auto" : logoAlign === "right" ? "ml-auto" : "";

  useEffect(() => {
    setPreviewPage((current) => Math.min(current, Math.max(0, pages.length - 1)));
  }, [pages.length]);

  return (
    <aside className="xl:sticky xl:top-20 xl:self-start">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Live Preview</p>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button aria-label="Desktop preview" className={`grid size-8 place-items-center rounded-md ${device === "desktop" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setDevice("desktop")} type="button"><Monitor className="size-4" /></button>
          <button aria-label="Mobile preview" className={`grid size-8 place-items-center rounded-md ${device === "mobile" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setDevice("mobile")} type="button"><Smartphone className="size-4" /></button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 p-2.5 shadow-[0_12px_30px_-22px_rgba(15,23,42,0.5)]" style={{ backgroundColor: theme.backgroundColor || defaultTheme.backgroundColor }}>
        <div className={`mx-auto overflow-hidden border border-slate-200 shadow-sm transition-all ${device === "mobile" ? "max-w-[320px] rounded-[28px]" : "w-full rounded-2xl"}`} style={{ backgroundColor: theme.surfaceColor || "#ffffff", fontFamily: theme.fontFamily }}>
          <div className="h-2" style={{ backgroundColor: accent }} />
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-4">
            {displayLogoUrl ? <img alt="Coach For Life" className={`mb-3 h-auto max-w-full object-contain ${logoPositionClass}`} src={displayLogoUrl} style={{ width: logoSize }} /> : null}
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>CFL Workshop Registration</p>
            <h4 className="mt-2 text-2xl font-black leading-tight text-slate-950">{title || "Workshop Registration"}</h4>
            {tagline.trim() ? <p className="mt-2 text-sm font-bold text-slate-600">{tagline.trim()}</p> : null}
            {description ? <div className="rich-text-content mt-3 text-sm leading-relaxed text-slate-500" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(description) }} /> : null}
            <span className={`mt-4 inline-flex px-4 py-2 text-sm font-black text-white shadow-sm ${radiusClass}`} style={{ backgroundColor: accent }}>{paid ? "Paid Registration" : "Free Registration"}</span>

            {mode !== "classic" && pages.length > 1 ? (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-[11px] font-black text-slate-500"><span>{mode === "guided" ? "Question" : "Step"} {previewPage + 1} of {pages.length}</span><span>{Math.round(((previewPage + 1) / pages.length) * 100)}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ backgroundColor: accent, width: `${((previewPage + 1) / pages.length) * 100}%` }} /></div>
              </div>
            ) : null}

            {activePage.title ? <h5 className="mt-5 text-lg font-black text-slate-900">{activePage.title}</h5> : null}
            <div className="mt-5 space-y-3">
              {activePage.fields.map((field) => <PreviewField field={field} key={field.id} radiusClass={radiusClass} />)}
            </div>

            {mode === "classic" && visibleHighlights.length ? (
              <div className="mt-5 border p-4" style={{ borderColor: `${accent}22`, backgroundColor: `${accent}0d`, borderRadius: theme.fieldRadius === "square" ? 6 : 14 }}>
                <p className="mb-3 text-sm font-black text-slate-800">What&apos;s included</p>
                <ul className="space-y-2">{visibleHighlights.map((item) => <li className="flex items-start gap-2 text-sm font-semibold text-slate-700" key={item}><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: accent }}><Check className="size-3" /></span>{item}</li>)}</ul>
              </div>
            ) : null}

            <div className="mt-5 flex gap-2">
              {mode !== "classic" && previewPage > 0 ? <button className={`border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 ${radiusClass}`} onClick={() => setPreviewPage((value) => Math.max(0, value - 1))} type="button">Back</button> : null}
              <button className={`flex flex-1 items-center justify-center px-4 py-3 text-sm font-black uppercase text-white shadow-sm ${radiusClass}`} onClick={() => setPreviewPage((value) => Math.min(pages.length - 1, value + 1))} style={{ backgroundColor: accent }} type="button">{mode !== "classic" && previewPage < pages.length - 1 ? "Continue" : (submitButtonText.trim() || (paid ? "Register & Pay" : "Confirm Registration"))}</button>
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-slate-400">Progress saves automatically.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PreviewField({ field, radiusClass = "rounded-xl" }: { field: BuilderField; radiusClass?: string }) {
  if (field.type === "heading") {
    return <h5 className="border-t border-slate-100 pt-3 text-base font-black text-slate-900">{field.label || "Section heading"}</h5>;
  }

  const options = field.options?.filter(Boolean) ?? [];
  const isChoice = field.type === "dropdown" || field.type === "radio" || field.type === "checkbox";

  return (
    <div>
      <label className="mb-1.5 block text-sm font-black text-slate-700">
        {field.label || fieldTypeMeta[field.type].label}
        {field.required ? <span className="text-emerald-600"> *</span> : null}
      </label>
      {isChoice ? (
        <div className="space-y-2">
          {(options.length ? options : ["Option 1", "Option 2"]).map((option) => (
            <div className={`flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600 ${radiusClass}`} key={option}>
              <span className={`grid size-4 shrink-0 place-items-center border border-slate-300 bg-white ${field.type === "checkbox" ? "rounded" : "rounded-full"}`} />
              {option}
            </div>
          ))}
          {field.allowOther ? (
            <input
              className={`w-full border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-400 ${radiusClass}`}
              disabled
              placeholder="Other"
            />
          ) : null}
        </div>
      ) : (
        <input
          className={`w-full border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-400 ${radiusClass}`}
          disabled
          placeholder={field.placeholder || fieldTypeMeta[field.type].label}
        />
      )}
    </div>
  );
}

function RichTextEditor({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isEditingRef = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (isEditingRef.current && document.activeElement === editor) return;
    const safeValue = sanitizeRichTextHtml(value);
    if (editor.innerHTML !== safeValue) {
      editor.innerHTML = safeValue;
    }
  }, [value]);

  function syncValue() {
    onChange(sanitizeRichTextHtml(editorRef.current?.innerHTML ?? ""));
  }

  function runCommand(command: "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "foreColor", payload?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, payload);
    syncValue();
  }

  function pastePlainText(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    syncValue();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-2">
        <button className="grid size-9 place-items-center rounded-lg text-slate-700 hover:bg-white" onClick={() => runCommand("bold")} title="Bold" type="button">
          <Bold className="size-4" />
        </button>
        <button className="grid size-9 place-items-center rounded-lg text-slate-700 hover:bg-white" onClick={() => runCommand("italic")} title="Italic" type="button">
          <Italic className="size-4" />
        </button>
        <button className="grid size-9 place-items-center rounded-lg text-slate-700 hover:bg-white" onClick={() => runCommand("underline")} title="Underline" type="button">
          <Underline className="size-4" />
        </button>
        <button className="grid size-9 place-items-center rounded-lg text-slate-700 hover:bg-white" onClick={() => runCommand("insertUnorderedList")} title="Bullet list" type="button">
          <List className="size-4" />
        </button>
        <button className="grid size-9 place-items-center rounded-lg text-slate-700 hover:bg-white" onClick={() => runCommand("insertOrderedList")} title="Numbered list" type="button">
          <ListOrdered className="size-4" />
        </button>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <Palette className="ml-1 size-4 text-slate-400" />
        {richTextColors.map((color) => (
          <button
            aria-label={`Text color ${color}`}
            className="size-7 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200"
            key={color}
            onClick={() => runCommand("foreColor", color)}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
      <div
        className="rich-text-editor min-h-28 px-3.5 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none focus:ring-4 focus:ring-emerald-100"
        contentEditable
        onBlur={() => {
          isEditingRef.current = false;
          syncValue();
        }}
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onInput={syncValue}
        onPaste={pastePlainText}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
      <p className="border-t border-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-400">Enter creates a new line. Use toolbar for bold, italic, underline, lists and text color.</p>
    </div>
  );
}

function FormLogoUploader({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      onChange(await compressImage(file, MAX_LOGO_WIDTH));
    } catch {
      // Keep the existing logo if the browser cannot process the selected image.
    }
  }

  return (
    <div>
      <span className="mb-2 block text-sm font-bold text-slate-600">Form Logo</span>
      <div className="flex min-h-[74px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
        {value ? (
          <img alt="Form logo preview" className="size-14 rounded-xl object-cover ring-1 ring-slate-200" src={value} />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
            <Image className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-700">{value ? "Logo selected" : "No logo selected"}</p>
          <p className="text-xs font-semibold text-slate-400">Shown at the top of the public registration form.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => inputRef.current?.click()} type="button">
            Change
          </button>
          {value ? (
            <button className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100" onClick={() => onChange("")} type="button">
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <input accept="image/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} ref={inputRef} type="file" />
    </div>
  );
}

function RegistrationLinkModal({ workshop, onClose }: { workshop: WorkshopRecord; onClose: () => void }) {
  const [paid, setPaid] = useState(workshop.isPaid);
  const [fee, setFee] = useState(workshop.feesWithTax ?? "");
  const [partPayment, setPartPayment] = useState(Boolean(workshop.isPartPaymentAllow));
  const [batch, setBatch] = useState(workshop.batch ?? "Main Batch");
  const [venue, setVenue] = useState("");
  const [published, setPublished] = useState(true);
  const [publishUntil, setPublishUntil] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [waitingMode, setWaitingMode] = useState(false);
  const [waitingTitle, setWaitingTitle] = useState("Waiting List Registration");
  const [waitingMessage, setWaitingMessage] = useState("Seats are currently full. Your registration will be added to the waiting list.");
  const [registrationDomains, setRegistrationDomains] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [linkSettingsLoaded, setLinkSettingsLoaded] = useState(false);
  const shortSlug = useMemo(() => registrationSlug(workshop), [workshop]);

  const link = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildRegistrationUrl({ baseUrl: customBaseUrl, slug: shortSlug });
  }, [customBaseUrl, shortSlug]);
  const qrUrl = link ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(link)}` : "";
  const linkExpired = publishUntil ? new Date(publishUntil).getTime() <= Date.now() : false;
  const linkStatus = !published ? "Unpublished" : linkExpired ? "Expired" : "Published";
  const linkStatusClass = published && !linkExpired ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
  const selectedDomainOption = customBaseUrl
    ? registrationDomains.includes(normalizeBaseUrl(customBaseUrl)) ? normalizeBaseUrl(customBaseUrl) : "__custom"
    : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const configs = readLocalObject<Record<string, RegistrationLinkConfig>>(REGISTRATION_LINK_CONFIG_STORAGE_KEY);
      const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
      const savedForm = forms.find((item) => item.workshopId === workshop.id || item.workshopSlug === workshopSlug(workshop.name));
      const existing = configs[shortSlug] ?? Object.values(configs).find((config) => config.id === workshop.id);
      if (existing) {
        setBatch(existing.batch || "Main Batch");
        setFee(existing.fee ? String(existing.fee) : "");
        setPaid(Boolean(existing.paid));
        setPartPayment(Boolean(existing.partPayment));
        setVenue(existing.venue === "TBA" ? "" : existing.venue || "");
        setPublished(existing.published !== false);
        setPublishUntil(existing.publishUntil || "");
        setCustomBaseUrl(existing.customBaseUrl || "");
        setOtpRequired(Boolean(existing.otpRequired));
      } else {
        setOtpRequired(Boolean(savedForm?.otpRequired));
      }
      setWaitingMode(Boolean(savedForm?.waitingMode));
      setWaitingTitle(savedForm?.waitingTitle || "Waiting List Registration");
      setWaitingMessage(savedForm?.waitingMessage || "Seats are currently full. Your registration will be added to the waiting list.");
    } catch {
      // Use defaults if saved link settings are not readable.
    } finally {
      setLinkSettingsLoaded(true);
    }
  }, [shortSlug, workshop.id]);

  useEffect(() => {
    async function loadRegistrationDomains() {
      try {
        const response = await fetch("/api/integrations/settings", { cache: "no-store" });
        const data = await response.json();
        const domains = Array.isArray(data?.settings?.registrationDomains) ? data.settings.registrationDomains : [];
        setRegistrationDomains(domains.map((domain: string) => normalizeBaseUrl(domain)).filter(Boolean));
      } catch {
        setRegistrationDomains([]);
      }
    }
    void loadRegistrationDomains();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!linkSettingsLoaded) return;
    try {
      const configs = readLocalObject<Record<string, RegistrationLinkConfig>>(REGISTRATION_LINK_CONFIG_STORAGE_KEY);
      configs[shortSlug] = {
        batch: batch.trim() || "Main Batch",
        customBaseUrl: normalizeBaseUrl(customBaseUrl) || undefined,
        facilitator: workshop.facilitator || "CFL Facilitator",
        fee: paid ? Number(fee) || 0 : 0,
        id: workshop.id,
        otpRequired,
        paid,
        partPayment,
        publishUntil: publishUntil || undefined,
        published,
        slug: shortSlug,
        title: workshop.name,
        venue: venue.trim() || "TBA"
      };
      const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
      const existingForm = forms.find((item) => item.workshopId === workshop.id || item.workshopSlug === workshopSlug(workshop.name));
      const nextForms = existingForm ? [{ ...existingForm, waitingMode, waitingTitle: waitingTitle.trim() || undefined, waitingMessage: waitingMessage.trim() || undefined, updatedAt: new Date().toISOString() }, ...forms.filter((item) => item.id !== existingForm.id)] : forms;
      void saveLiveState({ forms: nextForms, registrationLinks: configs });
      setSaveStatus("saved");
      const timeout = window.setTimeout(() => setSaveStatus("idle"), 1600);
      return () => window.clearTimeout(timeout);
    } catch {
      // The link still opens from Workshop Master fallback if storage is unavailable.
    }
  }, [batch, customBaseUrl, fee, linkSettingsLoaded, otpRequired, paid, partPayment, publishUntil, published, shortSlug, venue, waitingMessage, waitingMode, waitingTitle, workshop]);

  async function copyLink() {
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = link;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      textarea.remove();
    }

    setCopyStatus(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyStatus("idle"), 2400);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Edit Registration Link</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{workshop.name}</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">{saveStatus === "saved" ? "Link settings saved" : "Change batch, venue, payment and QR anytime."}</p>
          </div>
          <button className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={onClose} type="button"><X className="size-4" /></button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-800">Link Publish Status</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Set an expiry time to automatically close this registration link.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${linkStatusClass}`}>{linkStatus}</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
              <button
                className={`inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-black text-white ${published ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                onClick={() => setPublished((value) => !value)}
                type="button"
              >
                {published ? "Unpublish Link" : "Publish Link"}
              </button>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Publish Until</span>
                <input className={inputClass} onChange={(event) => setPublishUntil(event.target.value)} type="datetime-local" value={publishUntil} />
                <span className="mt-1 block text-xs font-semibold text-slate-400">Leave blank if the link should not expire automatically.</span>
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Batch</span>
              <input className={inputClass} onChange={(event) => setBatch(event.target.value)} placeholder="Main Batch" value={batch} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Venue</span>
              <input className={inputClass} onChange={(event) => setVenue(event.target.value)} placeholder="Online / City / Address" value={venue} />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap gap-3">
              <button
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${!paid ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPaid(false)}
                type="button"
              >
                Free Registration
              </button>
              <button
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${paid ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setPaid(true)}
                type="button"
              >
                Paid Registration
              </button>
            </div>

            {paid ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">Fee (INR)</span>
                  <input className={inputClass} inputMode="numeric" onChange={(event) => setFee(event.target.value)} placeholder="0" value={fee} />
                </label>
                <label className="flex min-h-[44px] items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                  <input checked={partPayment} className="size-5 accent-emerald-600" onChange={(event) => setPartPayment(event.target.checked)} type="checkbox" />
                  Allow part payment
                </label>
              </div>
            ) : null}
          </div>

          <label className="flex min-h-[58px] items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <span>
              <span className="block text-sm font-black text-slate-800">WhatsApp OTP Required</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-500">Participants must verify WhatsApp OTP before this registration link can submit.</span>
            </span>
            <input checked={otpRequired} className="size-5 shrink-0 accent-emerald-600" onChange={(event) => setOtpRequired(event.target.checked)} type="checkbox" />
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <label className="flex min-h-[48px] items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-black text-slate-800">Waiting Mode</span>
                <span className="mt-0.5 block text-xs font-semibold text-slate-500">Waiting content below is shown on the public registration link.</span>
              </span>
              <input checked={waitingMode} className="size-5 shrink-0 accent-amber-600" onChange={(event) => setWaitingMode(event.target.checked)} type="checkbox" />
            </label>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Waiting Heading</span>
                <input className={inputClass} maxLength={80} onChange={(event) => setWaitingTitle(event.target.value)} value={waitingTitle} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Waiting Message</span>
                <textarea className={inputClass} maxLength={240} onChange={(event) => setWaitingMessage(event.target.value)} rows={3} value={waitingMessage} />
              </label>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div>
            <div className="mb-3 grid gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Registration Domain</span>
                <select
                  className={inputClass}
                  onChange={(event) => {
                    if (event.target.value === "__custom") return;
                    setCustomBaseUrl(event.target.value);
                  }}
                  value={selectedDomainOption}
                >
                  <option value="">Current dashboard domain</option>
                  {registrationDomains.map((domain) => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                  {customBaseUrl && selectedDomainOption === "__custom" ? <option value="__custom">Custom domain</option> : null}
                </select>
                <span className="mt-1 block text-xs font-semibold text-slate-400">Add reusable subdomains in Settings. Leave current dashboard domain if no custom subdomain is connected.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Custom Domain</span>
                <input className={inputClass} onChange={(event) => setCustomBaseUrl(event.target.value)} placeholder="https://register.cflb.in" value={customBaseUrl} />
              </label>
            </div>
            <span className="mb-2 block text-sm font-bold text-slate-600">Shareable Link</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold text-slate-700">{link}</span>
              <button className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800" onClick={copyLink} type="button">
                <Copy className="size-4" />
                {copyStatus === "copied" ? "Copied" : "Copy"}
              </button>
              <a className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" href={link} rel="noreferrer" target="_blank">
                <ExternalLink className="size-4" />
                Open
              </a>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {copyStatus === "failed" ? "Copy was blocked. Select the link and copy it manually." : "Short link saved. Open the link or scan the QR code to view the registration form."}
            </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <div className="mx-auto mb-3 flex items-center justify-center gap-2 text-sm font-black text-slate-700">
                <QrCode className="size-4" />
                Registration QR
              </div>
              {qrUrl ? <img alt="Registration QR code" className="mx-auto size-44 rounded-xl border border-slate-100 bg-white p-2" src={qrUrl} /> : null}
              {qrUrl ? (
                <a className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50" download={`qr-${shortSlug}.png`} href={qrUrl}>
                  <Download className="size-3.5" />
                  Download QR
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldEditor({
  field,
  fields,
  index,
  onChange,
  onDuplicate,
  onMoveDown,
  onMoveUp,
  onRemove,
  total
}: {
  field: BuilderField;
  fields: BuilderField[];
  index: number;
  onChange: (patch: Partial<BuilderField>) => void;
  onDuplicate: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  total: number;
}) {
  const meta = fieldTypeMeta[field.type];
  const Icon = field.type === "email" ? Mail : field.type === "mobile" ? Smartphone : field.type === "heading" ? Heading : field.type === "checkbox" ? CheckSquare : field.type === "radio" ? Circle : Type;
  const lockedRole = field.role === "name" || field.role === "mobile";
  const options = field.options?.length ? field.options : ["Option 1", "Option 2"];
  const sourceFields = fields.slice(0, index).filter((item) => item.type !== "heading");
  const visibilitySource = sourceFields.find((item) => item.id === field.visibility?.fieldId);
  const updateOption = (optionIndex: number, value: string) => {
    onChange({ options: options.map((option, currentIndex) => currentIndex === optionIndex ? value : option).filter((option) => option.trim()) });
  };
  const removeOption = (optionIndex: number) => {
    const next = options.filter((_, currentIndex) => currentIndex !== optionIndex);
    onChange({ options: next.length ? next : ["Option 1"] });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-300">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="size-4" />
        </span>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="Field label"
          value={field.label}
        />
        <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 sm:inline">{meta.label}</span>
        <div className="hidden items-center gap-0.5 sm:flex">
          <IconButton disabled={index === 0} onClick={onMoveUp} title="Move up"><ArrowUp className="size-3.5" /></IconButton>
          <IconButton disabled={index === total - 1} onClick={onMoveDown} title="Move down"><ArrowDown className="size-3.5" /></IconButton>
          <IconButton onClick={onDuplicate} title="Duplicate"><Copy className="size-3.5" /></IconButton>
          <IconButton disabled={lockedRole} onClick={onRemove} title={lockedRole ? "Core field" : "Delete"} tone="danger"><Trash2 className="size-3.5" /></IconButton>
        </div>
      </div>

      {isHeightField(field.type, field.label) ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:pl-11">
          <input
            aria-label="Height preview in feet"
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-500"
            disabled
            placeholder="Feet"
          />
          <input
            aria-label="Height preview in inches"
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-500"
            disabled
            placeholder="Inches"
          />
          <span className="col-span-2 flex min-h-[42px] items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 text-xs font-black text-emerald-700 sm:col-span-1 sm:min-w-[104px] sm:justify-center">
            <span className="sm:hidden">Centimeters</span>
            -- cm
          </span>
        </div>
      ) : field.type !== "heading" ? (
        <div className="mt-1.5 sm:pl-10">
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => onChange({ placeholder: event.target.value })}
            placeholder="Placeholder text"
            value={field.placeholder ?? ""}
          />
        </div>
      ) : null}

      {meta.hasOptions ? (
        <div className="mt-3 space-y-2 sm:pl-11">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Options</p>
          {options.map((option, optionIndex) => (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2" key={`${field.id}-option-${optionIndex}`}>
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-black text-slate-500">{optionIndex + 1}</span>
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                onChange={(event) => updateOption(optionIndex, event.target.value)}
                placeholder={`Option ${optionIndex + 1}`}
                value={option}
              />
              <button className="grid size-9 shrink-0 place-items-center rounded-lg text-rose-500 hover:bg-rose-50" onClick={() => removeOption(optionIndex)} type="button">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => onChange({ options: [...options, `Option ${options.length + 1}`] })}
              type="button"
            >
              <Plus className="size-3.5" />
              Add Option
            </button>
            <label className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">
              <input checked={Boolean(field.allowOther)} className="size-4 accent-emerald-600" onChange={(event) => onChange({ allowOther: event.target.checked })} type="checkbox" />
              Add Other text option
            </label>
          </div>
        </div>
      ) : null}

      {field.type !== "heading" ? (
        <div className="mt-2 sm:pl-10">
          {field.visibility ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-800"><Route className="size-3.5" />Display logic</div>
                <button aria-label="Remove display logic" className="grid size-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50" onClick={() => onChange({ visibility: undefined })} type="button"><X className="size-4" /></button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none" onChange={(event) => onChange({ visibility: { ...field.visibility!, fieldId: event.target.value } })} value={field.visibility.fieldId}>
                  {sourceFields.map((item) => <option key={item.id} value={item.id}>{item.label || "Untitled field"}</option>)}
                </select>
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none" onChange={(event) => onChange({ visibility: { ...field.visibility!, operator: event.target.value as NonNullable<BuilderField["visibility"]>["operator"] } })} value={field.visibility.operator}>
                  <option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="contains">Contains</option><option value="answered">Is answered</option><option value="not_answered">Is not answered</option>
                </select>
                {field.visibility.operator === "answered" || field.visibility.operator === "not_answered" ? <div className="grid place-items-center rounded-lg border border-dashed border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-500">No value needed</div> : visibilitySource?.options?.length ? (
                  <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none" onChange={(event) => onChange({ visibility: { ...field.visibility!, value: event.target.value } })} value={field.visibility.value ?? ""}><option value="">Select value</option>{visibilitySource.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                ) : <input className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none" onChange={(event) => onChange({ visibility: { ...field.visibility!, value: event.target.value } })} placeholder="Match value" value={field.visibility.value ?? ""} />}
              </div>
            </div>
          ) : (
            <button className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-dashed border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={!sourceFields.length} onClick={() => sourceFields[0] && onChange({ visibility: { fieldId: sourceFields[0].id, operator: "equals", value: "" } })} type="button"><Route className="size-3.5" />Add display logic</button>
          )}
        </div>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 sm:pl-10">
        <label className="inline-flex min-h-[32px] items-center gap-2 text-xs font-bold text-slate-600">
          <input checked={Boolean(field.required)} className="size-4 accent-emerald-600" disabled={lockedRole} onChange={(event) => onChange({ required: event.target.checked })} type="checkbox" />
          Required
        </label>
        <div className="flex items-center gap-0.5 sm:hidden">
          <IconButton disabled={index === 0} onClick={onMoveUp} title="Move up"><ArrowUp className="size-4" /></IconButton>
          <IconButton disabled={index === total - 1} onClick={onMoveDown} title="Move down"><ArrowDown className="size-4" /></IconButton>
          <IconButton onClick={onDuplicate} title="Duplicate"><Copy className="size-4" /></IconButton>
          <IconButton disabled={lockedRole} onClick={onRemove} title={lockedRole ? "Core field" : "Delete"} tone="danger"><Trash2 className="size-4" /></IconButton>
        </div>
      </div>
    </div>
  );
}

function WorkshopHierarchyManager({ workshop, registrations, onChange }: { workshop: WorkshopRecord; registrations: RegistrationEntry[]; onChange: (batches: WorkshopBatch[]) => Promise<void> }) {
  const legacyBatch = useMemo<WorkshopBatch>(() => {
    const now = new Date().toISOString();
    return { id: `batch-${workshop.id}-main`, name: workshop.batch || "Main Batch", facilitator: workshop.facilitator, status: "open", introductionSessions: [], createdAt: now, updatedAt: now };
  }, [workshop.batch, workshop.facilitator, workshop.id]);
  const batches = workshop.batches?.length ? workshop.batches : [legacyBatch];
  const [selectedId, setSelectedId] = useState(batches[0]?.id || "");
  const [batchDraft, setBatchDraft] = useState({ name: "", code: "", startDate: "", endDate: "", venue: "", capacity: "" });
  const [sessionDraft, setSessionDraft] = useState({ title: "Introduction Session", sessionDate: "", startTime: "", endTime: "", venue: "", capacity: "" });
  const selected = batches.find((item) => item.id === selectedId) || batches[0];
  const selectedRegistrations = selected ? registrations.filter((entry) => entry.workshopId === workshop.id && (entry.batchId ? entry.batchId === selected.id : entry.batch === selected.name)) : [];

  useEffect(() => {
    if (!batches.some((item) => item.id === selectedId)) setSelectedId(batches[0]?.id || "");
  }, [batches, selectedId]);

  async function addBatch() {
    if (!batchDraft.name.trim()) return;
    const now = new Date().toISOString();
    const next: WorkshopBatch = {
      id: `batch-${workshop.id}-${generateId()}`,
      name: batchDraft.name.trim(), code: batchDraft.code.trim() || undefined,
      startDate: batchDraft.startDate || undefined, endDate: batchDraft.endDate || undefined,
      venue: batchDraft.venue.trim() || undefined, facilitator: workshop.facilitator,
      capacity: Math.max(0, Number(batchDraft.capacity) || 0) || undefined,
      status: "draft", introductionSessions: [], createdAt: now, updatedAt: now
    };
    await onChange([...batches, next]);
    setSelectedId(next.id);
    setBatchDraft({ name: "", code: "", startDate: "", endDate: "", venue: "", capacity: "" });
  }

  async function patchBatch(patch: Partial<WorkshopBatch>) {
    if (!selected) return;
    await onChange(batches.map((item) => item.id === selected.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  }

  async function addIntroductionSession() {
    if (!selected || !sessionDraft.title.trim() || !sessionDraft.sessionDate) return;
    const now = new Date().toISOString();
    const session: WorkshopIntroductionSession = {
      id: `intro-${selected.id}-${generateId()}`, title: sessionDraft.title.trim(), sessionDate: sessionDraft.sessionDate,
      startTime: sessionDraft.startTime || undefined, endTime: sessionDraft.endTime || undefined,
      venue: sessionDraft.venue.trim() || selected.venue, facilitator: selected.facilitator || workshop.facilitator,
      capacity: Math.max(0, Number(sessionDraft.capacity) || 0) || selected.capacity,
      status: "draft", createdAt: now, updatedAt: now
    };
    await patchBatch({ introductionSessions: [...selected.introductionSessions, session] });
    setSessionDraft({ title: "Introduction Session", sessionDate: "", startTime: "", endTime: "", venue: "", capacity: "" });
  }

  function registrationUrl(session?: WorkshopIntroductionSession) {
    const slug = workshopSlug(workshop.name) || workshop.id;
    const params = new URLSearchParams({ wid: workshop.id, batch: selected?.name || "Main Batch", batchId: selected?.id || "" });
    if (session) params.set("introSessionId", session.id);
    return `/register/${slug}?${params.toString()}`;
  }

  return <section className="mt-7 rounded-3xl border border-violet-200 bg-violet-50/40 p-4 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Batch Workspace</p><h3 className="mt-1 text-xl font-black text-slate-950">{workshop.name} batches and introduction sessions</h3><p className="mt-1 text-sm font-semibold text-slate-500">Participants, attendance and CRM activity stay linked to the selected batch and intro session.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">{batches.length} batches</span></div>
    <div className="mt-5 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-2">{batches.map((item) => { const count = registrations.filter((entry) => entry.workshopId === workshop.id && (entry.batchId ? entry.batchId === item.id : entry.batch === item.name)).length; return <button className={`w-full rounded-xl border p-3 text-left ${selected?.id === item.id ? "border-violet-500 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700"}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button"><span className="block font-black">{item.name}</span><span className={`mt-1 block text-xs font-bold ${selected?.id === item.id ? "text-violet-100" : "text-slate-500"}`}>{count} participants · {item.introductionSessions.length} intro sessions</span></button>; })}
        <div className="rounded-xl border border-dashed border-violet-300 bg-white p-3"><p className="text-sm font-black text-slate-800">Create another batch</p><div className="mt-3 space-y-2"><input className={inputClass} onChange={(e) => setBatchDraft({ ...batchDraft, name: e.target.value })} placeholder="Batch name" value={batchDraft.name} /><input className={inputClass} onChange={(e) => setBatchDraft({ ...batchDraft, code: e.target.value })} placeholder="Batch code" value={batchDraft.code} /><div className="grid grid-cols-2 gap-2"><input className={inputClass} onChange={(e) => setBatchDraft({ ...batchDraft, startDate: e.target.value })} type="date" value={batchDraft.startDate} /><input className={inputClass} onChange={(e) => setBatchDraft({ ...batchDraft, endDate: e.target.value })} type="date" value={batchDraft.endDate} /></div><input className={inputClass} onChange={(e) => setBatchDraft({ ...batchDraft, venue: e.target.value })} placeholder="Venue / city" value={batchDraft.venue} /><input className={inputClass} inputMode="numeric" onChange={(e) => setBatchDraft({ ...batchDraft, capacity: e.target.value })} placeholder="Capacity" value={batchDraft.capacity} /><button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!batchDraft.name.trim()} onClick={() => void addBatch()} type="button"><Plus className="size-4" />Add batch</button></div></div>
      </div>
      {selected ? <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-lg font-black text-slate-950">{selected.name}</h4><p className="text-xs font-bold text-slate-500">{selectedRegistrations.length} batch participants · stable ID {selected.id}</p></div><select className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black" onChange={(e) => void patchBatch({ status: e.target.value as WorkshopBatch["status"] })} value={selected.status}><option value="draft">Draft</option><option value="open">Open</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SmallData label="Start" value={selected.startDate || "Not set"} /><SmallData label="End" value={selected.endDate || "Not set"} /><SmallData label="Venue" value={selected.venue || "Not set"} /><SmallData label="Capacity" value={selected.capacity || "Unlimited"} /></div>
        <div className="mt-5 flex items-center justify-between"><div><p className="font-black text-slate-900">Introduction sessions</p><p className="text-xs font-semibold text-slate-500">Each session gets its own registration source and participant trail.</p></div><a className="text-xs font-black text-violet-700" href={registrationUrl()}>Open batch registration</a></div>
        <div className="mt-3 space-y-2">{selected.introductionSessions.map((session) => <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center" key={session.id}><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-violet-700"><CalendarDays className="size-4" /></span><div className="min-w-0 flex-1"><p className="font-black text-slate-900">{session.title}</p><p className="text-xs font-semibold text-slate-500">{session.sessionDate} {session.startTime ? `· ${session.startTime}` : ""} · {session.venue || selected.venue || "Venue not set"}</p></div><a className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-700" href={registrationUrl(session)}>Registration link</a></div>)}{!selected.introductionSessions.length ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm font-bold text-slate-500">No introduction sessions in this batch yet.</p> : null}</div>
        <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-3"><p className="text-sm font-black text-slate-800">Add introduction session</p><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3"><input className={inputClass} onChange={(e) => setSessionDraft({ ...sessionDraft, title: e.target.value })} placeholder="Session title" value={sessionDraft.title} /><input className={inputClass} onChange={(e) => setSessionDraft({ ...sessionDraft, sessionDate: e.target.value })} type="date" value={sessionDraft.sessionDate} /><input className={inputClass} onChange={(e) => setSessionDraft({ ...sessionDraft, venue: e.target.value })} placeholder="Venue / Zoom" value={sessionDraft.venue} /><input className={inputClass} onChange={(e) => setSessionDraft({ ...sessionDraft, startTime: e.target.value })} type="time" value={sessionDraft.startTime} /><input className={inputClass} onChange={(e) => setSessionDraft({ ...sessionDraft, endTime: e.target.value })} type="time" value={sessionDraft.endTime} /><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!sessionDraft.title.trim() || !sessionDraft.sessionDate} onClick={() => void addIntroductionSession()} type="button"><Plus className="size-4" />Add intro session</button></div></div>
      </div> : null}
    </div>
  </section>;
}

function SmallData({ label, value }: { label: string; value: ReactNode }) { return <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-700">{value}</p></div>; }

function IconButton({ children, disabled, onClick, title, tone }: { children: ReactNode; disabled?: boolean; onClick: () => void; title: string; tone?: "danger" }) {
  return (
    <button
      className={`grid size-9 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${tone === "danger" ? "text-rose-600 hover:bg-rose-50" : "text-slate-500 hover:bg-slate-100"}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[78px] rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-center">
      <p className="text-xl font-black text-indigo-700">{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function formatSubmittedAt(value?: string) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function submittedAtTimestamp(value?: string) {
  const timestamp = Date.parse(value ?? "");
  return Number.isNaN(timestamp) ? Number.MIN_SAFE_INTEGER : timestamp;
}

function isTodayInIndia(value?: string) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric"
  });

  return dateFormatter.format(date) === dateFormatter.format(new Date());
}

function WhatsAppVerificationBadge({ status }: { status?: RegistrationEntry["whatsappVerificationStatus"] }) {
  if (status === "verified") {
    return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Verified</span>;
  }
  if (status === "not_verified") {
    return <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">Not Verified</span>;
  }
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">Not Required</span>;
}

function MfwSyncBadge({ entry }: { entry: RegistrationEntry }) {
  if (entry.mfwSyncStatus === "synced") {
    return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700" title={entry.mfwWorkshopEventId}>Enrolled</span>;
  }
  if (entry.mfwSyncStatus === "failed") {
    return <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700" title={entry.mfwSyncError}>Failed · confirm again to retry</span>;
  }
  if (entry.confirmationStatus === "confirmed") {
    return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">Not enabled</span>;
  }
  return <span className="text-xs font-bold text-slate-400">After confirmation</span>;
}

function RegistrationConfirmationBadge({ status = "pending" }: { status?: RegistrationEntry["confirmationStatus"] }) {
  const labels = {
    callback: "Call back",
    cancelled: "Cancelled",
    carried_forward: "Carried forward",
    confirmed: "Confirmed",
    no_answer: "No answer",
    not_confirmed: "Not confirmed",
    pending: "Pending",
    repeater: "Repeater"
  };
  const tone = status === "confirmed"
    ? "bg-emerald-50 text-emerald-700"
    : status === "not_confirmed" || status === "cancelled"
      ? "bg-rose-50 text-rose-700"
      : status === "repeater"
        ? "bg-indigo-50 text-indigo-700"
        : status === "carried_forward"
          ? "bg-sky-50 text-sky-700"
          : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>{labels[status]}</span>;
}

function RegistrationSourceBadge({ source }: { source?: RegistrationEntry["source"] }) {
  if (source === "landing_page") {
    return <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">Landing Page</span>;
  }
  if (source === "manual") {
    return <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">Manual</span>;
  }
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Registration Link</span>;
}

function SelectBox({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
      <span className="relative block">
        <select className={`${inputClass} appearance-none pr-10`} onChange={(event) => onChange(event.target.value)} value={value}>
          <option value="">Select {label}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}
