"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { processPageConfigs, type ProcessField } from "@/lib/process-pages";
import { generateId } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Link2,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const WORKSHOP_MASTER_STORAGE_KEY = "cfl_workshop_master_records_v1";
const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const CLIENTS_STORAGE_KEY = "cfl_clients_v1";

type WorkshopMasterRecord = {
  id: string;
  name: string;
  type: string;
  facilitator: string;
  productGroup: string;
  isPaid: boolean;
  activeFields: string[];
};

type ClientStorageRecord = {
  city?: string;
  email?: string;
  id: number | string;
  mobile?: string;
  name?: string;
};

type ManualRegistrationEntry = {
  amountDue: number;
  amountPaid: number;
  city: string;
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  mobile: string;
  paymentMode: "Full" | "Part";
  status: "Paid" | "Due";
  workshopId: string;
  workshopSlug: string;
  workshopTitle: string;
};

function readLocalStorageArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    return [];
  }
}

export function ProcessModulePage({ slug }: { slug: string }) {
  if (slug === "client-batch-transfer") {
    return <ClientBatchTransferWorkflow />;
  }

  if (slug === "refund") {
    return <RefundWorkflow />;
  }

  if (slug === "import-data-workshop-wise") {
    return <ImportWorkshopDataWorkflow />;
  }

  if (slug === "merge-client") {
    return <MergeClientWorkflow />;
  }

  if (slug === "manual-client-registration") {
    return <ManualClientRegistrationWorkflow />;
  }

  if (slug === "apply-coupon") {
    return <ApplyCouponWorkflow />;
  }

  if (slug === "re-check-failed-payment") {
    return <ReCheckFailedPaymentWorkflow />;
  }

  if (slug === "manual-client-part-payment") {
    return <ManualClientPartPaymentWorkflow />;
  }

  const config = processPageConfigs[slug];
  const initialForm = useMemo(
    () => Object.fromEntries(config.fields.map((field) => [field.key, ""])) as Record<string, string>,
    [config.fields]
  );
  const [form, setForm] = useState<Record<string, string>>(initialForm);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [error, setError] = useState("");
  const [showData, setShowData] = useState(false);

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function clear() {
    setForm(initialForm);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = config.fields.find((field) => field.required && !form[field.key]);
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    setRows((current) => [{ ...form, id: generateId(), status: "Done", createdAt: new Date().toLocaleString() }, ...current]);
    setShowData(true);
    setError("");
    setForm(initialForm);
  }

  return (
    <AdminPlatformShell activeLabel={config.title} description={config.description} title={config.title}>
      <form className="space-y-4" onSubmit={submit}>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-500">Process Workflow</p>
              <h3 className="mt-1 text-2xl font-black text-slate-950">{config.title}</h3>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50"
              onClick={() => setShowData((value) => !value)}
              type="button"
            >
              <Eye className="size-4" />
              {showData ? "Hide Data" : "View Data"}
            </button>
          </div>

          {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {config.fields.map((field) => (
              <ProcessInput field={field} key={field.key} onChange={(value) => update(field.key, value)} value={form[field.key] ?? ""} />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              onClick={clear}
              type="button"
            >
              <RefreshCw className="size-4" />
              Clear
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" type="submit">
              <Save className="size-4" />
              {config.actionLabel}
            </button>
          </div>
        </section>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Records" value={String(rows.length)} />
        <Metric label="Required Fields" value={String(config.fields.filter((field) => field.required).length)} />
        <Metric label="Workflow Status" value="Ready" />
      </section>

      {showData ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950">{config.title} Data</h3>
              <p className="text-sm font-semibold text-slate-500">Latest process entries for this workflow.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">
              <Download className="size-4" />
              Export
            </button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {config.tableColumns.map((column) => (
                    <th className="px-4 py-3" key={column}>
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length ? (
                  rows.map((row) => (
                    <tr className="hover:bg-indigo-50/40" key={row.id}>
                      {config.tableColumns.map((column, index) => (
                        <td className="px-4 py-4 font-semibold text-slate-700" key={column}>
                          {index === 3 ? row.status : Object.values(row).filter((value) => value !== row.id && value !== row.status)[index] || "-"}
                        </td>
                      ))}
                      <td className="px-4 py-4">
                        <button
                          className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                          onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={config.tableColumns.length + 1}>
                      No Data Added
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminPlatformShell>
  );
}

// ---------------------------------------------------------------------------
// Apply Coupon Workflow
// ---------------------------------------------------------------------------

const COUPONS_STORAGE_KEY = "cfl_coupons_v1";

type CouponRecord = {
  id: string;
  clientName: string;
  clientId: string;
  workshopId: string;
  workshopName: string;
  couponCode: string;
  discount: number;
  appliedAt: string;
};

function ApplyCouponWorkflow() {
  const [clients, setClients] = useState<ClientStorageRecord[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopMasterRecord[]>([]);
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);

  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientStorageRecord | null>(null);
  const [showClientList, setShowClientList] = useState(false);
  const clientBoxRef = useRef<HTMLDivElement>(null);

  const [workshopId, setWorkshopId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setClients(readLocalStorageArray<ClientStorageRecord>(CLIENTS_STORAGE_KEY).filter((c) => (c.name ?? "").trim()));
    setWorkshops(readLocalStorageArray<WorkshopMasterRecord>(WORKSHOP_MASTER_STORAGE_KEY));
    setCoupons(readLocalStorageArray<CouponRecord>(COUPONS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (clientBoxRef.current && !clientBoxRef.current.contains(event.target as Node)) {
        setShowClientList(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    const list = q
      ? clients.filter((c) => `${c.name ?? ""} ${c.mobile ?? ""}`.toLowerCase().includes(q))
      : clients;
    return list.slice(0, 8);
  }, [clients, clientQuery]);

  function applyCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedClient) { setError("Please select a client."); return; }
    if (!workshopId) { setError("Please select a workshop."); return; }
    if (!couponCode.trim()) { setError("Please enter a coupon code."); return; }
    const disc = Number(discountAmount);
    if (!disc || disc <= 0) { setError("Please enter a valid discount amount."); return; }

    const selectedWorkshop = workshops.find((w) => w.id === workshopId);
    if (!selectedWorkshop) { setError("Workshop not found."); return; }

    // Find registration
    const regs = readLocalStorageArray<ManualRegistrationEntry>(REGISTRATION_STORAGE_KEY);
    const regIndex = regs.findIndex(
      (r) => r.workshopId === workshopId && (r.fullName === selectedClient.name || r.mobile?.replace(/\D/g, "") === (selectedClient.mobile ?? "").replace(/\D/g, ""))
    );

    if (regIndex < 0) {
      setError(`No registration found for ${selectedClient.name} in ${selectedWorkshop.name}.`);
      return;
    }

    const reg = regs[regIndex];
    const newDue = Math.max(0, (reg.amountDue ?? 0) - disc);
    const updatedReg = {
      ...reg,
      amountDue: newDue,
      status: newDue === 0 ? "Paid" as const : reg.status,
    };
    regs[regIndex] = updatedReg;
    window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(regs));

    const coupon: CouponRecord = {
      id: generateId(),
      clientName: selectedClient.name ?? "",
      clientId: String(selectedClient.id),
      workshopId,
      workshopName: selectedWorkshop.name,
      couponCode: couponCode.trim(),
      discount: disc,
      appliedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    const nextCoupons = [coupon, ...coupons];
    setCoupons(nextCoupons);
    window.localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(nextCoupons));

    setSuccess(`Coupon "${couponCode.trim()}" applied. Discount: ₹${disc}. New amount due: ₹${newDue}.`);
    setCouponCode("");
    setDiscountAmount("");
  }

  function deleteCoupon(id: string) {
    const next = coupons.filter((c) => c.id !== id);
    setCoupons(next);
    window.localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <AdminPlatformShell activeLabel="Apply Coupon" description="Apply coupon codes to client workshop registrations and track discount history." title="Apply Coupon">
      <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" onSubmit={applyCoupon}>
        <div>
          <p className="text-sm font-bold text-slate-500">Coupon Management</p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">Apply Coupon</h3>
        </div>

        {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
        {success ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Client search combobox */}
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Search Client</span>
            <span className="relative block" ref={clientBoxRef}>
              <input
                autoComplete="off"
                className={inputClass}
                onChange={(e) => { setClientQuery(e.target.value); setSelectedClient(null); setShowClientList(true); }}
                onFocus={() => setShowClientList(true)}
                placeholder="Search by name or mobile"
                value={clientQuery}
              />
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              {showClientList && clientMatches.length ? (
                <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  {clientMatches.map((c) => (
                    <button
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-indigo-50"
                      key={c.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedClient(c);
                        setClientQuery(`${c.name ?? ""} - ${c.mobile ?? ""}`);
                        setShowClientList(false);
                      }}
                      type="button"
                    >
                      <span>
                        <span className="block text-sm font-bold text-slate-900">{c.name}</span>
                        <span className="block text-xs text-slate-500">{c.mobile ?? ""}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </span>
          </label>

          {/* Workshop select */}
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Select Workshop</span>
            <select className={inputClass} onChange={(e) => setWorkshopId(e.target.value)} value={workshopId}>
              <option value="">SELECT WORKSHOP</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Coupon Code</span>
            <input className={inputClass} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter coupon code" value={couponCode} />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Discount Amount (₹)</span>
            <input className={inputClass} min="0" onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0" type="number" value={discountAmount} />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" type="submit">
            <Save className="size-4" />
            Apply Coupon
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => { setClientQuery(""); setSelectedClient(null); setWorkshopId(""); setCouponCode(""); setDiscountAmount(""); setError(""); setSuccess(""); }}
            type="button"
          >
            <RefreshCw className="size-4" />
            Clear
          </button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Total Coupons Applied" value={String(coupons.length)} />
        <Metric label="Total Discount Given" value={`₹${coupons.reduce((s, c) => s + c.discount, 0).toLocaleString("en-IN")}`} />
        <Metric label="Workflow Status" value="Ready" />
      </section>

      {coupons.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-black text-slate-950">Applied Coupons</h3>
          <p className="text-sm font-semibold text-slate-500">History of all coupon discounts applied.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Client", "Workshop", "Coupon Code", "Discount", "Applied At", "Action"].map((h) => (
                    <th className="px-4 py-3" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => (
                  <tr className="hover:bg-indigo-50/40" key={c.id}>
                    <td className="px-4 py-4 font-bold text-slate-900">{c.clientName}</td>
                    <td className="px-4 py-4 text-slate-700">{c.workshopName}</td>
                    <td className="px-4 py-4 font-mono text-slate-700">{c.couponCode}</td>
                    <td className="px-4 py-4 font-black text-slate-950">₹{c.discount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4 text-slate-700">{c.appliedAt}</td>
                    <td className="px-4 py-4">
                      <button className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100" onClick={() => deleteCoupon(c.id)} type="button">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminPlatformShell>
  );
}

// ---------------------------------------------------------------------------
// Re-Check Failed Payment Workflow
// ---------------------------------------------------------------------------

function ReCheckFailedPaymentWorkflow() {
  const [registrations, setRegistrations] = useState<ManualRegistrationEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [success, setSuccess] = useState("");

  function loadData() {
    const all = readLocalStorageArray<ManualRegistrationEntry>(REGISTRATION_STORAGE_KEY);
    setRegistrations(all.filter((r) => r.status === "Due"));
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((r) =>
      `${r.fullName} ${r.mobile} ${r.workshopTitle}`.toLowerCase().includes(q)
    );
  }, [registrations, searchTerm]);

  function markAsPaid(regId: string) {
    const all = readLocalStorageArray<ManualRegistrationEntry>(REGISTRATION_STORAGE_KEY);
    const idx = all.findIndex((r) => r.id === regId);
    if (idx < 0) return;
    const reg = all[idx];
    all[idx] = {
      ...reg,
      amountPaid: (reg.amountPaid ?? 0) + (reg.amountDue ?? 0),
      amountDue: 0,
      status: "Paid",
    };
    window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(all));
    setSuccess(`${reg.fullName} marked as Paid for ${reg.workshopTitle}.`);
    loadData();
  }

  return (
    <AdminPlatformShell
      activeLabel="Re-Check Failed Payment"
      description="Review registrations with pending payments and mark them as paid after verification."
      title="Re-Check Failed Payment"
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">Payment Verification</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">Re-Check Failed Payments</h3>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
            onClick={() => { loadData(); setSuccess("Data reloaded from storage."); }}
            type="button"
          >
            <RefreshCw className="size-4" />
            Re-check
          </button>
        </div>

        {success ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}

        <div className="mt-5">
          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by client name, mobile, or workshop..."
              value={searchTerm}
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Pending Payments" value={String(registrations.length)} />
        <Metric label="Total Amount Due" value={`₹${registrations.reduce((s, r) => s + (r.amountDue ?? 0), 0).toLocaleString("en-IN")}`} />
        <Metric label="Filtered Results" value={String(filtered.length)} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h3 className="text-xl font-black text-slate-950">Due Registrations</h3>
        <p className="text-sm font-semibold text-slate-500">All registrations with outstanding payment.</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Client", "Mobile", "Workshop", "Amount Due", "Registration Date", "Action"].map((h) => (
                  <th className="px-4 py-3" key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length ? (
                filtered.map((r) => (
                  <tr className="hover:bg-indigo-50/40" key={r.id}>
                    <td className="px-4 py-4 font-bold text-slate-900">{r.fullName}</td>
                    <td className="px-4 py-4 text-slate-700">{r.mobile}</td>
                    <td className="px-4 py-4 text-slate-700">{r.workshopTitle}</td>
                    <td className="px-4 py-4 font-black text-slate-950">₹{(r.amountDue ?? 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4 text-slate-700">{r.createdAt}</td>
                    <td className="px-4 py-4">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                        onClick={() => markAsPaid(r.id)}
                        type="button"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Mark as Paid
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                    No pending payment registrations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPlatformShell>
  );
}

// ---------------------------------------------------------------------------
// Manual Client Part Payment Workflow
// ---------------------------------------------------------------------------

const PART_PAYMENTS_STORAGE_KEY = "cfl_part_payments_v1";

type PartPaymentRecord = {
  id: string;
  clientName: string;
  registrationId: string;
  workshopTitle: string;
  amount: number;
  previousDue: number;
  newDue: number;
  date: string;
};

function ManualClientPartPaymentWorkflow() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dueRegistrations, setDueRegistrations] = useState<ManualRegistrationEntry[]>([]);
  const [selectedReg, setSelectedReg] = useState<ManualRegistrationEntry | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payments, setPayments] = useState<PartPaymentRecord[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const all = readLocalStorageArray<ManualRegistrationEntry>(REGISTRATION_STORAGE_KEY);
    setDueRegistrations(all.filter((r) => (r.amountDue ?? 0) > 0));
    setPayments(readLocalStorageArray<PartPaymentRecord>(PART_PAYMENTS_STORAGE_KEY));
  }, []);

  const matchedRegs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return dueRegistrations.slice(0, 10);
    return dueRegistrations
      .filter((r) => `${r.fullName} ${r.mobile} ${r.workshopTitle}`.toLowerCase().includes(q))
      .slice(0, 10);
  }, [dueRegistrations, searchTerm]);

  function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedReg) { setError("Please select a registration."); return; }
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) { setError("Please enter a valid payment amount."); return; }
    if (amt > (selectedReg.amountDue ?? 0)) { setError(`Payment amount cannot exceed amount due (₹${selectedReg.amountDue}).`); return; }

    const all = readLocalStorageArray<ManualRegistrationEntry>(REGISTRATION_STORAGE_KEY);
    const idx = all.findIndex((r) => r.id === selectedReg.id);
    if (idx < 0) { setError("Registration not found in storage."); return; }

    const previousDue = all[idx].amountDue ?? 0;
    const newDue = previousDue - amt;
    all[idx] = {
      ...all[idx],
      amountPaid: (all[idx].amountPaid ?? 0) + amt,
      amountDue: newDue,
      paymentMode: "Part",
      status: newDue === 0 ? "Paid" : all[idx].status,
    };
    window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(all));

    const payment: PartPaymentRecord = {
      id: generateId(),
      clientName: selectedReg.fullName,
      registrationId: selectedReg.id,
      workshopTitle: selectedReg.workshopTitle,
      amount: amt,
      previousDue,
      newDue,
      date: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    const nextPayments = [payment, ...payments];
    setPayments(nextPayments);
    window.localStorage.setItem(PART_PAYMENTS_STORAGE_KEY, JSON.stringify(nextPayments));

    // Refresh due registrations
    setDueRegistrations(all.filter((r) => (r.amountDue ?? 0) > 0));
    setSelectedReg(null);
    setPaymentAmount("");
    setSuccess(`Part payment of ₹${amt} recorded for ${selectedReg.fullName}. New due: ₹${newDue}.`);
  }

  function deletePayment(id: string) {
    const next = payments.filter((p) => p.id !== id);
    setPayments(next);
    window.localStorage.setItem(PART_PAYMENTS_STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <AdminPlatformShell
      activeLabel="Manual Client Part Payment"
      description="Record part payments against client workshop registrations and track payment history."
      title="Manual Client Part Payment"
    >
      <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" onSubmit={savePayment}>
        <div>
          <p className="text-sm font-bold text-slate-500">Payment Management</p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">Manual Client Part Payment</h3>
        </div>

        {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
        {success ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-slate-600">Search Client (from registrations with amount due)</label>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              onChange={(e) => { setSearchTerm(e.target.value); setSelectedReg(null); }}
              placeholder="Search by client name, mobile, or workshop..."
              value={searchTerm}
            />
          </div>
        </div>

        {matchedRegs.length && !selectedReg ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Client", "Workshop", "Amount Due", ""].map((h) => (
                    <th className="px-4 py-3" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matchedRegs.map((r) => (
                  <tr className="hover:bg-indigo-50/40" key={r.id}>
                    <td className="px-4 py-3 font-bold text-slate-900">{r.fullName}</td>
                    <td className="px-4 py-3 text-slate-700">{r.workshopTitle}</td>
                    <td className="px-4 py-3 font-black text-slate-950">₹{(r.amountDue ?? 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                        onClick={() => setSelectedReg(r)}
                        type="button"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedReg ? (
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-slate-950">{selectedReg.fullName}</p>
                <p className="mt-1 font-semibold text-indigo-700">{selectedReg.workshopTitle} — Due: ₹{(selectedReg.amountDue ?? 0).toLocaleString("en-IN")}</p>
              </div>
              <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800" onClick={() => setSelectedReg(null)} type="button">Change</button>
            </div>
          </div>
        ) : null}

        {selectedReg ? (
          <div className="mt-5 max-w-xs">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Part Payment Amount (₹)</span>
              <input className={inputClass} max={selectedReg.amountDue ?? 0} min="1" onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" type="number" value={paymentAmount} />
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50" disabled={!selectedReg} type="submit">
            <Save className="size-4" />
            Save Payment
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => { setSearchTerm(""); setSelectedReg(null); setPaymentAmount(""); setError(""); setSuccess(""); }}
            type="button"
          >
            <RefreshCw className="size-4" />
            Clear
          </button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Total Part Payments" value={String(payments.length)} />
        <Metric label="Total Collected" value={`₹${payments.reduce((s, p) => s + p.amount, 0).toLocaleString("en-IN")}`} />
        <Metric label="Workflow Status" value="Ready" />
      </section>

      {payments.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-black text-slate-950">Payment History</h3>
          <p className="text-sm font-semibold text-slate-500">All recorded part payments.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Client", "Workshop", "Amount", "Previous Due", "New Due", "Date", "Action"].map((h) => (
                    <th className="px-4 py-3" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr className="hover:bg-indigo-50/40" key={p.id}>
                    <td className="px-4 py-4 font-bold text-slate-900">{p.clientName}</td>
                    <td className="px-4 py-4 text-slate-700">{p.workshopTitle}</td>
                    <td className="px-4 py-4 font-black text-emerald-700">₹{p.amount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4 text-slate-700">₹{p.previousDue.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4 font-black text-slate-950">₹{p.newDue.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4 text-slate-700">{p.date}</td>
                    <td className="px-4 py-4">
                      <button className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100" onClick={() => deletePayment(p.id)} type="button">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminPlatformShell>
  );
}

function ClientBatchTransferWorkflow() {
  const [clientSearch, setClientSearch] = useState("");
  const [sourceBatch, setSourceBatch] = useState("");
  const [destinationBatch, setDestinationBatch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [transfers, setTransfers] = useState<Array<{ client: string; from: string; id: string; remarks: string; status: string; to: string }>>([]);
  const [batches, setBatches] = useState<string[]>([]);

  useEffect(() => {
    const workshops = readLocalStorageArray<WorkshopMasterRecord>(WORKSHOP_MASTER_STORAGE_KEY);
    setBatches(workshops.map((item) => `${item.name} - Main Batch`));
  }, []);

  function clear() {
    setClientSearch("");
    setSourceBatch("");
    setDestinationBatch("");
    setRemarks("");
    setError("");
    setSuccess("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clientSearch || !sourceBatch || !destinationBatch) {
      setError("Client, current batch and transfer batch are required.");
      setSuccess("");
      return;
    }

    if (sourceBatch === destinationBatch) {
      setError("Transfer to batch must be different from current batch.");
      setSuccess("");
      return;
    }

    setTransfers((current) => [
      {
        client: clientSearch,
        from: sourceBatch,
        id: generateId(),
        remarks: remarks || "-",
        status: "Transferred",
        to: destinationBatch
      },
      ...current
    ]);
    setShowReport(true);
    setSuccess("Client batch transfer saved successfully.");
    setError("");
    setClientSearch("");
    setSourceBatch("");
    setDestinationBatch("");
    setRemarks("");
  }

  return (
    <AdminPlatformShell
      activeLabel="Client Batch Transfer"
      description="Move clients between workshop batches with validation, remarks and transfer reporting."
      title="Client Batch Transfer"
    >
      <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" onSubmit={save}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">Batch Management</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">Client Batch Transfer</h3>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
            onClick={() => setShowReport((value) => !value)}
            type="button"
          >
            <Eye className="size-4" />
            View Batch Transfer Report
          </button>
        </div>

        {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
        {success ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-slate-600" htmlFor="clientSearch">
            Search Client By Name or Mobile No
          </label>
          <input
            className={inputClass}
            id="clientSearch"
            onChange={(event) => setClientSearch(event.target.value)}
            placeholder="Search by Keyword"
            value={clientSearch}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Select Workshop Batch</span>
            <select className={inputClass} onChange={(event) => setSourceBatch(event.target.value)} value={sourceBatch}>
              <option value="">SELECT BATCH</option>
              {batches.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Transfer to Batch</span>
            <select className={inputClass} onChange={(event) => setDestinationBatch(event.target.value)} value={destinationBatch}>
              <option value="">SELECT BATCH</option>
              {batches.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-bold text-slate-600" htmlFor="remarks">
            Remarks
          </label>
          <textarea
            className={`${inputClass} min-h-[132px]`}
            id="remarks"
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Remarks"
            value={remarks}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700" type="submit">
            <Save className="size-4" />
            Save
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={clear}
            type="button"
          >
            <RefreshCw className="size-4" />
            Clear
          </button>
        </div>
      </form>

      {showReport ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950">Batch Transfer Report</h3>
              <p className="text-sm font-semibold text-slate-500">Recent transfer logs for manual batch movements.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" type="button">
              <Download className="size-4" />
              Export
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Client", "From Batch", "To Batch", "Remarks", "Status", "Action"].map((heading) => (
                    <th className="px-4 py-3" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.length ? (
                  transfers.map((transfer) => (
                    <tr className="hover:bg-indigo-50/40" key={transfer.id}>
                      <td className="px-4 py-4 font-bold text-slate-900">{transfer.client}</td>
                      <td className="px-4 py-4 text-slate-700">{transfer.from}</td>
                      <td className="px-4 py-4 text-slate-700">{transfer.to}</td>
                      <td className="px-4 py-4 text-slate-700">{transfer.remarks}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{transfer.status}</span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                          onClick={() => setTransfers((current) => current.filter((row) => row.id !== transfer.id))}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                      No transfer data added.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminPlatformShell>
  );
}

type RefundRow = {
  amount: number;
  batch: string;
  id: string;
  mobile: string;
  name: string;
  orderId: string;
  paymentId: string;
  regDate: string;
  status: "SUCCESS" | "REFUND";
  workshop: string;
};

const refundRowsSeed: RefundRow[] = [];

function RefundWorkflow() {
  const [rows, setRows] = useState(refundRowsSeed);
  const [fromDate, setFromDate] = useState("2026-04-20");
  const [toDate, setToDate] = useState("2026-04-30");
  const [status, setStatus] = useState<"ALL" | "REFUND" | "SUCCESS">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<keyof RefundRow>("regDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refundTarget, setRefundTarget] = useState<RefundRow | null>(null);

  const filteredRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return rows
      .filter((row) => status === "ALL" || row.status === status)
      .filter((row) => !fromDate || row.regDate >= fromDate)
      .filter((row) => !toDate || row.regDate <= toDate)
      .filter((row) => {
        if (!normalized) return true;
        return Object.values(row).some((value) => String(value).toLowerCase().includes(normalized));
      })
      .sort((a, b) => {
        const compare = String(a[sortKey]).localeCompare(String(b[sortKey]), undefined, { numeric: true });
        return sortDirection === "asc" ? compare : -compare;
      });
  }, [fromDate, rows, searchTerm, sortDirection, sortKey, status, toDate]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(start, start + pageSize);

  function search() {
    setLoading(true);
    setPage(1);
    window.setTimeout(() => setLoading(false), 450);
  }

  function changeSort(key: keyof RefundRow) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function issueRefund(row: RefundRow) {
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: "REFUND" } : item)));
    setRefundTarget(null);
  }

  return (
    <AdminPlatformShell
      activeLabel="Refund"
      description="View payment gateway transactions, filter by date/status and issue refunds from a controlled admin table."
      title="Manage User Refund"
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">From Date</span>
            <input className={inputClass} onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">To Date</span>
            <input className={inputClass} onChange={(event) => setToDate(event.target.value)} type="date" value={toDate} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Status</span>
            <select className={inputClass} onChange={(event) => setStatus(event.target.value as "ALL" | "REFUND" | "SUCCESS")} value={status}>
              <option value="ALL">ALL</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="REFUND">REFUND</option>
            </select>
          </label>
          <button
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700"
            onClick={search}
            type="button"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Search
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 md:p-6">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            Show
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
              value={pageSize}
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            entries
          </label>

          <label className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              onChange={(event) => {
                setPage(1);
                setSearchTerm(event.target.value);
              }}
              placeholder="Search name, payment id, order id..."
              value={searchTerm}
            />
          </label>
        </div>

        <div className="relative overflow-x-auto">
          {loading ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                <Loader2 className="size-4 animate-spin" />
                Loading payments
              </div>
            </div>
          ) : null}
          <table className="min-w-[1320px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  ["status", "Status"],
                  ["regDate", "Reg. Date"],
                  ["name", "Name"],
                  ["mobile", "Mobile No"],
                  ["amount", "Amount"],
                  ["workshop", "Workshop"],
                  ["batch", "Batch"],
                  ["paymentId", "Razorpay Payment ID"],
                  ["orderId", "Razorpay Order ID"]
                ].map(([key, label]) => (
                  <th className="px-4 py-4" key={key}>
                    <button className="inline-flex items-center gap-1 font-black hover:text-indigo-700" onClick={() => changeSort(key as keyof RefundRow)} type="button">
                      {label}
                      <span className="grid gap-0.5">
                        <ArrowUp className={`size-3 ${sortKey === key && sortDirection === "asc" ? "text-indigo-600" : "text-slate-300"}`} />
                        <ArrowDown className={`size-3 ${sortKey === key && sortDirection === "desc" ? "text-indigo-600" : "text-slate-300"}`} />
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length ? (
                pageRows.map((row) => (
                  <tr className="hover:bg-indigo-50/40" key={row.id}>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${
                            row.status === "SUCCESS" ? "bg-emerald-500 text-white" : "bg-indigo-100 text-indigo-700"
                          }`}
                        >
                          {row.status === "SUCCESS" ? "Success" : "Refunded"}
                        </span>
                        <button
                          className="block text-xs font-black text-indigo-600 hover:text-indigo-800 disabled:text-slate-400"
                          disabled={row.status === "REFUND"}
                          onClick={() => setRefundTarget(row)}
                          type="button"
                        >
                          Issue Refund
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{row.regDate}</td>
                    <td className="px-4 py-4 font-black text-slate-950">{row.name}</td>
                    <td className="px-4 py-4 text-slate-700">{row.mobile}</td>
                    <td className="px-4 py-4 font-black text-slate-950">₹{row.amount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4 text-slate-700">{row.workshop}</td>
                    <td className="px-4 py-4 text-slate-700">{row.batch}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-700">{row.paymentId}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-700">{row.orderId}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={9}>
                    No refund/payment records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-5 text-sm text-slate-600 md:p-6">
          <p>
            Showing {filteredRows.length ? start + 1 : 0} to {Math.min(start + pageSize, filteredRows.length)} of {filteredRows.length} entries
          </p>
          <div className="flex items-center gap-1">
            <RefundPageButton disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft className="size-4" />
              Previous
            </RefundPageButton>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <RefundPageButton active={safePage === pageNumber} key={pageNumber} onClick={() => setPage(pageNumber)}>
                {pageNumber}
              </RefundPageButton>
            ))}
            <RefundPageButton disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
              Next
              <ChevronRight className="size-4" />
            </RefundPageButton>
          </div>
        </div>
      </section>

      {refundTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-950">Confirm Refund</h3>
                <p className="mt-1 text-sm text-slate-500">Issue refund for this payment transaction?</p>
              </div>
              <button className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setRefundTarget(null)} type="button">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
              <p className="font-black text-slate-950">{refundTarget.name}</p>
              <p className="mt-1 text-slate-600">{refundTarget.paymentId}</p>
              <p className="mt-2 text-lg font-black text-slate-950">₹{refundTarget.amount.toLocaleString("en-IN")}</p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => setRefundTarget(null)} type="button">
                Cancel
              </button>
              <button className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700" onClick={() => issueRefund(refundTarget)} type="button">
                Issue Refund
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPlatformShell>
  );
}

function ImportWorkshopDataWorkflow() {
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);

  function downloadSample() {
    const headers = ["Workshop Name", "Client Name", "Mobile", "Email", "Batch", "Payment Status", "Amount"];
    const row = ["Sample Workshop", "Sample Client", "+91 00000 00000", "sample@example.com", "Sample Batch", "SUCCESS", "0"];
    const csv = [headers, row].map((items) => items.map((item) => `"${item}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "workshop-import-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function upload() {
    setSuccess("");
    if (!fileName) {
      setError("Please choose a CSV or Excel file before upload.");
      return;
    }

    setError("");
    setUploading(true);
    window.setTimeout(() => {
      setUploading(false);
      setSuccess(`${fileName} uploaded successfully. Data is ready for review.`);
    }, 700);
  }

  return (
    <AdminPlatformShell
      activeLabel="Import Data Workshop Wise"
      description="Bulk upload workshop-wise data using CSV or Excel templates."
      title="Import Data Workshop Wise"
    >
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">Bulk Import</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">Import Workshop Data</h3>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-[#00CFE8] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-500"
            onClick={downloadSample}
            type="button"
          >
            <Download className="size-4" />
            Download Sample
          </button>
        </div>

        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <label className="block">
            <span className="mb-3 block text-sm font-black text-slate-700">Choose File</span>
            <input
              accept=".csv,.xlsx,.xls"
              className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={(event) => {
                setFileName(event.target.files?.[0]?.name ?? "");
                setError("");
                setSuccess("");
              }}
              type="file"
            />
          </label>

          <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-600">
            Selected file: <span className="font-black text-slate-950">{fileName || "No file chosen"}</span>
          </div>

          {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
          {success ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}

          <button
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#4B4B4B] px-6 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={uploading}
            onClick={upload}
            type="button"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-5 text-center text-xs font-semibold text-slate-500">
          Copyright © 2026 CRM System. Maintained by Developer.
        </footer>
      </section>
    </AdminPlatformShell>
  );
}

type MergeClient = {
  city: string;
  id: string;
  mobile: string;
  name: string;
};

function MergeClientWorkflow() {
  const [clients, setClients] = useState<MergeClient[]>([]);
  const [retainQuery, setRetainQuery] = useState("");
  const [removeQuery, setRemoveQuery] = useState("");
  const [retainClient, setRetainClient] = useState<MergeClient | null>(null);
  const [removeClient, setRemoveClient] = useState<MergeClient | null>(null);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const stored = readLocalStorageArray<ClientStorageRecord>(CLIENTS_STORAGE_KEY);
    setClients(stored.map((client) => ({
      city: client.city || "",
      id: String(client.id),
      mobile: client.mobile || "",
      name: client.name || "Unnamed Client"
    })));
  }, []);

  const retainResults = filterMergeClients(clients, retainQuery, removeClient?.id);
  const removeResults = filterMergeClients(clients, removeQuery, retainClient?.id);

  function processMerge() {
    setSuccess("");
    if (!retainClient || !removeClient) {
      setError("Please select both clients before processing merge.");
      return;
    }

    if (retainClient.id === removeClient.id) {
      setError("Retain and remove client cannot be the same.");
      return;
    }

    setError("");
    setConfirmOpen(true);
  }

  function confirmMerge() {
    if (!retainClient || !removeClient) return;
    const stored = readLocalStorageArray<ClientStorageRecord>(CLIENTS_STORAGE_KEY);
    const nextStored = stored.filter((client) => String(client.id) !== removeClient.id);
    window.localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(nextStored));
    setClients((current) => current.filter((client) => client.id !== removeClient.id));
    setSuccess(`${removeClient.name} merged into ${retainClient.name}. Duplicate client removed from workflow.`);
    setRemoveClient(null);
    setRemoveQuery("");
    setConfirmOpen(false);
  }

  return (
    <AdminPlatformShell
      activeLabel="Merge Client"
      description="Deduplicate client records by retaining one profile and merging completed workshop data from another."
      title="Merge Client"
    >
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold text-gray-800">Merge Client</h3>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold text-white hover:bg-gray-900"
            onClick={processMerge}
            type="button"
          >
            <Link2 className="size-4" />
            Process Merge
          </button>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {success ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p> : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Select Client To Retain</h3>
          <ComboboxCard
            query={retainQuery}
            results={retainResults}
            selected={retainClient}
            setQuery={setRetainQuery}
            setSelected={(client) => {
              setRetainClient(client);
              setRetainQuery(client ? `${client.name} - ${client.mobile}` : "");
            }}
          />
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800">Select Client To Merge and Remove</h3>
          <p className="mb-4 mt-1 text-sm italic text-red-500">
            [ Note : Only Completed Workshop Data will be merge and client will be removed from system ]
          </p>
          <ComboboxCard
            query={removeQuery}
            results={removeResults}
            selected={removeClient}
            setQuery={setRemoveQuery}
            setSelected={(client) => {
              setRemoveClient(client);
              setRemoveQuery(client ? `${client.name} - ${client.mobile}` : "");
            }}
          />
        </div>
      </section>

      <footer className="rounded-2xl bg-white p-4 text-center text-xs font-semibold text-slate-500 shadow-sm">
        Copyright © 2026 CRM System. Maintained by Developer.
      </footer>

      {confirmOpen && retainClient && removeClient ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-950">Are you sure?</h3>
                <p className="mt-1 text-sm text-slate-500">This will merge completed workshop data and remove duplicate client profile.</p>
              </div>
              <button className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setConfirmOpen(false)} type="button">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <p><span className="font-bold text-slate-500">Retain:</span> <span className="font-black text-slate-950">{retainClient.name}</span></p>
              <p><span className="font-bold text-slate-500">Merge & Remove:</span> <span className="font-black text-red-600">{removeClient.name}</span></p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => setConfirmOpen(false)} type="button">
                Cancel
              </button>
              <button className="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-900" onClick={confirmMerge} type="button">
                Yes, Merge Client
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPlatformShell>
  );
}

function ManualClientRegistrationWorkflow() {
  const [workshops, setWorkshops] = useState<WorkshopMasterRecord[]>([]);
  const [clients, setClients] = useState<ClientStorageRecord[]>([]);
  const [workshop, setWorkshop] = useState("");
  const [batch, setBatch] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [success, setSuccess] = useState("");
  const [isError, setIsError] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const clientBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWorkshops(readLocalStorageArray<WorkshopMasterRecord>(WORKSHOP_MASTER_STORAGE_KEY));
    setClients(readLocalStorageArray<ClientStorageRecord>(CLIENTS_STORAGE_KEY).filter((client) => (client.name ?? "").trim()));
  }, []);

  // Close the suggestion list when clicking anywhere outside the combobox.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (clientBoxRef.current && !clientBoxRef.current.contains(event.target as Node)) {
        setShowClientList(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const clientMatches = useMemo(() => {
    const normalized = name.trim().toLowerCase();
    const list = normalized
      ? clients.filter((client) =>
          `${client.name ?? ""} ${client.mobile ?? ""} ${client.email ?? ""}`.toLowerCase().includes(normalized)
        )
      : clients;
    return list.slice(0, 8);
  }, [clients, name]);

  function selectExistingClient(client: ClientStorageRecord) {
    setName(client.name ?? "");
    if (client.mobile) setMobile(client.mobile);
    if (client.email) setEmail(client.email);
    setShowClientList(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsError(false);
    const selectedWorkshop = workshops.find((item) => item.id === workshop || item.name === workshop);
    const mobileDigits = mobile.replace(/\D/g, "");

    if (!selectedWorkshop) {
      setIsError(true);
      setSuccess("Please select a workshop first.");
      return;
    }

    if (!name.trim() || mobileDigits.length < 10 || !email.trim()) {
      setIsError(true);
      setSuccess("Please fill client name, valid mobile and email.");
      return;
    }

    const current = readLocalStorageArray<ManualRegistrationEntry>(REGISTRATION_STORAGE_KEY);
    const registrationId = `manual-${selectedWorkshop.id}-${mobileDigits}`;
    const payload: ManualRegistrationEntry = {
      amountDue: 0,
      amountPaid: 0,
      city: "",
      createdAt: new Date().toISOString().slice(0, 10),
      email: email.trim(),
      fullName: name.trim(),
      id: registrationId,
      mobile: `+91 ${mobileDigits}`,
      paymentMode: "Full",
      status: "Paid",
      workshopId: selectedWorkshop.id,
      workshopSlug: selectedWorkshop.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      workshopTitle: selectedWorkshop.name
    };
    const existingIndex = current.findIndex((item) => item.id === registrationId);
    const next = existingIndex >= 0
      ? current.map((item, index) => index === existingIndex ? payload : item)
      : [payload, ...current];

    window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(next));
    setSuccess(`${payload.fullName} registered in ${selectedWorkshop.name}. Workshop Master View Data ma pan dekhase.`);
    setWorkshop("");
    setBatch("");
    setName("");
    setMobile("");
    setEmail("");
    setSource("");
  }

  return (
    <AdminPlatformShell
      activeLabel="Manual Client Registration"
      description="Register a client manually into a workshop with batch, email and source tracking."
      title="Manage Manual Client Registration"
    >
      <section className="mx-auto mt-2 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-6 text-xl font-medium text-gray-800">Manage Manual Client Registration</h3>

        {success ? (
          <p className={`mb-5 rounded-xl px-4 py-3 text-sm font-bold ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {success}
          </p>
        ) : null}

        <form onSubmit={submit}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ManualSelect
              label="Select Workshop"
              onChange={setWorkshop}
              options={workshops.map((item) => ({ label: item.name, value: item.id }))}
              placeholder={workshops.length ? "SELECT WORKSHOP" : "No workshop added yet"}
              value={workshop}
            />
            <ManualSelect label="Batch" onChange={setBatch} options={[{ label: "Main Batch", value: "main" }]} placeholder="SELECT BATCH" value={batch} />

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-600">Client Name</span>
              <span className="relative block" ref={clientBoxRef}>
                <input
                  autoComplete="off"
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  onChange={(event) => {
                    setName(event.target.value);
                    setShowClientList(true);
                  }}
                  onFocus={() => setShowClientList(true)}
                  placeholder="Type a new name or pick an existing client"
                  required
                  value={name}
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                {showClientList && clientMatches.length ? (
                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <p className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Existing clients</p>
                    {clientMatches.map((client) => (
                      <button
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-indigo-50"
                        key={client.id}
                        // onMouseDown fires before the input's blur, so the autofill always applies.
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectExistingClient(client);
                        }}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-900">{client.name}</span>
                          <span className="block truncate text-xs font-semibold text-slate-500">
                            {[client.mobile, client.email].filter(Boolean).join(" · ") || "No contact saved"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </span>
              <span className="mt-1 block text-xs font-semibold text-slate-400">
                {clients.length ? "Saved client select karo, athva navu naam type karo." : "Koi saved client nathi — navu naam type karo."}
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-600">Mobile No</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                onChange={(event) => setMobile(event.target.value)}
                placeholder="Mobile No"
                required
                value={mobile}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-600">Email ID</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email Id"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-600">Source (UTM)</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                onChange={(event) => setSource(event.target.value)}
                placeholder="Source (UTM)"
                value={source}
              />
            </label>
          </div>

          <button className="mt-6 rounded-md bg-indigo-500 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-600" type="submit">
            Register Free
          </button>
        </form>
      </section>
    </AdminPlatformShell>
  );
}

function ManualSelect({
  label,
  onChange,
  options,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-600">{label}</span>
      <span className="relative block">
        <select
          className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          onChange={(event) => onChange(event.target.value)}
          required
          value={value}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
      </span>
    </label>
  );
}

function filterMergeClients(clients: MergeClient[], query: string, excludeId?: string) {
  const normalized = query.trim().toLowerCase();
  return clients
    .filter((client) => client.id !== excludeId)
    .filter((client) => {
      if (!normalized) return true;
      return `${client.name} ${client.mobile} ${client.id}`.toLowerCase().includes(normalized);
    })
    .slice(0, 5);
}

function ComboboxCard({
  query,
  results,
  selected,
  setQuery,
  setSelected
}: {
  query: string;
  results: MergeClient[];
  selected: MergeClient | null;
  setQuery: (value: string) => void;
  setSelected: (client: MergeClient | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <label className="mb-2 block text-sm text-gray-600">Search By Name or Mobile No</label>
      <div className="relative">
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by Keyword"
          value={query}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        {open ? (
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {results.length ? (
              results.map((client) => (
                <button
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-indigo-50"
                  key={client.id}
                  onClick={() => {
                    setSelected(client);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-black text-slate-950">{client.name}</span>
                    <span className="text-xs font-semibold text-slate-500">{client.mobile} | {client.city}</span>
                  </span>
                  <span className="text-xs font-bold text-indigo-600">{client.id}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-slate-500">No clients found.</p>
            )}
          </div>
        ) : null}
      </div>
      {selected ? (
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm">
          <p className="font-black text-slate-950">{selected.name}</p>
          <p className="mt-1 font-semibold text-indigo-700">{selected.mobile} | {selected.city}</p>
        </div>
      ) : null}
    </div>
  );
}

function ProcessInput({ field, onChange, value }: { field: ProcessField; onChange: (value: string) => void; value: string }) {
  const label = (
    <span className="mb-2 block text-sm font-bold text-slate-600">
      {field.label}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </span>
  );

  if (field.type === "select") {
    return (
      <label className="block">
        {label}
        <select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}>
          <option value="">Select {field.label}</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block md:col-span-2 xl:col-span-3">
        {label}
        <textarea className={`${inputClass} min-h-[104px]`} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} value={value} />
      </label>
    );
  }

  if (field.type === "file") {
    return (
      <label className="block">
        {label}
        <input className={inputClass} onChange={(event) => onChange(event.target.files?.[0]?.name ?? "")} type="file" />
      </label>
    );
  }

  return (
    <label className="block">
      {label}
      <input className={inputClass} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} type={field.type} value={value} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
        <CheckCircle2 className="size-5" />
      </span>
      <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function RefundPageButton({
  active,
  children,
  disabled,
  onClick
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-sm font-bold transition ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
