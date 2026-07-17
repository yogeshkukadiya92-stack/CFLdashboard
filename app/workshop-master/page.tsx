"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { AlertCircle, Archive, ArrowDown, ArrowUp, Bold, Check, CheckSquare, ChevronDown, Circle, Copy, Download, Edit3, ExternalLink, Eye, Heading, Image, Italic, Link2, List, ListOrdered, Mail, Palette, Plus, QrCode, RefreshCw, Save, Search, Smartphone, Trash2, Type, Underline, UsersRound, X } from "lucide-react";
import { hydrateLiveState, readLocalArray, readLocalObject, saveLiveState } from "@/lib/live-state";
import { buildRegistrationUrl, normalizeBaseUrl } from "@/lib/registration-url";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import type { BuilderField, BuilderFieldType, BuilderForm, BuilderTheme, RegistrationEntry } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { type ClipboardEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

type WorkshopRecord = {
  archived?: boolean;
  batch?: string;
  discountCodeEod?: string;
  discountDescription?: string;
  discountType?: DiscountType;
  discountValue?: string;
  feesWithTax?: string;
  id: string;
  isPartPaymentAllow?: boolean;
  name: string;
  maxOrderQty?: string;
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
const IMAGE_QUALITY = 0.7;
const MAX_LOGO_WIDTH = 240;
const defaultWorkshopTypes = ["1-2-1 Coaching", "Workshop", "Online Event", "Offline Event", "Hybrid Program"];
const defaultFacilitators = ["Dr Luv Patel"];
const productGroups = ["Health", "Spiritual", "Leadership", "Sales", "Fitness", "Business Growth"];
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const defaultTheme: BuilderTheme = {
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontSize: 16,
  accent: "#059669",
  titleBold: true,
  titleItalic: false,
  align: "left"
};
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
const addableTypes: BuilderFieldType[] = ["short_text", "paragraph", "email", "mobile", "number", "date", "dropdown", "radio", "checkbox", "heading"];
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
  const [records, setRecords] = useState<WorkshopRecord[]>([]);
  const [workshopTypes, setWorkshopTypes] = useState<string[]>(defaultWorkshopTypes);
  const [facilitators, setFacilitators] = useState<string[]>(defaultFacilitators);
  const [formTitle, setFormTitle] = useState("Workshop Registration");
  const [formDescription, setFormDescription] = useState("Please fill in your details to confirm your seat.");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formFields, setFormFields] = useState<BuilderField[]>(defaultBuilderFields);
  const [formHighlights, setFormHighlights] = useState<string[]>([]);
  const [formOtpRequired, setFormOtpRequired] = useState(false);
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [recordScope, setRecordScope] = useState<"all" | "active" | "historical">("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [linkWorkshop, setLinkWorkshop] = useState<WorkshopRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkshopRecord | null>(null);

  useEffect(() => {
    function loadLocal() {
      setRecords(readLocalArray<WorkshopRecord>(STORAGE_KEY));
      setWorkshopTypes(readMasterNames(WORKSHOP_TYPES_STORAGE_KEY, defaultWorkshopTypes));
      setFacilitators(readMasterNames(FACILITATORS_STORAGE_KEY, defaultFacilitators));
      setRegistrations(readLocalArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY));
    }

    loadLocal();
    hydrateLiveState().then(loadLocal);
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
  const selectedParticipants = useMemo(() => {
    if (!selectedWorkshop) return [];
    const selectedName = selectedWorkshop.name.trim().toLowerCase();
    return registrations.filter((entry) =>
      entry.workshopId === selectedWorkshop.id ||
      entry.workshopTitle.trim().toLowerCase() === selectedName
    );
  }, [registrations, selectedWorkshop]);

  async function saveRecords(next: WorkshopRecord[]) {
    setRecords(next);
    return saveLiveState({ workshops: next });
  }

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
    setEditingId(record.id);
    loadBuilderForm(record);
    setShowData(false);
    setSelectedWorkshopId(null);
    setShowParticipants(false);
    setMessage("Editing selected workshop.");
    window.requestAnimationFrame(() => window.scrollTo({ behavior: "smooth", top: 0 }));
  }

  function openWorkshop(record: WorkshopRecord) {
    setRegistrations(readLocalArray<RegistrationEntry>(REGISTRATION_STORAGE_KEY));
    setSelectedWorkshopId(record.id);
    setShowParticipants(false);
  }

  function deleteRecord(id: string) {
    saveRecords(records.filter((record) => record.id !== id));
    deleteBuilderForm(id);
    if (selectedWorkshopId === id) setSelectedWorkshopId(null);
    setDeleteTarget(null);
    setMessage("Workshop deleted.");
  }

  function buildWorkshopRecord(id: string): WorkshopRecord {
    return {
      batch: batch.trim() || "Main Batch",
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
    setFormDescription("Please fill in your details to confirm your seat.");
    setFormLogoUrl("");
    setFormFields(defaultBuilderFields());
    setFormHighlights([]);
    setFormOtpRequired(false);
    setWhatsappGroupUrl("");
  }

  function buildRegistrationForm(record: WorkshopRecord): BuilderForm {
    return {
      id: `form-${record.id}-main`,
      workshopId: record.id,
      workshopName: record.name,
      workshopSlug: workshopSlug(record.name) || record.id,
      batch: record.batch || "Main Batch",
      title: formTitle.trim() || `${record.name} Registration`,
      description: sanitizeRichTextHtml(formDescription),
      theme: { ...defaultTheme, logoUrl: formLogoUrl || undefined },
      paid: record.isPaid,
      fee: Number(record.feesWithTax || 0),
      partPayment: Boolean(record.isPartPaymentAllow),
      otpRequired: formOtpRequired,
      highlights: formHighlights.map((item) => item.trim()).filter(Boolean),
      whatsappGroupUrl: whatsappGroupUrl.trim() || undefined,
      fields: normalizeCoreFieldRequirements(formFields),
      updatedAt: new Date().toISOString()
    };
  }

  async function saveBuilderForm(record: WorkshopRecord) {
    try {
      const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
      const form = buildRegistrationForm(record);
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
        setFormDescription("Please fill in your details to confirm your seat.");
        setFormLogoUrl("");
        setFormFields(defaultBuilderFields());
        setFormHighlights([]);
        setFormOtpRequired(false);
        return;
      }
      setFormTitle(savedForm.title || `${record.name} Registration`);
      setFormDescription(savedForm.description || "");
      setFormLogoUrl(savedForm.theme?.logoUrl ?? "");
      setFormFields(savedForm.fields?.length ? normalizeCoreFieldRequirements(savedForm.fields) : defaultBuilderFields());
      setFormHighlights(savedForm.highlights ?? []);
      setFormOtpRequired(Boolean(savedForm.otpRequired));
      setWhatsappGroupUrl(savedForm.whatsappGroupUrl ?? "");
    } catch {
      resetBuilderForm();
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

  return (
    <AdminPlatformShell activeLabel="Workshop Master" description="Create workshop/product masters and configure registration fields in one platform." title="Manage Workshop">
      {!showData ? (
      <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" onSubmit={submit}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">Form completion</p>
            <p className="text-3xl font-black text-slate-950">{progress}%</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50" onClick={() => setShowData(true)} type="button">
            <Eye className="size-4" />
            View Workshops ({records.length})
          </button>
        </div>

        {message ? (
          <div className={`mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${message.includes("Please") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {message.includes("Please") ? <AlertCircle className="size-4" /> : <Check className="size-4" />}
            {message}
          </div>
        ) : null}

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

        <div className="mt-7 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Registration Form Builder</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Create registration form with workshop</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">These fields appear on the public registration page for this workshop.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">{formFields.length} fields</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Form Title</span>
              <input className={inputClass} onChange={(event) => setFormTitle(event.target.value)} placeholder="Workshop Registration" value={formTitle} />
            </label>
            <FormLogoUploader value={formLogoUrl} onChange={setFormLogoUrl} />
            <div className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-600">Form Description</span>
              <RichTextEditor onChange={setFormDescription} value={formDescription} />
            </div>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-600">WhatsApp Group Invite Link</span>
              <input className={inputClass} onChange={(event) => setWhatsappGroupUrl(event.target.value)} placeholder="https://chat.whatsapp.com/xxxxxxxx" value={whatsappGroupUrl} />
              <span className="mt-1 block text-xs font-semibold text-slate-400">After registration, the thank-you page can redirect to this group link after 5 seconds.</span>
            </label>
            <label className="flex min-h-[58px] items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-white px-4 py-3 md:col-span-2">
              <span>
                <span className="block text-sm font-black text-slate-700">WhatsApp OTP Verification</span>
                <span className="mt-0.5 block text-xs font-semibold text-slate-400">Turn on when participants must verify a WhatsApp OTP before submitting this registration form.</span>
              </span>
              <input checked={formOtpRequired} className="size-5 shrink-0 accent-emerald-600" onChange={(event) => setFormOtpRequired(event.target.checked)} type="checkbox" />
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {formFields.map((field, index) => (
              <FieldEditor
                field={field}
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

          <div className="mt-4 border-t border-emerald-100 pt-4">
            <p className="mb-2 text-sm font-bold text-slate-600">Add field</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {addableTypes.map((fieldType) => (
                <button
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 sm:min-h-0 sm:py-2"
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

          <div className="mt-5 border-t border-emerald-100 pt-4">
            <p className="mb-2 text-sm font-bold text-slate-600">What's Included</p>
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

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => clearForm()} type="button">
            <RefreshCw className="size-4" />
            Clear
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" type="submit">
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
                  <tr className="hover:bg-indigo-50/40" key={record.id}>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {record.archived ? (
                          <a aria-label={`View ${record.name} historical data`} className="grid size-9 place-items-center rounded-xl bg-amber-500 text-white hover:bg-amber-600" href="/historical-data" title="View historical data"><Archive className="size-4" /></a>
                        ) : (
                          <>
                            <button aria-label="Edit registration link" className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setLinkWorkshop(record)} title="Edit registration link" type="button"><Link2 className="size-4" /></button>
                            <button className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => editRecord(record)} title="Edit" type="button"><Edit3 className="size-4" /></button>
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

          {selectedWorkshop ? (
            <section className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Workshop Opened</p>
                  <h4 className="mt-2 text-2xl font-black text-slate-950">{selectedWorkshop.name}</h4>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {selectedWorkshop.type} | {selectedWorkshop.facilitator} | {selectedWorkshop.productGroup}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
                    onClick={() => setShowParticipants((value) => !value)}
                    type="button"
                  >
                    <UsersRound className="size-4" />
                    {showParticipants ? "Hide Data" : `View Data (${selectedParticipants.length})`}
                  </button>
                  <button
                    className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    onClick={() => {
                      setSelectedWorkshopId(null);
                      setShowParticipants(false);
                    }}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Users" value={selectedParticipants.length} />
                <MiniStat label="Paid" value={selectedParticipants.filter((entry) => entry.status === "Paid").length} />
                <MiniStat label="Due" value={selectedParticipants.filter((entry) => entry.status === "Due").length} />
              </div>

              {showParticipants ? (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="min-w-[860px] w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        {["User", "Mobile", "Email", "City", "Payment", "Paid", "Due", "Reg. Date"].map((head) => (
                          <th className="px-4 py-3" key={head}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedParticipants.length ? selectedParticipants.map((entry) => (
                        <tr className="hover:bg-indigo-50/40" key={entry.id}>
                          <td className="px-4 py-4 font-black text-slate-950">{entry.fullName}</td>
                          <td className="px-4 py-4">{entry.mobile}</td>
                          <td className="px-4 py-4">{entry.email}</td>
                          <td className="px-4 py-4">{entry.city}</td>
                          <td className="px-4 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${entry.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">INR {entry.amountPaid.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-4">INR {entry.amountDue.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-4">{entry.createdAt}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                            No users registered in this workshop yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      ) : null}

      {linkWorkshop ? <RegistrationLinkModal workshop={linkWorkshop} onClose={() => setLinkWorkshop(null)} /> : null}
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
    </AdminPlatformShell>
  );
}

function workshopSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function registrationSlug(workshop: WorkshopRecord) {
  const base = workshopSlug(workshop.name) || "workshop";
  const shortId = workshop.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toLowerCase();
  return shortId ? `${base}-${shortId}` : base;
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
        const forms = readLocalArray<BuilderForm>(FORMS_STORAGE_KEY);
        const savedForm = forms.find((item) => item.workshopId === workshop.id || item.workshopSlug === workshopSlug(workshop.name));
        setOtpRequired(Boolean(savedForm?.otpRequired));
      }
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
      void saveLiveState({ registrationLinks: configs });
      setSaveStatus("saved");
      const timeout = window.setTimeout(() => setSaveStatus("idle"), 1600);
      return () => window.clearTimeout(timeout);
    } catch {
      // The link still opens from Workshop Master fallback if storage is unavailable.
    }
  }, [batch, customBaseUrl, fee, linkSettingsLoaded, otpRequired, paid, partPayment, publishUntil, published, shortSlug, venue, workshop]);

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
  const lockedRole = field.role === "name" || field.role === "mobile";
  const options = field.options?.length ? field.options : ["Option 1", "Option 2"];
  const updateOption = (optionIndex: number, value: string) => {
    onChange({ options: options.map((option, currentIndex) => currentIndex === optionIndex ? value : option).filter((option) => option.trim()) });
  };
  const removeOption = (optionIndex: number) => {
    const next = options.filter((_, currentIndex) => currentIndex !== optionIndex);
    onChange({ options: next.length ? next : ["Option 1"] });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
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

      {field.type !== "heading" ? (
        <div className="mt-2 sm:pl-11">
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 sm:pl-11">
        <label className="inline-flex min-h-[40px] items-center gap-2 text-xs font-bold text-slate-600">
          <input checked={Boolean(field.required)} className="size-5 accent-emerald-600" disabled={lockedRole} onChange={(event) => onChange({ required: event.target.checked })} type="checkbox" />
          Required
        </label>
        <div className="flex items-center gap-0.5">
          <IconButton disabled={index === 0} onClick={onMoveUp} title="Move up"><ArrowUp className="size-4" /></IconButton>
          <IconButton disabled={index === total - 1} onClick={onMoveDown} title="Move down"><ArrowDown className="size-4" /></IconButton>
          <IconButton onClick={onDuplicate} title="Duplicate"><Copy className="size-4" /></IconButton>
          <IconButton disabled={lockedRole} onClick={onRemove} title={lockedRole ? "Core field" : "Delete"} tone="danger"><Trash2 className="size-4" /></IconButton>
        </div>
      </div>
    </div>
  );
}

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
