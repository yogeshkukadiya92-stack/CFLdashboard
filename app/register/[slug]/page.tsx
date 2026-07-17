"use client";

import { workshops as seedWorkshops } from "@/lib/data";
import { hydratePublicRegistrationState, readLocalArray, readLocalObject, savePublicRegistration } from "@/lib/live-state";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import type { BuilderField, BuilderForm, BuilderTheme, PaymentTier, RegistrationEntry } from "@/lib/types";
import { decodeJsonParam, formatCurrency } from "@/lib/utils";
import { AlertTriangle, Check, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const WORKSHOP_MASTER_STORAGE_KEY = "cfl_workshop_master_records_v1";
const FORMS_STORAGE_KEY = "cfl_forms_v1";
const REGISTRATION_LINK_CONFIG_STORAGE_KEY = "cfl_registration_link_configs_v1";
const CLIENTS_STORAGE_KEY = "cfl_clients_v1";

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
  id: string;
  slug: string;
  title: string;
  description: string;
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
  align: "left"
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

function modelFromBuilderForm(form: BuilderForm, overrides?: Partial<Pick<FormModel, "batch" | "facilitator" | "fee" | "paid" | "partPayment" | "venue">>): FormModel {
  return {
    id: form.workshopId || form.id,
    slug: form.workshopSlug || slugify(form.workshopName) || form.id,
    title: form.title || form.workshopName || "Workshop Registration",
    description: form.description || "",
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
  const [success, setSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

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
          id: widParam || slug,
          slug,
          title: titleParam,
          description: "",
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
                id: config.id || slug,
                slug: config.slug || slug,
                title: config.title,
                description: "",
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
                id: match.id,
                slug: slugify(match.name) || match.id,
                title: match.name,
                description: "",
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
            id: seed.id,
            slug: seed.slug,
            title: seed.title,
            description: "",
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
    setOtpVerifiedMobile((current) => (current === mobileDigits ? current : ""));
  }, [mobileDigits]);

  const tierList = model?.tiers ?? [];
  const hasTiers = tierList.length > 0;
  const activeTier = hasTiers ? tierList.find((t) => t.id === selectedTierId) ?? tierList[0] : null;
  const fullAmount = model?.paid ? (activeTier ? activeTier.fee : model.fee) : 0;
  const amountPaid = paymentMode === "Full" ? fullAmount : Math.max(0, Math.min(Number(partAmount || 0), fullAmount));
  const amountDue = Math.max(0, fullAmount - amountPaid);

  const missingRequired = useMemo(() => {
    if (!model) return true;
    return model.fields.some((field) => {
      if (field.type === "heading" || !field.required) return false;
      const value = (answers[field.id] ?? "").trim();
      if (!value) return true;
      if (field.role === "mobile") return cleanMobile(value).length < 10;
      return false;
    });
  }, [answers, model]);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleCheckbox(id: string, option: string) {
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
    if (!model?.otpRequired) return;
    if (mobileDigits.length !== 10 || otpCode.trim().length !== 6) {
      setOtpMessage("Enter the 6-digit OTP.");
      return;
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
        return;
      }
      setOtpVerifiedMobile(mobileDigits);
      setOtpMessage("Mobile number verified.");
    } catch {
      setOtpMessage("Could not verify OTP. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  }

  function submitRegistration() {
    if (!model) return;
    if (missingRequired) {
      setMessage("Please fill all required fields (and a valid 10-digit mobile).");
      return;
    }
    if (model.otpRequired && !otpVerified) {
      setMessage("Please verify mobile number with WhatsApp OTP before registration.");
      return;
    }

    const name = (roleField("name")?.id ? answers[roleField("name")!.id] : "")?.trim() || "Guest";
    const email = (roleField("email")?.id ? answers[roleField("email")!.id] : "")?.trim() || "";
    const city = (roleField("city")?.id ? answers[roleField("city")!.id] : "")?.trim() || "Unknown";
    const mobile = cleanMobile(mobileValue);

    const extra: Record<string, string> = {};
    if (activeTier) extra["Registration Type"] = activeTier.label;
    model.fields.forEach((field) => {
      if (field.type === "heading" || field.role) return;
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
    setRedirectCountdown(5);
    setMessage("Registration confirmed. See you at the workshop!");
    setAnswers({});
    setOtpCode("");
    setOtpMessage("");
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
  const metaLine = [model.batch && `Batch: ${model.batch}`, model.facilitator && `Facilitator: ${model.facilitator}`, model.venue && `Venue: ${model.venue}`].filter(Boolean);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 px-4 py-8 text-slate-950 md:py-12" style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSize }}>
      <section
        className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white"
        style={{ boxShadow: `0 2px 0 0 ${theme.accent}22, 0 8px 30px -6px rgba(0,0,0,0.12), 0 25px 60px -15px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)` }}
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
          {theme.logoUrl ? (
            <img
              alt=""
              className={`mb-4 size-20 rounded-2xl object-cover ${theme.align === "center" ? "mx-auto" : ""}`}
              src={theme.logoUrl}
              style={{ boxShadow: "0 4px 24px -6px rgba(0,0,0,0.15), 0 0 0 3px white, 0 0 0 4px rgba(0,0,0,0.06)" }}
            />
          ) : null}
          <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>CFL Workshop Registration</p>
          <h1
            className="mt-2 tracking-tight"
            style={{ fontWeight: theme.titleBold ? 800 : 600, fontStyle: theme.titleItalic ? "italic" : "normal", fontSize: theme.fontSize + 16, lineHeight: 1.2 }}
          >
            {model.title}
          </h1>
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
            <div className="rounded-2xl bg-emerald-50 px-4 py-5 text-sm font-bold text-emerald-700">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p>{message}</p>
                  {model.whatsappGroupUrl ? (
                    <p className="mt-2 text-emerald-800">WhatsApp group opens in {redirectCountdown} seconds.</p>
                  ) : null}
                </div>
              </div>
              {model.whatsappGroupUrl ? (
                <a
                  className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
                  href={model.whatsappGroupUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Join WhatsApp Group Now
                </a>
              ) : null}
            </div>
          ) : (
            <>
              {matchedClient ? (
                <div className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <span>Welcome back, {matchedClient.name || "valued client"}! We filled in your saved details — please review.</span>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                {model.fields.map((field) => (
                  <RenderField
                    accent={theme.accent}
                    field={field}
                    key={field.id}
                    onChange={(value) => setAnswer(field.id, value)}
                    onToggle={(option) => toggleCheckbox(field.id, option)}
                    value={answers[field.id] ?? ""}
                  />
                ))}
              </div>

              {model.otpRequired ? (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">WhatsApp OTP Verification</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">OTP will be sent on WhatsApp to the participant mobile number.</p>
                    </div>
                    {otpVerified ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                        <CheckCircle2 className="size-3.5" />
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      value={otpCode}
                    />
                    <button
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={otpSending || otpVerified}
                      onClick={sendOtp}
                      type="button"
                    >
                      {otpSending ? <Loader2 className="size-4 animate-spin" /> : null}
                      Send WhatsApp OTP
                    </button>
                    <button
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={otpVerifying || otpVerified}
                      onClick={verifyOtp}
                      type="button"
                    >
                      {otpVerifying ? <Loader2 className="size-4 animate-spin" /> : null}
                      Verify
                    </button>
                  </div>
                  {otpMessage ? <p className={`mt-3 text-sm font-bold ${otpVerified ? "text-emerald-700" : "text-slate-600"}`}>{otpMessage}</p> : null}
                </div>
              ) : null}

              {model.paid && hasTiers ? (
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

              {model.paid ? (
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

              <button
                className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base sm:text-sm font-black tracking-wide text-white uppercase transition-transform hover:scale-[1.01] active:scale-[0.99]"
                onClick={submitRegistration}
                style={{ backgroundColor: theme.accent, boxShadow: `0 6px 20px -4px ${theme.accent}55, 0 2px 4px -1px ${theme.accent}33` }}
                type="button"
              >
                <ShieldCheck className="size-4" />
                {model.paid ? "Register & Pay" : "Confirm Registration"}
              </button>
              <p className="mt-3 text-center text-xs font-semibold text-slate-400">Your details are saved securely for this workshop only.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function RenderField({
  accent,
  field,
  onChange,
  onToggle,
  value
}: {
  accent: string;
  field: BuilderField;
  onChange: (value: string) => void;
  onToggle: (option: string) => void;
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
  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-base sm:text-sm font-semibold outline-none transition-all focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100";
  const wide = field.type === "paragraph" || field.type === "radio" || field.type === "checkbox";

  let control: React.ReactNode;
  if (field.type === "paragraph") {
    control = <textarea className={inputClass} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={3} value={value} />;
  } else if (field.type === "dropdown") {
    control = (
      <select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Select…</option>
        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  } else if (field.type === "radio" || field.type === "checkbox") {
    const selected = value.split(" | ").filter(Boolean);
    control = (
      <div className="space-y-1.5">
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
