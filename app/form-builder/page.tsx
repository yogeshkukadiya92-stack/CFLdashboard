"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { hydrateLiveState, readLocalArray, saveLiveState } from "@/lib/live-state";
import { buildRegistrationUrl, normalizeBaseUrl } from "@/lib/registration-url";
import { publicFormSlug } from "@/lib/public-slug";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import type { BuilderField, BuilderFieldType, BuilderForm, PaymentTier } from "@/lib/types";
import { generateId } from "@/lib/utils";
import {
  AlignCenter,
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  CheckSquare,
  ChevronDown,
  Circle,
  Copy,
  ExternalLink,
  Heading,
  Italic,
  Mail,
  Plus,
  Smartphone,
  Trash2,
  Type,
  Image,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const WORKSHOP_MASTER_STORAGE_KEY = "cfl_workshop_master_records_v1";
const FORMS_STORAGE_KEY = "cfl_forms_v1";
const BRAND_LOGO_SRC = "/brand/coach-for-life-logo-horizontal.png";
const MAX_IMAGE_WIDTH = 800;
const IMAGE_QUALITY = 0.7;

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
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

type WorkshopMasterRecord = {
  id: string;
  name: string;
  facilitator?: string;
  isPaid?: boolean;
};

const fontOptions = [
  { label: "Inter (default)", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "System Sans", value: "ui-sans-serif, system-ui, -apple-system, sans-serif" },
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Courier (mono)", value: "'Courier New', monospace" }
];

const accentOptions = ["#059669", "#4f46e5", "#e11d48", "#ea580c", "#0ea5e9", "#7c3aed", "#0f172a"];

const fieldTypeMeta: Record<BuilderFieldType, { label: string; hasOptions: boolean }> = {
  short_text: { label: "Short Text", hasOptions: false },
  paragraph: { label: "Paragraph", hasOptions: false },
  email: { label: "Email", hasOptions: false },
  mobile: { label: "Mobile", hasOptions: false },
  number: { label: "Number", hasOptions: false },
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

const addableTypes: BuilderFieldType[] = [
  "short_text",
  "paragraph",
  "email",
  "mobile",
  "number",
  "date",
  "dropdown",
  "radio",
  "checkbox",
  "heading"
];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function defaultFields(): BuilderField[] {
  return [
    { id: generateId(), type: "short_text", label: "Full Name", placeholder: "Your full name", required: true, role: "name" },
    { id: generateId(), type: "mobile", label: "Mobile Number", placeholder: "10-digit mobile", required: true, role: "mobile" },
    { id: generateId(), type: "email", label: "Email", placeholder: "you@example.com", required: false, role: "email" },
    { id: generateId(), type: "short_text", label: "City", placeholder: "Your city", required: false, role: "city" }
  ];
}

export default function FormBuilderPage() {
  const [workshops, setWorkshops] = useState<WorkshopMasterRecord[]>([]);
  const [workshopId, setWorkshopId] = useState("");
  const [workshopSearch, setWorkshopSearch] = useState("");
  const [workshopPickerOpen, setWorkshopPickerOpen] = useState(false);
  const [batch, setBatch] = useState("Main Batch");
  const [title, setTitle] = useState("Workshop Registration");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("Please fill in your details to confirm your seat.");
  const [paid, setPaid] = useState(false);
  const [fee, setFee] = useState("");
  const [partPayment, setPartPayment] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [tiers, setTiers] = useState<PaymentTier[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("");
  const [fields, setFields] = useState<BuilderField[]>(defaultFields);
  const [fontFamily, setFontFamily] = useState(fontOptions[0].value);
  const [fontSize, setFontSize] = useState(16);
  const [accent, setAccent] = useState(accentOptions[0]);
  const [titleBold, setTitleBold] = useState(true);
  const [titleItalic, setTitleItalic] = useState(false);
  const [align, setAlign] = useState<"left" | "center">("left");
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [registrationDomains, setRegistrationDomains] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    function loadLocal() {
      setWorkshops(readLocalArray<WorkshopMasterRecord>(WORKSHOP_MASTER_STORAGE_KEY));
    }

    loadLocal();
    hydrateLiveState().then(loadLocal);
  }, []);

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

  const workshop = workshops.find((item) => item.id === workshopId) ?? null;
  const selectedWorkshopName = workshop?.name ?? "";
  const filteredWorkshops = useMemo(() => {
    const query = workshopSearch.trim().toLowerCase();
    if (!query) return workshops;
    return workshops.filter((item) => item.name.toLowerCase().includes(query));
  }, [workshopSearch, workshops]);

  const form = useMemo<BuilderForm>(() => {
    const name = workshop?.name ?? "";
    return {
      id: workshopId ? `form-${workshopId}-${slugify(batch) || "main"}` : "form-draft",
      workshopId,
      workshopName: name,
      workshopSlug: workshopId ? publicFormSlug("r", workshopId) : "workshop",
      batch,
      title,
      tagline: tagline.trim() || undefined,
      description,
      theme: { fontFamily, fontSize, accent, titleBold, titleItalic, align, bannerUrl: bannerUrl || undefined, logoUrl: logoUrl || undefined },
      paid,
      fee: Number(fee) || 0,
      partPayment,
      otpRequired,
      tiers: tiers.length > 0 ? tiers : undefined,
      highlights: highlights.filter(Boolean).length > 0 ? highlights.filter(Boolean) : undefined,
      whatsappGroupUrl: whatsappGroupUrl.trim() || undefined,
      fields,
      updatedAt: new Date().toISOString()
    };
  }, [accent, align, bannerUrl, batch, description, fee, fields, fontFamily, fontSize, highlights, logoUrl, otpRequired, paid, partPayment, tagline, tiers, title, titleBold, titleItalic, whatsappGroupUrl, workshop, workshopId]);

  const link = useMemo(() => {
    if (typeof window === "undefined" || !workshopId) return "";
    return buildRegistrationUrl({
      baseUrl: customBaseUrl,
      slug: form.workshopSlug
    });
  }, [customBaseUrl, form, workshopId]);
  const selectedDomainOption = customBaseUrl
    ? registrationDomains.includes(normalizeBaseUrl(customBaseUrl)) ? normalizeBaseUrl(customBaseUrl) : "__custom"
    : "";

  function updateField(id: string, patch: Partial<BuilderField>) {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function addField(type: BuilderFieldType) {
    const meta = fieldTypeMeta[type];
    setFields((current) => [
      ...current,
      {
        id: generateId(),
        type,
        label: meta.label,
        required: false,
        options: meta.hasOptions ? ["Option 1", "Option 2"] : undefined
      }
    ]);
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function duplicateField(id: string) {
    setFields((current) => {
      const index = current.findIndex((field) => field.id === id);
      if (index < 0) return current;
      const copy = { ...current[index], id: generateId(), role: undefined };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }

  function removeField(id: string) {
    setFields((current) => current.filter((field) => field.id !== id));
  }

  function saveForm() {
    if (!workshopId) {
      setSaved("Please select a workshop first.");
      return;
    }
    try {
      const list = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
      const next = [form, ...list.filter((item) => item.id !== form.id)];
      void saveLiveState({ forms: next });
      setSaved("Form saved. Copy the link below and share it with clients.");
    } catch {
      setSaved("Could not save the form locally.");
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AdminPlatformShell
      activeLabel="Form Builder"
      description="Design a custom registration form for a workshop batch, then share a self-contained link."
      title="Registration Form Builder"
    >
      <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_1fr]">
        {/* ---------------- Builder ---------------- */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-black text-slate-950">1. Workshop &amp; Batch</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Workshop</span>
                <span className="relative block">
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-10 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    onBlur={() => window.setTimeout(() => setWorkshopPickerOpen(false), 150)}
                    onChange={(event) => {
                      setWorkshopSearch(event.target.value);
                      setWorkshopPickerOpen(true);
                    }}
                    onFocus={() => {
                      setWorkshopSearch("");
                      setWorkshopPickerOpen(true);
                    }}
                    placeholder={workshops.length ? "Search workshop..." : "No workshop added yet"}
                    value={workshopPickerOpen ? workshopSearch : selectedWorkshopName}
                  />
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  {workshopPickerOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                      {filteredWorkshops.length ? filteredWorkshops.map((item) => (
                        <button
                          className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-emerald-50 hover:text-emerald-700 ${item.id === workshopId ? "bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white" : "text-slate-700"}`}
                          key={item.id}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setWorkshopId(item.id);
                            setWorkshopSearch("");
                            setWorkshopPickerOpen(false);
                          }}
                          type="button"
                        >
                          {item.name}
                        </button>
                      )) : (
                        <div className="px-3 py-2 text-sm font-semibold text-slate-500">No matching workshop found.</div>
                      )}
                    </div>
                  ) : null}
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Batch</span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setBatch(event.target.value)}
                  placeholder="Main Batch"
                  value={batch}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-black text-slate-950">2. Header &amp; Style</h3>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Form Title (any language)</span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Form Tagline</span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setTagline(event.target.value)}
                  placeholder="Short subtitle below the title"
                  value={tagline}
                />
                <span className="mt-1 block text-xs font-semibold text-slate-400">Shown below the title on the public registration form.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Description</span>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  value={description}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">WhatsApp Group Invite Link</span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setWhatsappGroupUrl(event.target.value)}
                  placeholder="https://chat.whatsapp.com/xxxxxxxx"
                  value={whatsappGroupUrl}
                />
                <span className="mt-1 block text-xs font-semibold text-slate-400">After registration, the thank-you page can redirect to this group link after 5 seconds.</span>
              </label>
              <label className="flex min-h-[58px] items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span>
                  <span className="block text-sm font-black text-slate-700">WhatsApp OTP Verification</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-400">Send OTP on WhatsApp before registration is submitted.</span>
                </span>
                <input checked={otpRequired} className="size-5 shrink-0 accent-emerald-600" onChange={(event) => setOtpRequired(event.target.checked)} type="checkbox" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">Font</span>
                  <span className="relative block">
                    <select
                      className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-10 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      onChange={(event) => setFontFamily(event.target.value)}
                      value={fontFamily}
                    >
                      {fontOptions.map((font) => (
                        <option key={font.value} value={font.value}>{font.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">Base font size: {fontSize}px</span>
                  <input
                    className="mt-3 w-full accent-emerald-600"
                    max={22}
                    min={13}
                    onChange={(event) => setFontSize(Number(event.target.value))}
                    type="range"
                    value={fontSize}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-xl border border-slate-200 p-1">
                  <ToggleButton active={titleBold} onClick={() => setTitleBold((value) => !value)} title="Bold title"><Bold className="size-4" /></ToggleButton>
                  <ToggleButton active={titleItalic} onClick={() => setTitleItalic((value) => !value)} title="Italic title"><Italic className="size-4" /></ToggleButton>
                  <ToggleButton active={align === "left"} onClick={() => setAlign("left")} title="Align left"><AlignLeft className="size-4" /></ToggleButton>
                  <ToggleButton active={align === "center"} onClick={() => setAlign("center")} title="Align center"><AlignCenter className="size-4" /></ToggleButton>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-600">Accent</span>
                  {accentOptions.map((color) => (
                    <button
                      aria-label={`Accent ${color}`}
                      className={`size-9 sm:size-7 rounded-full border-2 transition ${accent === color ? "border-slate-900" : "border-transparent"}`}
                      key={color}
                      onClick={() => setAccent(color)}
                      style={{ backgroundColor: color }}
                      type="button"
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUploader
                  label="Banner Image"
                  hint="Top banner — recommended 800×200"
                  value={bannerUrl}
                  onChange={setBannerUrl}
                  aspect="banner"
                />
                <ImageUploader
                  label="Logo"
                  hint="Square logo — recommended 200×200"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  aspect="logo"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-950">3. Fields</h3>
              <span className="text-xs font-bold text-slate-400">{fields.length} fields</span>
            </div>

            <div className="mt-4 space-y-3">
              {fields.map((field, index) => (
                <FieldEditor
                  field={field}
                  index={index}
                  key={field.id}
                  onChange={(patch) => updateField(field.id, patch)}
                  onDuplicate={() => duplicateField(field.id)}
                  onMoveDown={() => moveField(index, 1)}
                  onMoveUp={() => moveField(index, -1)}
                  onRemove={() => removeField(field.id)}
                  total={fields.length}
                />
              ))}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-bold text-slate-600">Add a field</p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {addableTypes.map((type) => (
                  <button
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 sm:min-h-0 sm:py-2"
                    key={type}
                    onClick={() => addField(type)}
                    type="button"
                  >
                    <Plus className="size-3.5" />
                    {fieldTypeMeta[type].label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-black text-slate-950">4. Payment</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${!paid ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`} onClick={() => setPaid(false)} type="button">Free</button>
              <button className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${paid ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`} onClick={() => setPaid(true)} type="button">Paid</button>
            </div>
            {paid ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Default Fee (INR)</span>
                    <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" inputMode="numeric" onChange={(event) => setFee(event.target.value)} placeholder="0" value={fee} />
                  </label>
                  <label className="flex min-h-[44px] items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                    <input checked={partPayment} className="size-5 accent-emerald-600" onChange={(event) => setPartPayment(event.target.checked)} type="checkbox" />
                    Allow part payment
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-700">Payment Tiers</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">Set separate prices for Single, Couple, Family, or any custom tier.</p>
                    </div>
                    {tiers.length === 0 ? (
                      <button
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                        onClick={() => setTiers([
                          { id: generateId(), label: "Single", fee: Number(fee) || 0 },
                          { id: generateId(), label: "Couple", fee: 0 },
                        ])}
                        type="button"
                      >
                        + Add Tiers
                      </button>
                    ) : (
                      <button
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100"
                        onClick={() => setTiers([])}
                        type="button"
                      >
                        Remove Tiers
                      </button>
                    )}
                  </div>

                  {tiers.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {tiers.map((tier) => (
                        <div className="flex items-center gap-2" key={tier.id}>
                          <input
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            onChange={(e) => setTiers((prev) => prev.map((t) => t.id === tier.id ? { ...t, label: e.target.value } : t))}
                            placeholder="Tier name (e.g. Single)"
                            value={tier.label}
                          />
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                            <input
                              className="w-28 rounded-lg border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                              inputMode="numeric"
                              onChange={(e) => setTiers((prev) => prev.map((t) => t.id === tier.id ? { ...t, fee: Number(e.target.value) || 0 } : t))}
                              placeholder="0"
                              value={tier.fee || ""}
                            />
                          </div>
                          <button
                            className="grid size-10 shrink-0 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"
                            onClick={() => setTiers((prev) => prev.filter((t) => t.id !== tier.id))}
                            type="button"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={() => setTiers((prev) => [...prev, { id: generateId(), label: "", fee: 0 }])}
                        type="button"
                      >
                        <Plus className="size-3.5" />
                        Add Tier
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-black text-slate-950">5. What&apos;s Included</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">Add the benefits participants will receive, such as materials, recordings, or certificates.</p>
            <div className="mt-4 space-y-2">
              {highlights.map((item, i) => (
                <div className="flex items-center gap-2" key={i}>
                  <Check className="size-4 shrink-0 text-emerald-600" />
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    onChange={(e) => setHighlights((prev) => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder="e.g. Certificate of completion"
                    value={item}
                  />
                  <button
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"
                    onClick={() => setHighlights((prev) => prev.filter((_, j) => j !== i))}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => setHighlights((prev) => [...prev, ""])}
                type="button"
              >
                <Plus className="size-3.5" />
                Add Item
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-black text-slate-950">6. Save &amp; Share</h3>
              <button className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700" onClick={saveForm} type="button">
                Save Form
              </button>
            </div>
            {saved ? <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{saved}</p> : null}
            {link ? (
              <div className="mt-4">
                <label className="mb-3 block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">Registration Domain</span>
                  <select
                    className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
                  <span className="mb-2 block text-sm font-bold text-slate-600">Custom Domain</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    onChange={(event) => setCustomBaseUrl(event.target.value)}
                    placeholder="https://register.cflb.in"
                    value={customBaseUrl}
                  />
                  <span className="mt-1 block text-xs font-semibold text-slate-400">Add reusable subdomains in Settings. Leave blank to use the current dashboard domain.</span>
                </label>
                <span className="mb-2 block text-sm font-bold text-slate-600">Shareable Link</span>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <p className="mb-2 break-all px-2 text-xs font-semibold text-slate-500 line-clamp-2">{link}</p>
                  <div className="flex gap-2">
                    <button className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2.5 text-sm font-bold text-white hover:bg-slate-800" onClick={copyLink} type="button">
                      <Copy className="size-4" />
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                    <a className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" href={link} rel="noreferrer" target="_blank">
                      <ExternalLink className="size-4" />
                      Open
                    </a>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-400">The share link includes the form setup and opens on any device. Matching mobile numbers can prefill saved client details.</p>
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold text-slate-400">Select a workshop to generate the shareable link.</p>
            )}
          </section>
        </div>

        {/* ---------------- Live preview ---------------- */}
        <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Live Preview</p>
          <FormPreview form={form} />
        </div>
      </div>
    </AdminPlatformShell>
  );
}

function ImageUploader({ label, hint, value, onChange, aspect }: { label: string; hint: string; value: string; onChange: (v: string) => void; aspect: "banner" | "logo" }) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    try {
      const dataUrl = await compressImage(file, aspect === "banner" ? MAX_IMAGE_WIDTH : 200);
      onChange(dataUrl);
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
      {value ? (
        <div className="relative">
          <img
            alt={label}
            className={`w-full rounded-xl border border-slate-200 object-cover ${aspect === "banner" ? "h-28" : "size-24"}`}
            src={value}
          />
          <button
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-slate-600 shadow hover:bg-white"
            onClick={() => onChange("")}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-bold text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 ${aspect === "banner" ? "h-28" : "h-24"}`}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <Image className="size-5" />
          Upload {label}
        </button>
      )}
      <input
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      <p className="mt-1 text-xs font-semibold text-slate-400">{hint}</p>
    </div>
  );
}

function ToggleButton({ active, children, onClick, title }: { active: boolean; children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      className={`grid size-11 sm:size-9 place-items-center rounded-lg transition ${active ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function FieldEditor({
  field,
  index,
  onChange,
  onDuplicate,
  onMoveDown,
  onMoveUp,
  onRemove,
  total
}: {
  field: BuilderField;
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
  const options = field.options?.length ? field.options : ["Option 1", "Option 2"];
  const updateOption = (optionIndex: number, value: string) => {
    onChange({ options: options.map((option, currentIndex) => currentIndex === optionIndex ? value : option).filter((option) => option.trim()) });
  };
  const removeOption = (optionIndex: number) => {
    const next = options.filter((_, currentIndex) => currentIndex !== optionIndex);
    onChange({ options: next.length ? next : ["Option 1"] });
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="size-4" />
        </span>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="Field label"
          value={field.label}
        />
        <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 sm:inline">{meta.label}</span>
      </div>

      {meta.hasOptions ? (
        <div className="mt-3 space-y-2 sm:pl-10">
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

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 sm:pl-10">
        <label className="inline-flex min-h-[44px] items-center gap-2 text-xs font-bold text-slate-600">
          <input checked={Boolean(field.required)} className="size-5 accent-emerald-600" onChange={(event) => onChange({ required: event.target.checked })} type="checkbox" />
          Required
        </label>
        <div className="flex items-center gap-0.5">
          <IconBtn disabled={index === 0} onClick={onMoveUp} title="Move up"><ArrowUp className="size-4" /></IconBtn>
          <IconBtn disabled={index === total - 1} onClick={onMoveDown} title="Move down"><ArrowDown className="size-4" /></IconBtn>
          <IconBtn onClick={onDuplicate} title="Duplicate"><Copy className="size-4" /></IconBtn>
          <IconBtn onClick={onRemove} title="Delete" tone="danger"><Trash2 className="size-4" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, disabled, onClick, title, tone }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; title: string; tone?: "danger" }) {
  return (
    <button
      className={`grid size-10 sm:size-8 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${tone === "danger" ? "text-rose-600 hover:bg-rose-50" : "text-slate-500 hover:bg-slate-100"}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function FormPreview({ form }: { form: BuilderForm }) {
  const { theme } = form;
  const displayLogoUrl = theme.logoUrl || BRAND_LOGO_SRC;
  return (
    <div
      className="overflow-hidden rounded-3xl bg-white"
      style={{
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
        boxShadow: `0 2px 0 0 ${theme.accent}22, 0 8px 30px -6px rgba(0,0,0,0.12), 0 20px 50px -12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)`,
      }}
    >
      {theme.bannerUrl ? (
        <div className="relative">
          <img alt="Banner" className="h-36 w-full object-cover" src={theme.bannerUrl} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 40%, ${theme.accent}18 100%)` }} />
        </div>
      ) : (
        <div className="h-2 rounded-t-3xl" style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}99)` }} />
      )}
      <div className="relative p-5 sm:p-7" style={{ textAlign: theme.align }}>
        {displayLogoUrl ? (
          <img
            alt="Coach For Life"
            className={`mb-5 h-24 w-auto max-w-[340px] object-contain ${theme.align === "center" ? "mx-auto" : ""}`}
            src={displayLogoUrl}
          />
        ) : null}
        <h2 className="tracking-tight" style={{ fontWeight: theme.titleBold ? 800 : 600, fontStyle: theme.titleItalic ? "italic" : "normal", fontSize: theme.fontSize + 14, lineHeight: 1.2 }}>
          {form.title || "Untitled form"}
        </h2>
        {form.tagline ? <p className="mt-2 text-base font-bold text-slate-600">{form.tagline}</p> : null}
        {form.description ? (
          <div
            className="rich-text-content mt-2.5 leading-relaxed text-slate-500"
            dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(form.description) }}
          />
        ) : null}
        {form.paid && (!form.tiers || form.tiers.length === 0) ? (
          <span
            className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-black text-white"
            style={{ backgroundColor: theme.accent, boxShadow: `0 4px 14px -3px ${theme.accent}66` }}
          >
            Fee: INR {form.fee.toLocaleString("en-IN")}
          </span>
        ) : null}
        {form.paid && form.tiers && form.tiers.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2" style={{ textAlign: "left" }}>
            {form.tiers.map((tier) => (
              <span
                className="inline-flex rounded-xl px-4 py-2 text-sm font-black text-white"
                key={tier.id}
                style={{ backgroundColor: theme.accent, boxShadow: `0 4px 14px -3px ${theme.accent}66` }}
              >
                {tier.label || "Tier"}: ₹{tier.fee.toLocaleString("en-IN")}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {form.highlights && form.highlights.length > 0 ? (
        <div
          className="mx-5 mb-2 rounded-2xl p-5 sm:mx-7"
          style={{ background: `linear-gradient(135deg, ${theme.accent}08, ${theme.accent}15)`, border: `1px solid ${theme.accent}20` }}
        >
          <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
            <span className="grid size-6 place-items-center rounded-lg text-white" style={{ backgroundColor: theme.accent, boxShadow: `0 2px 8px -2px ${theme.accent}88` }}>✦</span>
            What you&apos;ll get
          </p>
          <ul className="space-y-2">
            {form.highlights.map((item, i) => (
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
      <div className="space-y-4 px-5 pb-5 pt-3 sm:px-7 sm:pb-7">
        {form.paid && form.tiers && form.tiers.length > 0 ? (
          <div>
            <span className="mb-2 block text-sm font-bold text-slate-700">Registration Type <span style={{ color: theme.accent }}>*</span></span>
            <div className="space-y-2">
              {form.tiers.map((tier, i) => (
                <label
                  className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300"
                  key={tier.id}
                  style={i === 0 ? { borderColor: theme.accent, backgroundColor: `${theme.accent}08`, boxShadow: `0 0 0 1px ${theme.accent}33` } : {}}
                >
                  <input className="size-5" style={{ accentColor: theme.accent }} type="radio" name="preview-tier" defaultChecked={i === 0} />
                  <span className="flex-1">{tier.label || "Tier"}</span>
                  <span className="font-black" style={{ color: theme.accent }}>₹{tier.fee.toLocaleString("en-IN")}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {form.fields.map((field) => (
          <PreviewField field={field} key={field.id} accent={theme.accent} />
        ))}
        {form.otpRequired ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <span className="mb-2 block text-sm font-black text-slate-700">WhatsApp OTP Verification</span>
            <span className="mb-3 block text-xs font-semibold text-slate-500">OTP will be sent on WhatsApp to the participant mobile number.</span>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none" placeholder="Enter 6-digit OTP" />
              <button className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white" type="button">Verify</button>
            </div>
          </div>
        ) : null}
        <button
          className="w-full min-h-[52px] rounded-2xl px-5 py-3.5 text-sm font-black tracking-wide text-white uppercase transition-transform hover:scale-[1.01] active:scale-[0.99]"
          style={{ backgroundColor: theme.accent, boxShadow: `0 6px 20px -4px ${theme.accent}55, 0 2px 4px -1px ${theme.accent}33` }}
          type="button"
        >
          {form.paid ? "Register & Pay" : "Confirm Registration"}
        </button>
      </div>
    </div>
  );
}

function PreviewField({ field, accent }: { field: BuilderField; accent: string }) {
  if (field.type === "heading") {
    return <h3 className="border-b border-slate-100 pb-1 text-base font-black text-slate-900">{field.label}</h3>;
  }
  const label = (
    <span className="mb-1.5 block text-sm font-bold text-slate-700">
      {field.label}
      {field.required ? <span style={{ color: accent }}> *</span> : null}
    </span>
  );
  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-base sm:text-sm outline-none transition-all focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100";

  if (field.type === "paragraph") {
    return <label className="block">{label}<textarea className={inputClass} placeholder={field.placeholder} rows={3} /></label>;
  }
  if (field.type === "dropdown") {
    return (
      <label className="block">{label}
        <select className={inputClass}>
          <option value="">Select…</option>
          {(field.options ?? []).map((option) => <option key={option}>{option}</option>)}
          {field.allowOther ? <option>Other</option> : null}
        </select>
        {field.allowOther ? <input className={`${inputClass} mt-2`} placeholder="Please specify" /> : null}
      </label>
    );
  }
  if (field.type === "radio" || field.type === "checkbox") {
    return (
      <div>{label}
        <div className="space-y-1.5">
          {(field.options ?? []).map((option) => (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={option}>
              <input className="size-4" style={{ accentColor: accent }} type={field.type === "radio" ? "radio" : "checkbox"} name={field.id} />
              {option}
            </label>
          ))}
          {field.allowOther ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input className="size-4" style={{ accentColor: accent }} type={field.type === "radio" ? "radio" : "checkbox"} name={field.id} />
              Other
              <input className={`${inputClass} ml-2 py-2`} placeholder="Please specify" />
            </label>
          ) : null}
        </div>
      </div>
    );
  }
  const inputType = field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  return <label className="block">{label}<input className={inputClass} placeholder={field.placeholder} type={inputType} /></label>;
}
