"use client";

import {
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  HelpCircle,
  Home,
  Layers3,
  LayoutDashboard,
  Menu,
  PanelLeft,
  RefreshCw,
  Save,
  Settings,
  TableProperties,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type WorkshopRecord = {
  id: string;
  name: string;
  type: string;
  facilitator: string;
  productGroup: string;
  isPaid: boolean;
  activeFields: string[];
  createdAt: string;
};

type ConfigField = {
  key: string;
  label: string;
  hint: string;
  required?: boolean;
};

const STORAGE_KEY = "cfl_workshop_master_records_v1";

const workshopTypes = ["1-2-1 Coaching", "Workshop", "Online Event", "Offline Event", "Hybrid Program"];
const facilitators = ["Dr Luv Patel", "Amit Verma", "Neha Kapoor", "Arjun Sharma"];
const productGroups = ["Health", "Spiritual", "Leadership", "Sales", "Fitness", "Business Growth"];

const navItems: Array<{ label: string; icon: LucideIcon; active?: boolean; href?: string }> = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Masters", icon: Layers3, active: true },
  { label: "Reports", icon: TableProperties },
  { label: "Settings", icon: Settings }
];

const fieldOptions: ConfigField[] = [
  { key: "firstName", label: "First Name", hint: "Primary first name field for registration.", required: true },
  { key: "lastName", label: "Last Name", hint: "Last name field for cleaner certificates.", required: true },
  { key: "mobile", label: "Mobile", hint: "Unique customer identity and OTP contact.", required: true },
  { key: "email", label: "Email", hint: "Confirmation, receipts, and reminders.", required: true },
  { key: "country", label: "Country", hint: "Useful for region-wise reports.", required: true },
  { key: "state", label: "State", hint: "State-level filtering and campaigns." },
  { key: "city", label: "City", hint: "City-wise follow-up and analytics." },
  { key: "address", label: "Address", hint: "Enable when full address is required." },
  { key: "age", label: "Age", hint: "Audience demographic segmentation." },
  { key: "gender", label: "Gender", hint: "Optional audience analytics field." },
  { key: "occupation", label: "Occupation", hint: "Profession-based segmentation." },
  { key: "firstTime", label: "First Time", hint: "Tracks new versus returning members." },
  { key: "source", label: "Lead Source", hint: "Ad, referral, organic, or partner source." },
  { key: "referral", label: "Referral", hint: "Capture referral person or code." },
  { key: "businessInfo", label: "Business Info", hint: "Useful for coaching and consulting programs." },
  { key: "notes", label: "Notes", hint: "Internal notes for admin context." }
];

const defaultActiveFields = fieldOptions
  .filter((field) => field.required)
  .map((field) => field.key);

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export default function WorkshopMasterPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showData, setShowData] = useState(false);
  const [workshopName, setWorkshopName] = useState("");
  const [workshopType, setWorkshopType] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [productGroup, setProductGroup] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [activeFields, setActiveFields] = useState<string[]>(defaultActiveFields);
  const [records, setRecords] = useState<WorkshopRecord[]>([]);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      setRecords(JSON.parse(raw) as WorkshopRecord[]);
    } catch {
      setRecords([]);
    }
  }, []);

  const enabledCount = activeFields.length;

  const completion = useMemo(() => {
    const required = [workshopName, workshopType, facilitator, productGroup];
    const filled = required.filter((value) => value.trim()).length;
    return Math.round((filled / required.length) * 100);
  }, [facilitator, productGroup, workshopName, workshopType]);

  function persist(nextRecords: WorkshopRecord[]) {
    setRecords(nextRecords);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  }

  function toggleField(key: string) {
    const option = fieldOptions.find((field) => field.key === key);
    if (option?.required) return;

    setActiveFields((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function clearForm() {
    setWorkshopName("");
    setWorkshopType("");
    setFacilitator("");
    setProductGroup("");
    setIsPaid(false);
    setActiveFields(defaultActiveFields);
    setError("");
    setSavedMessage("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedMessage("");

    if (!workshopName.trim() || !workshopType || !facilitator || !productGroup) {
      setError("Please complete Workshop Name, Type, Facilitator, and Product Group.");
      return;
    }

    const record: WorkshopRecord = {
      id: crypto.randomUUID(),
      name: workshopName.trim(),
      type: workshopType,
      facilitator,
      productGroup,
      isPaid,
      activeFields,
      createdAt: new Date().toISOString()
    };

    persist([record, ...records]);
    setError("");
    setSavedMessage("Workshop configuration saved.");
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="Toggle sidebar"
              className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => setSidebarOpen((open) => !open)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Masters</p>
              <h1 className="text-lg font-bold text-slate-950">Workshop Management</h1>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <p className="text-xs text-slate-500">Welcome</p>
            <p className="text-sm font-semibold text-slate-900">Admin User</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 lg:grid-cols-[280px_1fr] lg:px-6">
        <aside className={`${sidebarOpen ? "block" : "hidden"} rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:block`}>
          <div className="mb-3 rounded-xl bg-slate-950 p-4 text-white">
            <p className="text-xs font-medium text-indigo-200">Admin Navigation</p>
            <p className="mt-1 text-base font-semibold">Control Center</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                  {item.active ? <Check className="ml-auto size-4 text-indigo-600" /> : null}
                </>
              );

              if (item.href) {
                return (
                  <a
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                      item.active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                    href={item.href}
                    key={item.label}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                    item.active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  key={item.label}
                  type="button"
                >
                  {content}
                </button>
              );
            })}
          </nav>

          <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-sm font-semibold text-indigo-950">Active form fields</p>
            <div className="mt-3 h-2 rounded-full bg-white">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(enabledCount / fieldOptions.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-indigo-700">
              {enabledCount} of {fieldOptions.length} registration fields enabled.
            </p>
          </div>
        </aside>

        <section className="space-y-4">
          <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6" onSubmit={handleSubmit}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">Workshop Master</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Manage Workshop</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  onClick={() => setShowData((value) => !value)}
                  type="button"
                >
                  <Eye className="size-4" />
                  {showData ? "Hide Data" : "View Data"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric icon={PanelLeft} label="Form Progress" tone="indigo" value={`${completion}%`} />
              <Metric icon={TableProperties} label="Saved Workshops" tone="emerald" value={String(records.length)} />
              <Metric icon={UsersRound} label="Active Fields" tone="cyan" value={String(enabledCount)} />
              <Metric icon={Layers3} label="Payment Mode" tone="violet" value={isPaid ? "Paid" : "Free"} />
            </div>

            {error ? (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                <AlertCircle className="size-4" />
                {error}
              </div>
            ) : null}

            {savedMessage ? (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                <Check className="size-4" />
                {savedMessage}
              </div>
            ) : null}

            <div className="mt-6">
              <label className="mb-2 block text-sm font-semibold text-slate-600" htmlFor="workshopName">
                Workshop/Product Name
              </label>
              <input
                className={inputClass}
                id="workshopName"
                onChange={(event) => setWorkshopName(event.target.value)}
                placeholder="Enter workshop or product name"
                value={workshopName}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <SelectField label="Workshop Type" onChange={setWorkshopType} options={workshopTypes} value={workshopType} />
              <SelectField label="Default Facilitator" onChange={setFacilitator} options={facilitators} value={facilitator} />
              <SelectField label="Product Group" onChange={setProductGroup} options={productGroups} value={productGroup} />
              <label className="flex min-h-[74px] items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                <input
                  checked={isPaid}
                  className="size-5 accent-indigo-600"
                  onChange={(event) => setIsPaid(event.target.checked)}
                  type="checkbox"
                />
                Is Paid?
              </label>
            </div>

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <p className="whitespace-nowrap text-sm font-bold text-slate-700">Registration Form Settings</p>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {fieldOptions.map((field) => {
                const checked = activeFields.includes(field.key);
                return (
                  <button
                    className={`group flex min-h-[72px] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      checked
                        ? "border-indigo-200 bg-indigo-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    key={field.key}
                    onClick={() => toggleField(field.key)}
                    type="button"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-md border text-white ${
                          checked ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked ? <Check className="size-4" /> : null}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{field.label}</span>
                        {field.required ? <span className="text-xs font-medium text-indigo-600">Required</span> : null}
                      </span>
                    </span>
                    <span className="relative">
                      <HelpCircle className="size-4 text-slate-400" />
                      <span className="pointer-events-none absolute right-0 top-6 z-10 w-56 rounded-lg bg-slate-950 px-3 py-2 text-xs text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                        {field.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={clearForm}
                type="button"
              >
                <RefreshCw className="size-4" />
                Clear
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                type="submit"
              >
                <Save className="size-4" />
                Save
              </button>
            </div>
          </form>

          {showData ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Workshop List</h3>
                  <p className="text-sm text-slate-500">Saved locally for this admin workspace.</p>
                </div>
                <button
                  className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                  onClick={() => setShowData(false)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Workshop</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Facilitator</th>
                      <th className="px-4 py-3">Group</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Fields</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.length ? (
                      records.map((record) => (
                        <tr className="hover:bg-slate-50" key={record.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{record.name}</td>
                          <td className="px-4 py-3 text-slate-600">{record.type}</td>
                          <td className="px-4 py-3 text-slate-600">{record.facilitator}</td>
                          <td className="px-4 py-3 text-slate-600">{record.productGroup}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${record.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {record.isPaid ? "Paid" : "Free"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{record.activeFields.length}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                          No workshop records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>
      <span className="relative block">
        <select className={`${inputClass} appearance-none pr-10`} onChange={(event) => onChange(event.target.value)} value={value}>
          <option value="">Select {label}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

function Metric({ icon: Icon, label, tone, value }: { icon: LucideIcon; label: string; tone: "indigo" | "emerald" | "cyan" | "violet"; value: string }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    cyan: "bg-cyan-50 text-cyan-700",
    violet: "bg-violet-50 text-violet-700"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className={`grid size-11 place-items-center rounded-2xl ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xl font-black leading-none text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
