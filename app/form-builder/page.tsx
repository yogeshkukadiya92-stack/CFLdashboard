"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import type { BuilderField, BuilderFieldType, BuilderForm } from "@/lib/types";
import { encodeJsonParam, generateId } from "@/lib/utils";
import {
  AlignCenter,
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Bold,
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
  Type
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const WORKSHOP_MASTER_STORAGE_KEY = "cfl_workshop_master_records_v1";
const FORMS_STORAGE_KEY = "cfl_forms_v1";

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
  dropdown: { label: "Dropdown", hasOptions: true },
  radio: { label: "Multiple Choice", hasOptions: true },
  checkbox: { label: "Checkboxes", hasOptions: true },
  heading: { label: "Section Heading", hasOptions: false }
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
    { id: generateId(), type: "email", label: "Email", placeholder: "you@example.com", required: true, role: "email" },
    { id: generateId(), type: "short_text", label: "City", placeholder: "Your city", role: "city" }
  ];
}

export default function FormBuilderPage() {
  const [workshops, setWorkshops] = useState<WorkshopMasterRecord[]>([]);
  const [workshopId, setWorkshopId] = useState("");
  const [batch, setBatch] = useState("Main Batch");
  const [title, setTitle] = useState("Workshop Registration");
  const [description, setDescription] = useState("Please fill in your details to confirm your seat.");
  const [paid, setPaid] = useState(false);
  const [fee, setFee] = useState("");
  const [partPayment, setPartPayment] = useState(false);
  const [fields, setFields] = useState<BuilderField[]>(defaultFields);
  const [fontFamily, setFontFamily] = useState(fontOptions[0].value);
  const [fontSize, setFontSize] = useState(16);
  const [accent, setAccent] = useState(accentOptions[0]);
  const [titleBold, setTitleBold] = useState(true);
  const [titleItalic, setTitleItalic] = useState(false);
  const [align, setAlign] = useState<"left" | "center">("left");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WORKSHOP_MASTER_STORAGE_KEY);
      setWorkshops(raw ? (JSON.parse(raw) as WorkshopMasterRecord[]) : []);
    } catch {
      setWorkshops([]);
    }
  }, []);

  const workshop = workshops.find((item) => item.id === workshopId) ?? null;

  const form = useMemo<BuilderForm>(() => {
    const name = workshop?.name ?? "";
    return {
      id: workshopId ? `form-${workshopId}-${slugify(batch) || "main"}` : "form-draft",
      workshopId,
      workshopName: name,
      workshopSlug: slugify(name) || workshopId || "workshop",
      batch,
      title,
      description,
      theme: { fontFamily, fontSize, accent, titleBold, titleItalic, align },
      paid,
      fee: Number(fee) || 0,
      partPayment,
      fields,
      updatedAt: new Date().toISOString()
    };
  }, [accent, align, batch, description, fee, fields, fontFamily, fontSize, paid, partPayment, title, titleBold, titleItalic, workshop, workshopId]);

  const link = useMemo(() => {
    if (typeof window === "undefined" || !workshopId) return "";
    return `${window.location.origin}/register/${form.workshopSlug}?f=${encodeJsonParam(form)}`;
  }, [form, workshopId]);

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
      const raw = window.localStorage.getItem(FORMS_STORAGE_KEY);
      const list = raw ? (JSON.parse(raw) as BuilderForm[]) : [];
      const next = [form, ...list.filter((item) => item.id !== form.id)];
      window.localStorage.setItem(FORMS_STORAGE_KEY, JSON.stringify(next));
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
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        {/* ---------------- Builder ---------------- */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-black text-slate-950">1. Workshop &amp; Batch</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Workshop</span>
                <span className="relative block">
                  <select
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-10 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    onChange={(event) => setWorkshopId(event.target.value)}
                    value={workshopId}
                  >
                    <option value="">{workshops.length ? "Select workshop" : "No workshop added yet"}</option>
                    {workshops.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
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
                <span className="mb-2 block text-sm font-bold text-slate-600">Description</span>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  value={description}
                />
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
                      className={`size-7 rounded-full border-2 transition ${accent === color ? "border-slate-900" : "border-transparent"}`}
                      key={color}
                      onClick={() => setAccent(color)}
                      style={{ backgroundColor: color }}
                      type="button"
                    />
                  ))}
                </div>
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
              <div className="flex flex-wrap gap-2">
                {addableTypes.map((type) => (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
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
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">Fee (INR)</span>
                  <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" inputMode="numeric" onChange={(event) => setFee(event.target.value)} placeholder="0" value={fee} />
                </label>
                <label className="flex min-h-[44px] items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                  <input checked={partPayment} className="size-5 accent-emerald-600" onChange={(event) => setPartPayment(event.target.checked)} type="checkbox" />
                  Allow part payment
                </label>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-950">5. Save &amp; Share</h3>
              <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700" onClick={saveForm} type="button">
                Save Form
              </button>
            </div>
            {saved ? <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{saved}</p> : null}
            {link ? (
              <div className="mt-4">
                <span className="mb-2 block text-sm font-bold text-slate-600">Shareable Link</span>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold text-slate-700">{link}</span>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800" onClick={copyLink} type="button">
                    <Copy className="size-4" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <a className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" href={link} rel="noreferrer" target="_blank">
                    <ExternalLink className="size-4" />
                    Open
                  </a>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-400">Aakho form link ma j encode thay che — koi pan device par khulse. Mobile match thase to saved client details auto bharai jashe.</p>
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold text-slate-400">Select a workshop to generate the shareable link.</p>
            )}
          </section>
        </div>

        {/* ---------------- Live preview ---------------- */}
        <div className="xl:sticky xl:top-24 xl:self-start">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Live Preview</p>
          <FormPreview form={form} />
        </div>
      </div>
    </AdminPlatformShell>
  );
}

function ToggleButton({ active, children, onClick, title }: { active: boolean; children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      className={`grid size-9 place-items-center rounded-lg transition ${active ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
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

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="size-4" />
        </span>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="Field label"
          value={field.label}
        />
        <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 sm:inline">{meta.label}</span>
      </div>

      {meta.hasOptions ? (
        <div className="mt-2 pl-10">
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            onChange={(event) => onChange({ options: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
            placeholder="One option per line"
            rows={3}
            value={(field.options ?? []).join("\n")}
          />
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between pl-10">
        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
          <input checked={Boolean(field.required)} className="size-4 accent-emerald-600" onChange={(event) => onChange({ required: event.target.checked })} type="checkbox" />
          Required
        </label>
        <div className="flex items-center gap-1">
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
      className={`grid size-8 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${tone === "danger" ? "text-rose-600 hover:bg-rose-50" : "text-slate-500 hover:bg-slate-100"}`}
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
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft" style={{ fontFamily: theme.fontFamily, fontSize: theme.fontSize }}>
      <div className="p-6" style={{ textAlign: theme.align, borderTop: `4px solid ${theme.accent}` }}>
        <h2 style={{ fontWeight: theme.titleBold ? 800 : 600, fontStyle: theme.titleItalic ? "italic" : "normal", fontSize: theme.fontSize + 12 }}>
          {form.title || "Untitled form"}
        </h2>
        {form.description ? <p className="mt-2 text-slate-500">{form.description}</p> : null}
        {form.paid ? (
          <span className="mt-3 inline-flex rounded-lg px-3 py-1.5 text-sm font-black text-white" style={{ backgroundColor: theme.accent }}>
            Fee: INR {form.fee.toLocaleString("en-IN")}
          </span>
        ) : null}
      </div>
      <div className="space-y-4 px-6 pb-6">
        {form.fields.map((field) => (
          <PreviewField field={field} key={field.id} accent={theme.accent} />
        ))}
        <button className="w-full rounded-xl px-5 py-3 text-sm font-black text-white" style={{ backgroundColor: theme.accent }} type="button">
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
  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none";

  if (field.type === "paragraph") {
    return <label className="block">{label}<textarea className={inputClass} placeholder={field.placeholder} rows={3} /></label>;
  }
  if (field.type === "dropdown") {
    return (
      <label className="block">{label}
        <select className={inputClass}>
          <option value="">Select…</option>
          {(field.options ?? []).map((option) => <option key={option}>{option}</option>)}
        </select>
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
        </div>
      </div>
    );
  }
  const inputType = field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  return <label className="block">{label}<input className={inputClass} placeholder={field.placeholder} type={inputType} /></label>;
}
