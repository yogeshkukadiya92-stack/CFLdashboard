"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { AlertCircle, Check, ChevronDown, Eye, HelpCircle, RefreshCw, Save } from "lucide-react";
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
const workshopTypes = ["1-2-1 Coaching", "Workshop", "Online Event", "Offline Event", "Hybrid Program"];
const facilitators = ["Dr Luv Patel", "Amit Verma", "Neha Kapoor", "Arjun Sharma"];
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) setRecords(JSON.parse(raw) as WorkshopRecord[]);
  }, []);

  const progress = useMemo(() => Math.round(([name, type, facilitator, group].filter(Boolean).length / 4) * 100), [facilitator, group, name, type]);

  function saveRecords(next: WorkshopRecord[]) {
    setRecords(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function clearForm() {
    setName("");
    setType("");
    setFacilitator("");
    setGroup("");
    setIsPaid(false);
    setActiveFields([...defaultFields]);
    setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !type || !facilitator || !group) {
      setMessage("Please fill Workshop Name, Type, Facilitator and Product Group.");
      return;
    }
    saveRecords([{ id: crypto.randomUUID(), name, type, facilitator, productGroup: group, isPaid, activeFields }, ...records]);
    setMessage("Workshop saved successfully.");
  }

  return (
    <AdminPlatformShell activeLabel="Workshop Master" description="Create workshop/product masters and configure registration fields in one platform." title="Manage Workshop">
      <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" onSubmit={submit}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">Form completion</p>
            <p className="text-3xl font-black text-slate-950">{progress}%</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50" onClick={() => setShowData((value) => !value)} type="button">
            <Eye className="size-4" />
            {showData ? "Hide Data" : "View Data"}
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
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={clearForm} type="button">
            <RefreshCw className="size-4" />
            Clear
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" type="submit">
            <Save className="size-4" />
            Save
          </button>
        </div>
      </form>

      {showData ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-slate-950">Workshop List</h3>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{["Workshop", "Type", "Facilitator", "Group", "Paid", "Fields"].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.length ? records.map((record) => (
                  <tr className="hover:bg-indigo-50/40" key={record.id}>
                    <td className="px-4 py-4 font-bold">{record.name}</td>
                    <td className="px-4 py-4">{record.type}</td>
                    <td className="px-4 py-4">{record.facilitator}</td>
                    <td className="px-4 py-4">{record.productGroup}</td>
                    <td className="px-4 py-4">{record.isPaid ? "Paid" : "Free"}</td>
                    <td className="px-4 py-4">{record.activeFields.length}</td>
                  </tr>
                )) : <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No workshop records yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminPlatformShell>
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
