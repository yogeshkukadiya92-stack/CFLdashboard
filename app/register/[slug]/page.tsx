"use client";

import { workshops as seedWorkshops } from "@/lib/data";
import { hydratePublicRegistrationState, readLocalArray, readLocalObject, savePublicRegistration, writeLiveStateToLocalStorage } from "@/lib/live-state";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import type { BuilderField, BuilderForm, BuilderFormMode, BuilderTheme, FormAnalyticsRecord, PaymentTier, RegistrationEntry } from "@/lib/types";
import { decodeJsonParam, formatCurrency } from "@/lib/utils";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const WORKSHOP_MASTER_STORAGE_KEY = "cfl_workshop_master_records_v1";
const FORMS_STORAGE_KEY = "cfl_forms_v1";
const REGISTRATION_LINK_CONFIG_STORAGE_KEY = "cfl_registration_link_configs_v1";
const CLIENTS_STORAGE_KEY = "cfl_clients_v1";
const FORM_ANALYTICS_STORAGE_KEY = "cfl_form_analytics_v1";
const BRAND_LOGO_SRC = "/brand/coach-for-life-logo-horizontal.png";

type WorkshopMasterRecord = { archived?: boolean; id: string; name: string; facilitator?: string; isPaid?: boolean };
type ClientRecord = { city?: string; email?: string; id: number | string; mobile?: string; name?: string };
type RegistrationLinkConfig = {
  batch?: string;
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

type FormModel = {
  formId: string;
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  description: string;
  mode: BuilderFormMode;
  facilitator: string;
  venue: string;
  batch: string;
  paid: boolean;
  fee: number;
  partPayment: boolean;
  otpRequired?: boolean;
  tiers?: PaymentTier[];
  highlights?: string[];
  whatsappGroupUrl?: string;
  theme: BuilderTheme;
  fields: BuilderField[];
};

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

function simpleFields(): BuilderField[] {
  return [
    { id: "name", type: "short_text", label: "Full Name", placeholder: "Your full name", required: true, role: "name" },
    { id: "mobile", type: "mobile", label: "Mobile Number", placeholder: "10-digit mobile", required: true, role: "mobile" },
    { id: "email", type: "email", label: "Email", placeholder: "you@example.com", required: false, role: "email" },
    { id: "city", type: "short_text", label: "City", placeholder: "Your city", required: false, role: "city" }
  ];
}

function normalizeCoreFieldRequirements(fields: BuilderField[]) {
  return fields.map((field) => {
    if (field.role === "name" || field.role === "mobile") return { ...field, required: true };
    if (field.role === "email" || field.role === "city") return { ...field, required: false };
    return field;
  });
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function cleanMobile(value: string) {
  return value.replace(/\D/g, "");
}

function isFieldVisible(field: BuilderField, answers: Record<string, string>) {
  const rule = field.visibility;
  if (!rule?.fieldId) return true;
  const sourceValue = (answers[rule.fieldId] ?? "").trim();
  const expected = (rule.value ?? "").trim();
  if (rule.operator === "answered") return Boolean(sourceValue);
  if (rule.operator === "not_answered") return !sourceValue;
  if (rule.operator === "not_equals") return sourceValue !== expected;
  if (rule.operator === "contains") return sourceValue.toLowerCase().includes(expected.toLowerCase());
  return sourceValue === expected;
}

function buildPublicPages(fields: BuilderField[], mode: BuilderFormMode) {
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

function hasValidAnswer(field: BuilderField, answers: Record<string, string>) {
  if (field.type === "heading" || !field.required || !isFieldVisible(field, answers)) return true;
  const value = (answers[field.id] ?? "").trim();
  if (!value) return false;
  if (field.role === "mobile") {
    const digits = cleanMobile(value);
    return digits.length === 10 && /^[6-9]/.test(digits);
  }
  if (field.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return true;
}

function modelFromBuilderForm(form: BuilderForm, overrides?: Partial<Pick<FormModel, "batch" | "facilitator" | "fee" | "paid" | "partPayment" | "venue">>): FormModel {
  return {
    formId: form.id,
    id: form.workshopId || form.id,
    slug: form.workshopSlug || slugify(form.workshopName) || form.id,
    title: form.title || form.workshopName || "Workshop Registration",
    tagline: form.tagline || "",
    description: form.description || "",
    mode: form.mode ?? "classic",
    facilitator: overrides?.facilitator || "",
    venue: overrides?.venue || "",
    batch: overrides?.batch || form.batch || "Main Batch",
    paid: overrides?.paid ?? Boolean(form.paid),
    fee: overrides?.fee ?? form.fee ?? 0,
    partPayment: overrides?.partPayment ?? Boolean(form.partPayment),
    otpRequired: Boolean(form.otpRequired),
    tiers: form.tiers && form.tiers.length > 0 ? form.tiers : undefined,
    highlights: form.highlights && form.highlights.length > 0 ? form.highlights : undefined,
    whatsappGroupUrl: form.whatsappGroupUrl,
    theme: { ...defaultTheme, ...form.theme },
    fields: form.fields?.length ? normalizeCoreFieldRequirements(form.fields) : simpleFields()
  };
}

export default function RegistrationPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;

  const formParam = searchParams.get("f");
  const titleParam = searchParams.get("title");
  const widParam = searchParams.get("wid");
  const facilitatorParam = searchParams.get("facilitator");
  const venueParam = searchParams.get("venue");
  const batchParam = searchParams.get("batch");
  const paidEnabled = searchParams.get("paid") !== "0";
  const partEnabled = searchParams.get("part") === "1";
  const feeParam = Number(searchParams.get("fee") || 0);

  const [ready, setReady] = useState(false);
  const [model, setModel] = useState<FormModel | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [matchedClient, setMatchedClient] = useState<ClientRecord | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [paymentMode, setPaymentMode] = useState<"Full" | "Part">("Full");
  const [partAmount, setPartAmount] = useState("");
  const [selectedTierId, setSelectedTierId] = useState("");
  const [message, setMessage] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerifiedMobile, setOtpVerifiedMobile] = useState("");
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [currentPage, setCurrentPage] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const analyticsViewRef = useRef("");
  const analyticsStartedRef = useRef(false);
  const analyticsCompletedRef = useRef(false);
  const draftLoadedRef = useRef("");
  const lastFieldIdRef = useRef("");

  // Resolve the form: a builder form (?f=) wins; then a self-contained simple
  // link (?title=); then saved master records; then the static seed.
  useEffect(() => {
    let cancelled = false;

    async function resolveForm() {
      await hydratePublicRegistrationState();
      if (cancelled) return;

      let resolved: FormModel | null = null;
      let linkBlocked = false;

      if (formParam) {
        const decoded = decodeJsonParam<BuilderForm>(formParam);
        if (decoded && Array.isArray(decoded.fields)) {
          resolved = modelFromBuilderForm(decoded, {
            venue: venueParam || "",
            paid: Boolean(decoded.paid) && ((decoded.fee || 0) > 0 || Boolean(decoded.tiers && decoded.tiers.length > 0))
          });
        }
      }

      if (!resolved && titleParam) {
        resolved = {
          formId: `form-${widParam || slug}-main`,
          id: widParam || slug,
          slug,
          title: titleParam,
          description: "",
          mode: "classic",
          facilitator: facilitatorParam || "CFL Facilitator",
          venue: venueParam || "TBA",
          batch: batchParam || "Main Batch",
          paid: paidEnabled && feeParam > 0,
          fee: feeParam,
          partPayment: partEnabled,
          theme: defaultTheme,
          fields: simpleFields()
        };
      }

      if (!resolved) {
        try {
          const configs = readLocalObject<Record<string, RegistrationLinkConfig>>(REGISTRATION_LINK_CONFIG_STORAGE_KEY);
          const config = configs[slug];
          if (config?.title) {
            const expiresAt = config.publishUntil ? new Date(config.publishUntil).getTime() : 0;
            linkBlocked = config.published === false || (expiresAt > 0 && expiresAt <= Date.now());
          }
          if (config?.title && !linkBlocked) {
            const fee = Number(config.fee || 0);
            const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
            const savedForm = forms.find((item) => item.workshopId === config.id || item.workshopSlug === slug || item.workshopSlug === config.slug);
            if (savedForm) {
              resolved = modelFromBuilderForm(savedForm, {
                batch: config.batch || savedForm.batch || "Main Batch",
                facilitator: config.facilitator || "CFL Facilitator",
                fee,
                paid: Boolean(config.paid) && (fee > 0 || Boolean(savedForm.tiers?.length)),
                partPayment: Boolean(config.partPayment),
                venue: config.venue || "TBA"
              });
              resolved = { ...resolved, otpRequired: Boolean(savedForm.otpRequired || config.otpRequired) };
            } else {
              resolved = {
                formId: `form-${config.id || slug}-main`,
                id: config.id || slug,
                slug: config.slug || slug,
                title: config.title,
                description: "",
                mode: "classic",
                facilitator: config.facilitator || "CFL Facilitator",
                venue: config.venue || "TBA",
                batch: config.batch || "Main Batch",
                paid: Boolean(config.paid) && fee > 0,
                fee,
                partPayment: Boolean(config.partPayment),
                otpRequired: Boolean(config.otpRequired),
                theme: defaultTheme,
                fields: simpleFields()
              };
            }
          }
        } catch {
          resolved = null;
        }
      }

      if (!resolved && !linkBlocked) {
        try {
          const records = readLocalArray<WorkshopMasterRecord>(WORKSHOP_MASTER_STORAGE_KEY);
          const match = records.find((record) => !record.archived && (slugify(record.name) === slug || record.id === slug || record.id === widParam));
          if (match) {
            const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
            const savedForm = forms.find((item) => item.workshopId === match.id || item.workshopSlug === slugify(match.name));
            if (savedForm) {
              resolved = modelFromBuilderForm(savedForm, {
                batch: batchParam || savedForm.batch || "Main Batch",
                facilitator: match.facilitator || "CFL Facilitator",
                fee: feeParam,
                paid: paidEnabled && (feeParam > 0 || Boolean(savedForm.tiers?.length)),
                partPayment: partEnabled,
                venue: venueParam || "TBA"
              });
            } else {
              resolved = {
                formId: `form-${match.id}-main`,
                id: match.id,
                slug: slugify(match.name) || match.id,
                title: match.name,
                description: "",
                mode: "classic",
                facilitator: match.facilitator || "CFL Facilitator",
                venue: venueParam || "TBA",
                batch: batchParam || "Main Batch",
                paid: paidEnabled && feeParam > 0,
                fee: feeParam,
                partPayment: partEnabled,
                theme: defaultTheme,
                fields: simpleFields()
              };
            }
          }
        } catch {
          resolved = null;
        }
      }

      if (!resolved && !linkBlocked) {
        const seed = seedWorkshops.find((item) => item.slug === slug);
        if (seed) {
          resolved = {
            formId: `form-${seed.id}-main`,
            id: seed.id,
            slug: seed.slug,
            title: seed.title,
            description: "",
            mode: "classic",
            facilitator: seed.trainer,
            venue: seed.city,
            batch: batchParam || "Main Batch",
            paid: seed.price > 0,
            fee: feeParam > 0 ? feeParam : seed.price,
            partPayment: partEnabled,
            theme: defaultTheme,
            fields: simpleFields()
          };
        }
      }

      setModel(linkBlocked ? null : resolved);
      setReady(true);
    }

    void resolveForm();
    return () => {
      cancelled = true;
    };
  }, [batchParam, facilitatorParam, feeParam, formParam, paidEnabled, partEnabled, slug, titleParam, venueParam, widParam]);

  useEffect(() => {
    setClients(readLocalArray<ClientRecord>(CLIENTS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (!success || !model?.whatsappGroupUrl) {
      return;
    }

    setRedirectCountdown(5);
    const countdownTimer = window.setInterval(() => {
      setRedirectCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    const redirectTimer = window.setTimeout(() => {
      window.location.href = model.whatsappGroupUrl as string;
    }, 5000);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [model?.whatsappGroupUrl, success]);

  const roleField = (role: NonNullable<BuilderField["role"]>) => model?.fields.find((field) => field.role === role) ?? null;
  const mobileFieldId = roleField("mobile")?.id;
  const mobileValue = mobileFieldId ? answers[mobileFieldId] ?? "" : "";
  const mobileDigits = cleanMobile(mobileValue);
  const otpVerified = Boolean(model?.otpRequired) && mobileDigits.length === 10 && otpVerifiedMobile === mobileDigits;

  // Auto-fill from a saved client when the mobile matches.
  useEffect(() => {
    const digits = cleanMobile(mobileValue);
    if (!model || digits.length < 10 || clients.length === 0) {
      setMatchedClient(null);
      return;
    }
    const found = clients.find((client) => {
      const stored = cleanMobile(client.mobile ?? "");
      return stored.length >= 10 && (stored.endsWith(digits) || digits.endsWith(stored));
    });
    if (!found) {
      setMatchedClient(null);
      return;
    }
    setMatchedClient(found);
    setAnswers((prev) => {
      const next = { ...prev };
      const nameId = roleField("name")?.id;
      const emailId = roleField("email")?.id;
      const cityId = roleField("city")?.id;
      if (nameId && !next[nameId]?.trim() && found.name) next[nameId] = found.name;
      if (emailId && !next[emailId]?.trim() && found.email) next[emailId] = found.email;
      if (cityId && !next[cityId]?.trim() && found.city) next[cityId] = found.city;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, mobileValue, model]);

  useEffect(() => {
    setOtpCode("");
    setOtpMessage("");
    setOtpModalOpen(false);
    setOtpVerifiedMobile((current) => (current === mobileDigits ? current : ""));
  }, [mobileDigits]);

  const tierList = model?.tiers ?? [];
  const hasTiers = tierList.length > 0;
  const activeTier = hasTiers ? tierList.find((t) => t.id === selectedTierId) ?? tierList[0] : null;
  const fullAmount = model?.paid ? (activeTier ? activeTier.fee : model.fee) : 0;
  const amountPaid = paymentMode === "Full" ? fullAmount : Math.max(0, Math.min(Number(partAmount || 0), fullAmount));
  const amountDue = Math.max(0, fullAmount - amountPaid);

  const visibleFields = useMemo(() => model?.fields.filter((field) => isFieldVisible(field, answers)) ?? [], [answers, model]);
  const pages = useMemo(() => buildPublicPages(visibleFields, model?.mode ?? "classic"), [model?.mode, visibleFields]);
  const activePageIndex = Math.min(currentPage, Math.max(0, pages.length - 1));
  const activePage = pages[activePageIndex] ?? { fields: visibleFields, title: "" };
  const isLastPage = activePageIndex >= pages.length - 1;
  const currentPageInvalid = activePage.fields.some((field) => !hasValidAnswer(field, answers));

  function trackAnalytics(event: "view" | "start" | "complete" | "drop_off", fieldId = "") {
    if (!model) return;
    const current = readLocalArray<FormAnalyticsRecord>(FORM_ANALYTICS_STORAGE_KEY);
    const existing = current.find((item) => item.formId === model.formId);
    const record: FormAnalyticsRecord = existing
      ? { ...existing, dropOffByField: { ...(existing.dropOffByField ?? {}) } }
      : { completions: 0, dropOffByField: {}, formId: model.formId, starts: 0, updatedAt: new Date().toISOString(), views: 0, workshopId: model.id, workshopSlug: model.slug };
    if (event === "view") record.views += 1;
    if (event === "start") record.starts += 1;
    if (event === "complete") record.completions += 1;
    if (event === "drop_off" && fieldId) record.dropOffByField[fieldId] = (record.dropOffByField[fieldId] ?? 0) + 1;
    record.updatedAt = new Date().toISOString();
    writeLiveStateToLocalStorage({ formAnalytics: [record, ...current.filter((item) => item.formId !== model.formId)] });
    void fetch("/api/form-analytics", {
      body: JSON.stringify({ event, fieldId, formId: model.formId, workshopId: model.id, workshopSlug: model.slug }),
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST"
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (!model || analyticsViewRef.current === model.formId) return;
    analyticsViewRef.current = model.formId;
    analyticsStartedRef.current = false;
    analyticsCompletedRef.current = false;
    trackAnalytics("view");
    // One view per resolved public form load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.formId]);

  useEffect(() => {
    if (!model || draftLoadedRef.current === model.formId) return;
    draftLoadedRef.current = model.formId;
    try {
      const raw = window.localStorage.getItem(`cfl_registration_draft_${model.formId}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as { answers?: Record<string, string>; currentPage?: number; partAmount?: string; paymentMode?: "Full" | "Part"; selectedTierId?: string };
      if (draft.answers && Object.keys(draft.answers).length) {
        setAnswers(draft.answers);
        setCurrentPage(Math.max(0, Number(draft.currentPage || 0)));
        setPartAmount(draft.partAmount ?? "");
        setPaymentMode(draft.paymentMode === "Part" ? "Part" : "Full");
        setSelectedTierId(draft.selectedTierId ?? "");
        setDraftRestored(true);
        analyticsStartedRef.current = true;
      }
    } catch {
      window.localStorage.removeItem(`cfl_registration_draft_${model.formId}`);
    }
  }, [model]);

  useEffect(() => {
    if (!model || success || !Object.keys(answers).length) return;
    window.localStorage.setItem(
      `cfl_registration_draft_${model.formId}`,
      JSON.stringify({ answers, currentPage: activePageIndex, partAmount, paymentMode, selectedTierId })
    );
  }, [activePageIndex, answers, model, partAmount, paymentMode, selectedTierId, success]);

  useEffect(() => {
    if (!model) return;
    const onPageHide = () => {
      if (!analyticsStartedRef.current || analyticsCompletedRef.current || !lastFieldIdRef.current) return;
      const body = JSON.stringify({ event: "drop_off", fieldId: lastFieldIdRef.current, formId: model.formId, workshopId: model.id, workshopSlug: model.slug });
      navigator.sendBeacon?.("/api/form-analytics", new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [model]);

  const missingRequired = useMemo(() => {
    if (!model) return true;
    return model.fields.some((field) => !hasValidAnswer(field, answers));
  }, [answers, model]);

  function setAnswer(id: string, value: string) {
    lastFieldIdRef.current = id;
    if (!analyticsStartedRef.current) {
      analyticsStartedRef.current = true;
      trackAnalytics("start");
    }
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleCheckbox(id: string, option: string) {
    lastFieldIdRef.current = id;
    if (!analyticsStartedRef.current) {
      analyticsStartedRef.current = true;
      trackAnalytics("start");
    }
    setAnswers((prev) => {
      const selected = (prev[id] ?? "").split(" | ").filter(Boolean);
      const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
      return { ...prev, [id]: next.join(" | ") };
    });
  }

  async function sendOtp() {
    if (!model?.otpRequired) return;
    if (mobileDigits.length !== 10 || !/^[6-9]/.test(mobileDigits)) {
      setOtpMessage("Enter a valid 10-digit mobile number first.");
      return;
    }
    setOtpSending(true);
    setOtpMessage("");
    try {
      const response = await fetch("/api/otp/send", {
        body: JSON.stringify({ mobile: mobileDigits }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setOtpMessage(data?.error || "Could not send OTP. Please try again.");
        return;
      }
      setOtpMessage(data.setupOtp ? `Setup mode WhatsApp OTP: ${data.setupOtp}` : "OTP sent on WhatsApp to participant mobile.");
    } catch {
      setOtpMessage("Could not send OTP. Please try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyOtp() {
    if (!model?.otpRequired) return false;
    if (mobileDigits.length !== 10 || otpCode.trim().length !== 6) {
      setOtpMessage("Enter the 6-digit OTP.");
      return false;
    }
    setOtpVerifying(true);
    setOtpMessage("");
    try {
      const response = await fetch("/api/otp/verify", {
        body: JSON.stringify({ mobile: mobileDigits, otp: otpCode }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setOtpMessage(data?.error || "Incorrect OTP.");
        return false;
      }
      setOtpVerifiedMobile(mobileDigits);
      setOtpMessage("Mobile number verified.");
      return true;
    } catch {
      setOtpMessage("Could not verify OTP. Please try again.");
      return false;
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handlePrimarySubmit() {
    if (!model) return;
    if (missingRequired) {
      setMessage("Please fill all required fields (and a valid 10-digit mobile).");
      return;
    }
    if (model.otpRequired && !otpVerified) {
      setMessage("");
      setOtpCode("");
      setOtpMessage("");
      setOtpModalOpen(true);
      await sendOtp();
      return;
    }
    submitRegistration(model.otpRequired ? "verified" : "not_required");
  }

  function persistDraftAtPage(pageIndex: number) {
    if (!model || success || !Object.keys(answers).length) return;
    window.localStorage.setItem(
      `cfl_registration_draft_${model.formId}`,
      JSON.stringify({ answers, currentPage: pageIndex, partAmount, paymentMode, selectedTierId })
    );
  }

  function goToNextPage() {
    if (currentPageInvalid) {
      setMessage("Please complete the required field before continuing.");
      return;
    }
    setMessage("");
    const nextPage = Math.min(pages.length - 1, activePageIndex + 1);
    setCurrentPage(nextPage);
    persistDraftAtPage(nextPage);
    window.requestAnimationFrame(() => window.scrollTo({ behavior: "smooth", top: 0 }));
  }

  function goToPreviousPage() {
    const previousPage = Math.max(0, activePageIndex - 1);
    setCurrentPage(previousPage);
    persistDraftAtPage(previousPage);
  }

  async function confirmOtpAndSubmit() {
    const verified = await verifyOtp();
    if (!verified) return;
    setOtpModalOpen(false);
    submitRegistration("verified");
  }

  function submitRegistration(whatsappVerificationStatus: RegistrationEntry["whatsappVerificationStatus"] = "not_required") {
    if (!model) return;
    if (missingRequired) {
      setMessage("Please fill all required fields (and a valid 10-digit mobile).");
      return;
    }

    const name = (roleField("name")?.id ? answers[roleField("name")!.id] : "")?.trim() || "Guest";
    const email = (roleField("email")?.id ? answers[roleField("email")!.id] : "")?.trim() || "";
    const city = (roleField("city")?.id ? answers[roleField("city")!.id] : "")?.trim() || "Unknown";
    const mobile = cleanMobile(mobileValue);

    const extra: Record<string, string> = {};
    if (activeTier) extra["Registration Type"] = activeTier.label;
    model.fields.forEach((field) => {
      if (field.type === "heading" || field.role || !isFieldVisible(field, answers)) return;
      const value = (answers[field.id] ?? "").trim();
      if (value) extra[field.label] = value;
    });

    const registrationId = `reg-${model.id}-${mobile || Date.now().toString(36)}`;
    const payload: RegistrationEntry = {
      id: registrationId,
      workshopId: model.id,
      workshopSlug: model.slug,
      workshopTitle: model.title,
      fullName: name,
      mobile: mobile ? `+91 ${mobile}` : "",
      email,
      city,
      facilitator: model.facilitator,
      paymentMode,
      amountPaid,
      amountDue,
      status: amountDue > 0 ? "Due" : "Paid",
      whatsappVerificationStatus,
      createdAt: new Date().toISOString().slice(0, 10),
      batch: model.batch,
      answers: Object.keys(extra).length ? extra : undefined
    };

    try {
      const current = readLocalArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY);
      const existingIndex = current.findIndex((item) => item.id === registrationId);
      if (existingIndex >= 0) current[existingIndex] = payload;
      else current.unshift(payload);
      void savePublicRegistration(payload, current);
    } catch {
      // ignore storage write failures
    }

    setSuccess(true);
    analyticsCompletedRef.current = true;
    trackAnalytics("complete");
    window.localStorage.removeItem(`cfl_registration_draft_${model.formId}`);
    setRedirectCountdown(5);
    setMessage("Registration confirmed. See you at the workshop!");
    setAnswers({});
    setOtpCode("");
    setOtpMessage("");
    setOtpModalOpen(false);
    setOtpVerifiedMobile("");
    setPartAmount("");
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-slate-950">
        <p className="text-sm font-bold text-slate-500">Loading registration…</p>
      </main>
    );
  }

  if (!model) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-black tracking-tight">Registration link is not active</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            This workshop link has expired or was never published. Please contact the CFL team for the latest registration link.
          </p>
        </div>
      </main>
    );
  }

  const theme = model.theme;
  const displayLogoUrl = theme.logoUrl || BRAND_LOGO_SRC;
  const metaLine = [model.batch && `Batch: ${model.batch}`, model.facilitator && `Facilitator: ${model.facilitator}`, model.venue && `Venue: ${model.venue}`].filter(Boolean);
  const fieldRadiusClass = theme.fieldRadius === "square" ? "rounded-md" : theme.fieldRadius === "soft" ? "rounded-lg" : "rounded-xl";
  const logoAlign = theme.logoAlign || defaultTheme.logoAlign || "center";
  const logoSize = Math.min(Math.max(theme.logoSize || defaultTheme.logoSize || 140, 72), 240);
  const logoPositionClass = logoAlign === "center" ? "mx-auto" : logoAlign === "right" ? "ml-auto" : "";

  return (
    <main className="min-h-screen px-4 py-8 text-slate-950 md:py-12" style={{ backgroundColor: theme.backgroundColor || defaultTheme.backgroundColor, fontFamily: theme.fontFamily, fontSize: theme.fontSize }}>
      <section
        className="mx-auto max-w-3xl overflow-hidden rounded-3xl"
        style={{ backgroundColor: theme.surfaceColor || "#ffffff", boxShadow: `0 2px 0 0 ${theme.accent}22, 0 8px 30px -6px rgba(0,0,0,0.12), 0 25px 60px -15px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)` }}
      >
        {theme.bannerUrl ? (
          <div className="relative">
            <img alt="" className="h-44 w-full object-cover sm:h-52" src={theme.bannerUrl} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, ${theme.accent}18 100%)` }} />
          </div>
        ) : (
          <div className="h-2.5 rounded-t-3xl" style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}88)` }} />
        )}
        <div className="relative p-6 md:p-8" style={{ textAlign: theme.align }}>
          {displayLogoUrl ? (
            <img
              alt="Coach For Life"
              className={`mb-5 h-auto max-w-full object-contain ${logoPositionClass}`}
              src={displayLogoUrl}
              style={{ width: logoSize }}
            />
          ) : null}
          <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>CFL Workshop Registration</p>
          <h1
            className="mt-2 tracking-tight"
            style={{ fontWeight: theme.titleBold ? 800 : 600, fontStyle: theme.titleItalic ? "italic" : "normal", fontSize: theme.fontSize + 16, lineHeight: 1.2 }}
          >
            {model.title}
          </h1>
          {model.tagline ? <p className="mt-2 text-base font-bold text-slate-600">{model.tagline}</p> : null}
          {model.description ? (
            <div
              className="rich-text-content mt-3 leading-relaxed text-slate-500"
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(model.description) }}
            />
          ) : null}
          {metaLine.length ? <p className="mt-3 text-sm font-semibold text-slate-400">{metaLine.join("  •  ")}</p> : null}
          <p
            className="mt-5 inline-flex rounded-xl px-4 py-2.5 text-sm font-black text-white"
            style={{ backgroundColor: theme.accent, boxShadow: `0 4px 14px -3px ${theme.accent}55` }}
          >
            {model.paid ? (hasTiers ? `Starting ${formatCurrency(Math.min(...tierList.map((t) => t.fee)))}` : `Fee: ${formatCurrency(fullAmount)}`) : "Free Registration"}
          </p>
        </div>

        {model.highlights && model.highlights.length > 0 ? (
          <div
            className="mx-6 rounded-2xl p-5 md:mx-8"
            style={{ background: `linear-gradient(135deg, ${theme.accent}06, ${theme.accent}12)`, border: `1px solid ${theme.accent}18` }}
          >
            <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
              <span className="grid size-6 place-items-center rounded-lg text-white" style={{ backgroundColor: theme.accent, boxShadow: `0 2px 8px -2px ${theme.accent}88` }}>✦</span>
              What you&apos;ll get
            </p>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {model.highlights.map((item, i) => (
                <li className="flex items-start gap-2.5 text-sm font-semibold text-slate-700" key={i}>
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: theme.accent }}>
                    <Check className="size-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="p-6 md:p-8">
          {success ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-5 text-center text-sm font-bold text-emerald-700">
              Registration completed successfully.
            </div>
          ) : (
            <>
              {model.mode !== "classic" && pages.length > 1 ? (
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-500">
                    <span>{model.mode === "guided" ? "Question" : "Step"} {activePageIndex + 1} of {pages.length}</span>
                    <span>{Math.round(((activePageIndex + 1) / pages.length) * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-300" style={{ backgroundColor: theme.accent, width: `${((activePageIndex + 1) / pages.length) * 100}%` }} /></div>
                </div>
              ) : null}

              {draftRestored ? (
                <div className="mb-5 flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <span>Your saved progress has been restored.</span>
                </div>
              ) : null}

              {matchedClient ? (
                <div className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <span>Welcome back, {matchedClient.name || "valued client"}! We filled in your saved details — please review.</span>
                </div>
              ) : null}

              {activePage.title ? <h2 className="mb-4 text-xl font-black text-slate-950">{activePage.title}</h2> : null}
              <div className={`grid gap-4 ${model.mode === "guided" ? "grid-cols-1" : "md:grid-cols-2"}`}>
                {activePage.fields.map((field) => (
                  <RenderField
                    accent={theme.accent}
                    field={field}
                    key={field.id}
                    onChange={(value) => setAnswer(field.id, value)}
                    onToggle={(option) => toggleCheckbox(field.id, option)}
                    radiusClass={fieldRadiusClass}
                    value={answers[field.id] ?? ""}
                  />
                ))}
              </div>

              {isLastPage && model.paid && hasTiers ? (
                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                  <p className="text-sm font-black text-slate-700">Choose your plan</p>
                  <div className="mt-3 space-y-2.5">
                    {tierList.map((tier) => {
                      const isActive = activeTier?.id === tier.id;
                      return (
                        <label
                          className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-sm font-bold transition-all"
                          key={tier.id}
                          style={isActive ? { borderColor: theme.accent, backgroundColor: `${theme.accent}06`, boxShadow: `0 0 0 1px ${theme.accent}33, 0 4px 12px -4px ${theme.accent}22` } : { borderColor: "#e2e8f0" }}
                        >
                          <input
                            checked={isActive}
                            className="size-5"
                            name="payment-tier"
                            onChange={() => setSelectedTierId(tier.id)}
                            style={{ accentColor: theme.accent }}
                            type="radio"
                          />
                          <span className="flex-1">{tier.label}</span>
                          <span className="rounded-lg px-2.5 py-1 text-xs font-black text-white" style={{ backgroundColor: theme.accent }}>{formatCurrency(tier.fee)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {isLastPage && model.paid ? (
                <div className="mt-5 rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-black text-slate-700">Payment Option</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                    <label className="inline-flex min-h-[44px] items-center gap-3">
                      <input checked={paymentMode === "Full"} onChange={() => setPaymentMode("Full")} type="radio" style={{ accentColor: theme.accent }} className="size-5" />
                      Full Payment
                    </label>
                    {model.partPayment ? (
                      <label className="inline-flex min-h-[44px] items-center gap-3">
                        <input checked={paymentMode === "Part"} onChange={() => setPaymentMode("Part")} type="radio" style={{ accentColor: theme.accent }} className="size-5" />
                        Part Payment
                      </label>
                    ) : null}
                  </div>
                  {paymentMode === "Part" ? (
                    <input
                      className="mt-3 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      inputMode="numeric"
                      onChange={(event) => setPartAmount(event.target.value)}
                      placeholder="Enter part amount"
                      value={partAmount}
                    />
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
                    <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-emerald-700">Paying now: {formatCurrency(amountPaid)}</div>
                    <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-amber-700">Balance due: {formatCurrency(amountDue)}</div>
                  </div>
                </div>
              ) : null}

              {message ? <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{message}</p> : null}

              <div className="mt-6 flex gap-3">
                {model.mode !== "classic" && activePageIndex > 0 ? (
                  <button className={`inline-flex min-h-[52px] items-center justify-center gap-2 border border-slate-200 px-4 text-sm font-black text-slate-600 hover:bg-slate-50 ${fieldRadiusClass}`} onClick={goToPreviousPage} type="button"><ArrowLeft className="size-4" />Back</button>
                ) : null}
                <button
                  className={`inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 px-5 py-3.5 text-base font-black uppercase tracking-wide text-white transition-transform hover:scale-[1.01] active:scale-[0.99] sm:text-sm ${fieldRadiusClass}`}
                  onClick={isLastPage ? handlePrimarySubmit : goToNextPage}
                  style={{ backgroundColor: theme.accent, boxShadow: `0 6px 20px -4px ${theme.accent}55, 0 2px 4px -1px ${theme.accent}33` }}
                  type="button"
                >
                  {isLastPage ? <ShieldCheck className="size-4" /> : null}
                  {isLastPage ? (model.paid ? "Register & Pay" : "Confirm Registration") : <>Continue<ArrowRight className="size-4" /></>}
                </button>
              </div>
              <p className="mt-3 text-center text-xs font-semibold text-slate-400">Your progress saves automatically on this device.</p>
            </>
          )}
        </div>
      </section>

      {otpModalOpen && model?.otpRequired ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-black text-slate-950">WhatsApp OTP Verification</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  OTP sent on WhatsApp to +91 {mobileDigits}. Enter OTP to complete registration.
                </p>
              </div>
            </div>

            <input
              autoFocus
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-lg font-black tracking-[0.2em] text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              disabled={otpSending || otpVerifying}
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              value={otpCode}
            />
            {otpMessage ? <p className="mt-3 text-sm font-bold text-slate-600">{otpMessage}</p> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
                disabled={otpVerifying}
                onClick={() => setOtpModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={otpSending || otpVerifying || otpCode.length !== 6}
                onClick={confirmOtpAndSubmit}
                type="button"
              >
                {otpSending || otpVerifying ? <Loader2 className="size-4 animate-spin" /> : null}
                {otpSending ? "Sending OTP..." : "Complete Registration"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {success ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-9" />
            </span>
            <h2 className="mt-5 text-2xl font-black text-slate-950">Registration Confirmed</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              {message || "Your registration has been saved successfully."}
            </p>
            {model.whatsappGroupUrl ? (
              <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                WhatsApp group opens in {redirectCountdown} seconds.
              </p>
            ) : null}
            {model.whatsappGroupUrl ? (
              <a
                className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
                href={model.whatsappGroupUrl}
                rel="noreferrer"
                target="_blank"
              >
                Join WhatsApp Group Now
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function RenderField({
  accent,
  field,
  onChange,
  onToggle,
  radiusClass,
  value
}: {
  accent: string;
  field: BuilderField;
  onChange: (value: string) => void;
  onToggle: (option: string) => void;
  radiusClass: string;
  value: string;
}) {
  if (field.type === "heading") {
    return <h3 className="md:col-span-2 border-b border-slate-100 pb-1 text-base font-black text-slate-900">{field.label}</h3>;
  }

  const labelNode = (
    <span className="mb-2 block text-sm font-black text-slate-700">
      {field.label}
      {field.required ? <span style={{ color: accent }}> *</span> : null}
    </span>
  );
  const inputClass = `w-full border border-slate-200 bg-slate-50/50 px-4 py-3 text-base sm:text-sm font-semibold outline-none transition-all focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100 ${radiusClass}`;
  const wide = field.type === "paragraph" || field.type === "radio" || field.type === "checkbox";

  let control: React.ReactNode;
  if (field.type === "paragraph") {
    control = <textarea className={inputClass} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={3} value={value} />;
  } else if (field.type === "dropdown") {
    const isOther = value.startsWith("Other: ");
    control = (
      <div className="space-y-2">
        <select className={inputClass} onChange={(event) => onChange(event.target.value === "__other" ? "Other: " : event.target.value)} value={isOther ? "__other" : value}>
          <option value="">Select…</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
          {field.allowOther ? <option value="__other">Other</option> : null}
        </select>
        {field.allowOther && isOther ? (
          <input
            className={inputClass}
            onChange={(event) => onChange(`Other: ${event.target.value}`)}
            placeholder="Please specify"
            value={value.replace(/^Other: /, "")}
          />
        ) : null}
      </div>
    );
  } else if (field.type === "radio" || field.type === "checkbox") {
    const selected = value.split(" | ").filter(Boolean);
    const otherValue = selected.find((item) => item.startsWith("Other: ")) ?? "";
    control = (
      <div className="space-y-2">
        {(field.options ?? []).map((option) => (
          <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-slate-700" key={option}>
            <input
              checked={field.type === "radio" ? value === option : selected.includes(option)}
              className="size-5"
              name={field.id}
              onChange={() => (field.type === "radio" ? onChange(option) : onToggle(option))}
              style={{ accentColor: accent }}
              type={field.type === "radio" ? "radio" : "checkbox"}
            />
            {option}
          </label>
        ))}
        {field.allowOther ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <label className="flex min-h-[40px] items-center gap-3 text-sm font-semibold text-slate-700">
              <input
                checked={field.type === "radio" ? value.startsWith("Other: ") : Boolean(otherValue)}
                className="size-5"
                name={field.id}
                onChange={() => (field.type === "radio" ? onChange("Other: ") : onToggle(otherValue || "Other: "))}
                style={{ accentColor: accent }}
                type={field.type === "radio" ? "radio" : "checkbox"}
              />
              Other
            </label>
            {(field.type === "radio" ? value.startsWith("Other: ") : Boolean(otherValue)) ? (
              <input
                className={`${inputClass} mt-2 bg-white`}
                onChange={(event) => {
                  const nextOther = `Other: ${event.target.value}`;
                  if (field.type === "radio") {
                    onChange(nextOther);
                    return;
                  }
                  const withoutOther = selected.filter((item) => !item.startsWith("Other: "));
                  onChange([...withoutOther, nextOther].filter(Boolean).join(" | "));
                }}
                placeholder="Please specify"
                value={(field.type === "radio" ? value : otherValue).replace(/^Other: /, "")}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  } else {
    const inputType = field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
    control = (
      <input
        className={inputClass}
        inputMode={field.type === "mobile" ? "tel" : field.type === "number" ? "numeric" : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        type={inputType}
        value={value}
      />
    );
  }

  return <label className={`block ${wide ? "md:col-span-2" : ""}`}>{labelNode}{control}</label>;
}
