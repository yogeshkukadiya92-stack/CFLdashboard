"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { AlertCircle, Check, ChevronDown, Copy, Download, Edit3, ExternalLink, Eye, HelpCircle, Link2, RefreshCw, Save, Search, Trash2, UsersRound, X } from "lucide-react";
import type { RegistrationEntry } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type WorkshopRecord = {
  id: string;
  name: string;
  type: string;
  facilitator: string;
  productGroup: string;
  isPaid: boolean;
  activeFields: string[];
};

const STORAGE_KEY = "cfl_workshop_master_records_v1";
const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const WORKSHOP_TYPES_STORAGE_KEY = "cfl_workshop_types_v1";
const FACILITATORS_STORAGE_KEY = "cfl_facilitators_v1";
const defaultWorkshopTypes = ["1-2-1 Coaching", "Workshop", "Online Event", "Offline Event", "Hybrid Program"];
const defaultFacilitators = ["Dr Luv Patel", "Amit Verma", "Neha Kapoor", "Arjun Sharma"];
const productGroups = ["Health", "Spiritual", "Leadership", "Sales", "Fitness", "Business Growth"];
const fields = [
  ["firstName", "First Name", true],
  ["lastName", "Last Name", true],
  ["mobile", "Mobile", true],
  ["email", "Email", true],
  ["country", "Country", true],
  ["state", "State", false],
  ["city", "City", false],
  ["address", "Address", false],
  ["age", "Age", false],
  ["gender", "Gender", false],
  ["occupation", "Occupation", false],
  ["firstTime", "First Time", false],
  ["source", "Lead Source", false],
  ["referral", "Referral", false],
  ["businessInfo", "Business Info", false],
  ["notes", "Notes", false]
] as const;
const defaultFields = fields.filter((field) => field[2]).map((field) => field[0]);
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export default function WorkshopMasterPage() {
  const [showData, setShowData] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [group, setGroup] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [activeFields, setActiveFields] = useState<string[]>([...defaultFields]);
  const [records, setRecords] = useState<WorkshopRecord[]>([]);
  const [workshopTypes, setWorkshopTypes] = useState<string[]>(defaultWorkshopTypes);
  const [facilitators, setFacilitators] = useState<string[]>(defaultFacilitators);
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
    setActiveFields([...defaultFields]);
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
      saveRecords(records.map((record) => record.id === editingId ? { ...record, name, type, facilitator, productGroup: group, isPaid, activeFields } : record));
      setMessage("Workshop updated successfully.");
    } else {
      saveRecords([{ id: generateId(), name, type, facilitator, productGroup: group, isPaid, activeFields }, ...records]);
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
    setActiveFields(record.activeFields);
    setEditingId(record.id);
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
    if (selectedWorkshopId === id) setSelectedWorkshopId(null);
    setMessage("Workshop deleted.");
  }

  function exportCsv() {
    const headers = ["Workshop", "Type", "Facilitator", "Product Group", "Paid", "Active Fields"];
    const rows = filteredRecords.map((record) => [
      record.name,
      record.type,
      record.facilitator,
      record.productGroup,
      record.isPaid ? "Paid" : "Free",
      record.activeFields.length
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

        <div className="my-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-200" />
          <p className="whitespace-nowrap text-sm font-black text-slate-700">Registration Form Settings</p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {fields.map(([key, label, required]) => {
            const checked = activeFields.includes(key);
            return (
              <button
                className={`group flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition ${checked ? "border-indigo-200 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
                key={key}
                onClick={() => {
                  if (!required) setActiveFields((current) => checked ? current.filter((item) => item !== key) : [...current, key]);
                }}
                type="button"
              >
                <span className="flex items-center gap-3">
                  <span className={`grid size-6 place-items-center rounded-md ${checked ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{checked ? <Check className="size-4" /> : null}</span>
                  <span>
                    <span className="block text-sm font-black text-slate-900">{label}</span>
                    {required ? <span className="text-xs font-bold text-indigo-600">Required</span> : null}
                  </span>
                </span>
                <HelpCircle className="size-4 text-slate-400" />
              </button>
            );
          })}
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
                <tr>{["Action", "Workshop", "Type", "Facilitator", "Group", "Paid", "Fields"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length ? filteredRecords.map((record) => (
                  <tr className="hover:bg-indigo-50/40" key={record.id}>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setLinkWorkshop(record)} title="Registration link" type="button">
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
                    <td className="px-4 py-4">{record.activeFields.length}</td>
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
  const [fee, setFee] = useState("");
  const [partPayment, setPartPayment] = useState(false);
  const [batch, setBatch] = useState("Main Batch");
  const [venue, setVenue] = useState("");
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    if (typeof window === "undefined") return "";
    const slug = workshopSlug(workshop.name) || workshop.id;
    const params = new URLSearchParams();
    params.set("wid", workshop.id);
    params.set("title", workshop.name);
    if (workshop.facilitator) params.set("facilitator", workshop.facilitator);
    if (batch.trim()) params.set("batch", batch.trim());
    if (venue.trim()) params.set("venue", venue.trim());
    if (paid) {
      params.set("paid", "1");
      params.set("fee", String(Number(fee) || 0));
      params.set("part", partPayment ? "1" : "0");
    } else {
      params.set("paid", "0");
    }
    return `${window.location.origin}/register/${slug}?${params.toString()}`;
  }, [batch, fee, paid, partPayment, venue, workshop]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Registration Link</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{workshop.name}</h3>
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

          <div>
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
            <p className="mt-2 text-xs font-semibold text-slate-400">
              Aa link koi pan device par khule che. Mobile number nakhse ane e tamaro saved client hoy to details auto bharai jashe (e for same-device data).
            </p>
          </div>
        </div>
      </div>
    </div>
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
