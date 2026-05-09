"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { processPageConfigs, type ProcessField } from "@/lib/process-pages";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export function ProcessModulePage({ slug }: { slug: string }) {
  if (slug === "client-batch-transfer") {
    return <ClientBatchTransferWorkflow />;
  }

  if (slug === "refund") {
    return <RefundWorkflow />;
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

    setRows((current) => [{ ...form, id: crypto.randomUUID(), status: "Done", createdAt: new Date().toLocaleString() }, ...current]);
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

function ClientBatchTransferWorkflow() {
  const [clientSearch, setClientSearch] = useState("");
  const [sourceBatch, setSourceBatch] = useState("");
  const [destinationBatch, setDestinationBatch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [transfers, setTransfers] = useState<Array<{ client: string; from: string; id: string; remarks: string; status: string; to: string }>>([]);

  const batches = ["Batch A", "Batch B", "Batch C", "Weekend Batch", "Online Premium Batch"];

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
        id: crypto.randomUUID(),
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

const refundRowsSeed: RefundRow[] = [
  {
    amount: 18500,
    batch: "Batch A",
    id: "txn-001",
    mobile: "+91 98250 11843",
    name: "Rohan Mehta",
    orderId: "order_NBX1001",
    paymentId: "pay_NBX9001",
    regDate: "2026-04-21",
    status: "SUCCESS",
    workshop: "Leadership Sprint"
  },
  {
    amount: 9800,
    batch: "Weekend Batch",
    id: "txn-002",
    mobile: "+91 98980 22314",
    name: "Priya Nair",
    orderId: "order_NBX1002",
    paymentId: "pay_NBX9002",
    regDate: "2026-04-22",
    status: "SUCCESS",
    workshop: "Sales Masterclass"
  },
  {
    amount: 12500,
    batch: "Batch C",
    id: "txn-003",
    mobile: "+91 99099 44112",
    name: "Sumeet Shah",
    orderId: "order_NBX1003",
    paymentId: "pay_NBX9003",
    regDate: "2026-04-23",
    status: "REFUND",
    workshop: "Growth Bootcamp"
  },
  {
    amount: 5200,
    batch: "Online Premium Batch",
    id: "txn-004",
    mobile: "+91 98795 78441",
    name: "Kavya Desai",
    orderId: "order_NBX1004",
    paymentId: "pay_NBX9004",
    regDate: "2026-04-25",
    status: "SUCCESS",
    workshop: "Founder Strategy Session"
  },
  {
    amount: 25000,
    batch: "Batch B",
    id: "txn-005",
    mobile: "+91 98111 44289",
    name: "GlobalSoft HR",
    orderId: "order_NBX1005",
    paymentId: "pay_NBX9005",
    regDate: "2026-04-26",
    status: "SUCCESS",
    workshop: "Corporate Leadership"
  },
  {
    amount: 7500,
    batch: "Batch A",
    id: "txn-006",
    mobile: "+91 94260 55218",
    name: "Mehul Patel",
    orderId: "order_NBX1006",
    paymentId: "pay_NBX9006",
    regDate: "2026-04-28",
    status: "REFUND",
    workshop: "Wellness Intensive"
  }
];

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
