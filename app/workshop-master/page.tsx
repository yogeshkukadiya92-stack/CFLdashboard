"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { AlertCircle, ArrowDown, ArrowUp, Check, CheckSquare, ChevronDown, Circle, Copy, Download, Edit3, ExternalLink, Eye, Heading, Link2, Mail, Plus, QrCode, RefreshCw, Save, Search, Smartphone, Trash2, Type, UsersRound, X } from "lucide-react";
import type { BuilderField, BuilderFieldType, BuilderForm, BuilderTheme, RegistrationEntry } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type WorkshopRecord = {
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
  transferLeadToCrm?: boolean;
};
type DiscountType = "percent" | "flat";
type RegistrationLinkConfig = {
  batch?: string;
  facilitator?: string;
  fee?: number;
  id?: string;
  paid?: boolean;
  partPayment?: boolean;
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
const defaultWorkshopTypes = ["1-2-1 Coaching", "Workshop", "Online Event", "Offline Event", "Hybrid Program"];
const defaultFacilitators = ["Dr Luv Patel", "Amit Verma", "Neha Kapoor", "Arjun Sharma"];
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

function defaultBuilderFields(): BuilderField[] {
  return [
    { id: generateId(), type: "short_text", label: "Full Name", placeholder: "Your full name", required: true, role: "name" },
    { id: generateId(), type: "mobile", label: "Mobile Number", placeholder: "10-digit mobile", required: true, role: "mobile" },
    { id: generateId(), type: "email", label: "Email", placeholder: "you@example.com", required: true, role: "email" },
    { id: generateId(), type: "short_text", label: "City", placeholder: "Your city", role: "city" }
  ];
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
  const [formFields, setFormFields] = useState<BuilderField[]>(defaultBuilderFields);
  const [formHighlights, setFormHighlights] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [linkWorkshop, setLinkWorkshop] = useState<WorkshopRecord | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) setRecords(JSON.parse(raw) as WorkshopRecord[]);
    setWorkshopTypes(readMasterNames(WORKSHOP_TYPES_STORAGE_KEY, defaultWorkshopTypes));
    setFacilitators(readMasterNames(FACILITATORS_STORAGE_KEY, defaultFacilitators));
    const registrationRaw = window.localStorage.getItem(REGISTRATION_STORAGE_KEY);
    if (registrationRaw) setRegistrations(JSON.parse(registrationRaw) as RegistrationEntry[]);
  }, []);

  const progress = useMemo(() => Math.round(([name, type, facilitator, group].filter(Boolean).length / 4) * 100), [facilitator, group, name, type]);
  const filteredRecords = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return records;
    return records.filter((record) =>
      [record.name, record.type, record.facilitator, record.productGroup, record.isPaid ? "paid" : "free"].some((item) =>
        item.toLowerCase().includes(value)
      )
    );
  }, [records, search]);
  const paidCount = records.filter((record) => record.isPaid).length;
  const selectedWorkshop = records.find((record) => record.id === selectedWorkshopId) ?? null;
  const selectedParticipants = useMemo(() => {
    if (!selectedWorkshop) return [];
    const selectedName = selectedWorkshop.name.trim().toLowerCase();
    return registrations.filter((entry) =>
      entry.workshopId === selectedWorkshop.id ||
      entry.workshopTitle.trim().toLowerCase() === selectedName
    );
  }, [registrations, selectedWorkshop]);

  function saveRecords(next: WorkshopRecord[]) {
    setRecords(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !type || !facilitator || !group) {
      setMessage("Please fill Workshop Name, Type, Facilitator and Product Group.");
      return;
    }
    if (editingId) {
      const updatedRecord = buildWorkshopRecord(editingId);
      saveRecords(records.map((record) => record.id === editingId ? updatedRecord : record));
      saveBuilderForm(updatedRecord);
      setMessage("Workshop updated successfully.");
    } else {
      const newRecord = buildWorkshopRecord(generateId());
      saveRecords([newRecord, ...records]);
      saveBuilderForm(newRecord);
      setMessage("Workshop saved successfully.");
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
    setMessage("Editing selected workshop.");
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function openWorkshop(record: WorkshopRecord) {
    const registrationRaw = window.localStorage.getItem(REGISTRATION_STORAGE_KEY);
    setRegistrations(registrationRaw ? JSON.parse(registrationRaw) as RegistrationEntry[] : []);
    setSelectedWorkshopId(record.id);
    setShowParticipants(false);
  }

  function deleteRecord(id: string) {
    saveRecords(records.filter((record) => record.id !== id));
    deleteBuilderForm(id);
    if (selectedWorkshopId === id) setSelectedWorkshopId(null);
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
    setFormFields(defaultBuilderFields());
    setFormHighlights([]);
  }

  function buildRegistrationForm(record: WorkshopRecord): BuilderForm {
    return {
      id: `form-${record.id}-main`,
      workshopId: record.id,
      workshopName: record.name,
      workshopSlug: workshopSlug(record.name) || record.id,
      batch: record.batch || "Main Batch",
      title: formTitle.trim() || `${record.name} Registration`,
      description: formDescription,
      theme: defaultTheme,
      paid: record.isPaid,
      fee: Number(record.feesWithTax || 0),
      partPayment: Boolean(record.isPartPaymentAllow),
      highlights: formHighlights.map((item) => item.trim()).filter(Boolean),
      fields: formFields,
      updatedAt: new Date().toISOString()
    };
  }

  function saveBuilderForm(record: WorkshopRecord) {
    try {
      const raw = window.localStorage.getItem(FORMS_STORAGE_KEY);
      const forms = raw ? JSON.parse(raw) as BuilderForm[] : [];
      const form = buildRegistrationForm(record);
      const next = [form, ...forms.filter((item) => item.id !== form.id && item.workshopId !== record.id)];
      window.localStorage.setItem(FORMS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Workshop save should still work if local form storage is unavailable.
    }
  }

  function loadBuilderForm(record: WorkshopRecord) {
    try {
      const raw = window.localStorage.getItem(FORMS_STORAGE_KEY);
      const forms = raw ? JSON.parse(raw) as BuilderForm[] : [];
      const savedForm = forms.find((item) => item.workshopId === record.id || item.workshopSlug === workshopSlug(record.name));
      if (!savedForm) {
        setFormTitle(`${record.name} Registration`);
        setFormDescription("Please fill in your details to confirm your seat.");
        setFormFields(defaultBuilderFields());
        setFormHighlights([]);
        return;
      }
      setFormTitle(savedForm.title || `${record.name} Registration`);
      setFormDescription(savedForm.description || "");
      setFormFields(savedForm.fields?.length ? savedForm.fields : defaultBuilderFields());
      setFormHighlights(savedForm.highlights ?? []);
    } catch {
      resetBuilderForm();
    }
  }

  function deleteBuilderForm(id: string) {
    try {
      const raw = window.localStorage.getItem(FORMS_STORAGE_KEY);
      const forms = raw ? JSON.parse(raw) as BuilderForm[] : [];
      window.localStorage.setItem(FORMS_STORAGE_KEY, JSON.stringify(forms.filter((item) => item.workshopId !== id)));
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
              <p className="mt-1 text-sm font-semibold text-slate-500">Aa settings schedule page mathi ahi merge kari che.</p>
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
              <p className="mt-1 text-sm font-semibold text-slate-500">Aa fields public registration page par dekhase.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">{formFields.length} fields</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Form Title</span>
              <input className={inputClass} onChange={(event) => setFormTitle(event.target.value)} placeholder="Workshop Registration" value={formTitle} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Form Description</span>
              <input className={inputClass} onChange={(event) => setFormDescription(event.target.value)} placeholder="Short instruction for clients" value={formDescription} />
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
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Total" value={records.length} />
                <MiniStat label="Paid" value={paidCount} />
                <MiniStat label="Free" value={records.length - paidCount} />
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
            <label className="relative block w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workshop, type, facilitator..."
                value={search}
              />
            </label>
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
                        <button aria-label="Edit registration link" className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setLinkWorkshop(record)} title="Edit registration link" type="button">
                          <Link2 className="size-4" />
                        </button>
                        <button className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => editRecord(record)} title="Edit" type="button">
                          <Edit3 className="size-4" />
                        </button>
                        <button className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => deleteRecord(record.id)} title="Delete" type="button">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        className="text-left font-black text-indigo-700 underline-offset-4 hover:underline"
                        onClick={() => openWorkshop(record)}
                        type="button"
                      >
                        {record.name}
                      </button>
                    </td>
                    <td className="px-4 py-4">{record.type}</td>
                    <td className="px-4 py-4">{record.facilitator}</td>
                    <td className="px-4 py-4">{record.productGroup}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${record.isPaid ? "bg-slate-950 text-white" : "bg-emerald-50 text-emerald-700"}`}>
                        {record.isPaid ? "Paid" : "Free"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{record.batch || "Main Batch"}</td>
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
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaults;
    const records = JSON.parse(raw) as Array<{ name?: string }>;
    const names = records.map((record) => record.name?.trim()).filter(Boolean) as string[];
    return names.length ? names : defaults;
  } catch {
    return defaults;
  }
}

function RegistrationLinkModal({ workshop, onClose }: { workshop: WorkshopRecord; onClose: () => void }) {
  const [paid, setPaid] = useState(workshop.isPaid);
  const [fee, setFee] = useState(workshop.feesWithTax ?? "");
  const [partPayment, setPartPayment] = useState(Boolean(workshop.isPartPaymentAllow));
  const [batch, setBatch] = useState(workshop.batch ?? "Main Batch");
  const [venue, setVenue] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [linkSettingsLoaded, setLinkSettingsLoaded] = useState(false);
  const shortSlug = useMemo(() => registrationSlug(workshop), [workshop]);

  const link = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/register/${shortSlug}`;
  }, [shortSlug]);
  const qrUrl = link ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(link)}` : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(REGISTRATION_LINK_CONFIG_STORAGE_KEY);
      const configs = raw ? JSON.parse(raw) as Record<string, RegistrationLinkConfig> : {};
      const existing = configs[shortSlug] ?? Object.values(configs).find((config) => config.id === workshop.id);
      if (existing) {
        setBatch(existing.batch || "Main Batch");
        setFee(existing.fee ? String(existing.fee) : "");
        setPaid(Boolean(existing.paid));
        setPartPayment(Boolean(existing.partPayment));
        setVenue(existing.venue === "TBA" ? "" : existing.venue || "");
      }
    } catch {
      // Use defaults if saved link settings are not readable.
    } finally {
      setLinkSettingsLoaded(true);
    }
  }, [shortSlug, workshop.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!linkSettingsLoaded) return;
    try {
      const raw = window.localStorage.getItem(REGISTRATION_LINK_CONFIG_STORAGE_KEY);
      const configs = raw ? JSON.parse(raw) as Record<string, RegistrationLinkConfig> : {};
      configs[shortSlug] = {
        batch: batch.trim() || "Main Batch",
        facilitator: workshop.facilitator || "CFL Facilitator",
        fee: paid ? Number(fee) || 0 : 0,
        id: workshop.id,
        paid,
        partPayment,
        slug: shortSlug,
        title: workshop.name,
        venue: venue.trim() || "TBA"
      };
      window.localStorage.setItem(REGISTRATION_LINK_CONFIG_STORAGE_KEY, JSON.stringify(configs));
      setSaveStatus("saved");
      const timeout = window.setTimeout(() => setSaveStatus("idle"), 1600);
      return () => window.clearTimeout(timeout);
    } catch {
      // The link still opens from Workshop Master fallback if storage is unavailable.
    }
  }, [batch, fee, linkSettingsLoaded, paid, partPayment, shortSlug, venue, workshop]);

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

          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div>
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
              {copyStatus === "failed" ? "Copy block thayu. Link select kari manual copy karo." : "Short link save thai gayi che. Open par click karo athva QR scan kari registration form kholo."}
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
  const lockedRole = Boolean(field.role);

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
        <div className="mt-2 sm:pl-11">
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            onChange={(event) => onChange({ options: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
            placeholder="One option per line"
            rows={3}
            value={(field.options ?? []).join("\n")}
          />
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
