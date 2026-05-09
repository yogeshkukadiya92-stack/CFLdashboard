"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { processPageConfigs, type ProcessField } from "@/lib/process-pages";
import { CheckCircle2, Download, Eye, RefreshCw, Save, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export function ProcessModulePage({ slug }: { slug: string }) {
  if (slug === "client-batch-transfer") {
    return <ClientBatchTransferWorkflow />;
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
