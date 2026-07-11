"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { hydrateLiveState, readLocalArray, saveLiveState } from "@/lib/live-state";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FileSpreadsheet,
  Search,
  Trash2,
  Upload,
  UsersRound,
  X
} from "lucide-react";
import { type ChangeEvent, type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

type ClientStatus = "Active" | "Inactive" | "Suspect";

type ClientRow = {
  city: string;
  country: string;
  dob: string;
  email: string;
  gender: string;
  id: number;
  mobile: string;
  name: string;
  occupation: string;
  state: string;
  status: ClientStatus;
};

type SortKey = keyof ClientRow;
type SortDirection = "asc" | "desc";

const STORAGE_KEY = "cfl_clients_v1";

const emptyClient: ClientRow = {
  city: "",
  country: "India",
  dob: "",
  email: "",
  gender: "",
  id: 0,
  mobile: "",
  name: "",
  occupation: "",
  state: "",
  status: "Active"
};

const columns: Array<{ key: SortKey; label: string }> = [
  { key: "status", label: "Status" },
  { key: "id", label: "Client ID" },
  { key: "name", label: "Name" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "dob", label: "D.O.B." },
  { key: "gender", label: "Gender" },
  { key: "occupation", label: "Occupation" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "city", label: "City" }
];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row: Record<string, unknown>, keys: string[]) {
  const map = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? "").trim()]));
  for (const key of keys) {
    const found = map.get(normalizeHeader(key));
    if (found) return found;
  }
  return "";
}

function normalizeStatus(value: string): ClientStatus {
  const normalized = value.toLowerCase();
  if (normalized.includes("inactive")) return "Inactive";
  if (normalized.includes("suspect")) return "Suspect";
  return "Active";
}

function normalizeMobile(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(-10);
  return digits;
}

function toClient(row: Record<string, unknown>, index: number): ClientRow {
  const firstName = pick(row, ["first name", "firstname", "first"]);
  const lastName = pick(row, ["last name", "lastname", "last"]);
  const fullName = pick(row, ["name", "client name", "member name", "full name"]) || [firstName, lastName].filter(Boolean).join(" ");

  return {
    city: pick(row, ["city"]),
    country: pick(row, ["country"]) || "India",
    dob: pick(row, ["dob", "d.o.b.", "birth date", "date of birth"]),
    email: pick(row, ["email", "email id", "mail"]),
    gender: pick(row, ["gender"]),
    id: Number(pick(row, ["client id", "id"])) || Date.now() + index,
    mobile: normalizeMobile(pick(row, ["mobile", "mobile no", "phone", "contact", "login id"])),
    name: fullName || "Unnamed Client",
    occupation: pick(row, ["occupation", "profession"]),
    state: pick(row, ["state"]),
    status: normalizeStatus(pick(row, ["status"]) || "Active")
  };
}

export default function ManageClientPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"All" | ClientStatus>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [remoteMode, setRemoteMode] = useState<boolean | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteCounts, setRemoteCounts] = useState({ Active: 0, Inactive: 0, Suspect: 0 });
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteCursor, setRemoteCursor] = useState<string | null>(null);
  const [remoteNextCursor, setRemoteNextCursor] = useState<string | null>(null);
  const [remoteCursorHistory, setRemoteCursorHistory] = useState<Array<string | null>>([]);
  const [remoteReload, setRemoteReload] = useState(0);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    function loadLocal() {
      setClients(readLocalArray<ClientRow>(STORAGE_KEY));
    }

    const controller = new AbortController();
    fetch("/api/crm/clients?limit=10", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (data.dbEnabled) {
          setRemoteMode(true);
          return;
        }
        setRemoteMode(false);
        loadLocal();
        void hydrateLiveState().then(loadLocal);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRemoteMode(false);
        loadLocal();
        void hydrateLiveState().then(loadLocal);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (remoteMode !== true) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRemoteLoading(true);
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (remoteCursor) params.set("cursor", remoteCursor);
      if (deferredSearchTerm.trim()) params.set("query", deferredSearchTerm.trim());
      if (statusFilter !== "All") params.set("status", statusFilter);
      try {
        const response = await fetch(`/api/crm/clients?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load clients.");
        setClients(data.clients ?? []);
        setRemoteCounts(data.counts ?? { Active: 0, Inactive: 0, Suspect: 0 });
        setRemoteTotal(Number(data.total ?? 0));
        setRemoteNextCursor(data.nextCursor ?? null);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage(error instanceof Error ? error.message : "Failed to load clients.");
        }
      } finally {
        if (!controller.signal.aborted) setRemoteLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredSearchTerm, pageSize, remoteCursor, remoteMode, remoteReload, statusFilter]);

  function save(next: ClientRow[]) {
    setClients(next);
    void saveLiveState({ clients: next });
  }

  const filteredClients = useMemo(() => {
    if (remoteMode === true) return clients;
    const normalized = searchTerm.trim().toLowerCase();
    return clients
      .filter((client) => statusFilter === "All" || client.status === statusFilter)
      .filter((client) => {
        if (!normalized) return true;
        return Object.values(client).some((value) => String(value).toLowerCase().includes(normalized));
      })
      .sort((a, b) => {
        const aValue = String(a[sortKey]).toLowerCase();
        const bValue = String(b[sortKey]).toLowerCase();
        const compare = aValue.localeCompare(bValue, undefined, { numeric: true });
        return sortDirection === "asc" ? compare : -compare;
      });
  }, [clients, remoteMode, searchTerm, sortDirection, sortKey, statusFilter]);

  const resultCount = remoteMode === true ? remoteTotal : filteredClients.length;
  const totalPages = Math.max(1, Math.ceil(resultCount / pageSize));
  const safePage = remoteMode === true ? remoteCursorHistory.length + 1 : Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = remoteMode === true ? clients : filteredClients.slice(startIndex, startIndex + pageSize);
  const activeCount = remoteMode === true ? remoteCounts.Active : clients.filter((client) => client.status === "Active").length;
  const inactiveCount = remoteMode === true ? remoteCounts.Inactive : clients.filter((client) => client.status === "Inactive").length;
  const suspectCount = remoteMode === true ? remoteCounts.Suspect : clients.filter((client) => client.status === "Suspect").length;

  function changeSort(key: SortKey) {
    if (remoteMode === true) {
      setMessage("Database client list is sorted by newest Client ID for stable pagination.");
      return;
    }
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function nextRemotePage() {
    if (!remoteNextCursor) return;
    setRemoteCursorHistory((current) => [...current, remoteCursor]);
    setRemoteCursor(remoteNextCursor);
  }

  function previousRemotePage() {
    if (!remoteCursorHistory.length) return;
    const previous = remoteCursorHistory[remoteCursorHistory.length - 1] ?? null;
    setRemoteCursorHistory((current) => current.slice(0, -1));
    setRemoteCursor(previous);
  }

  async function importSheet(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const imported = rows.map(toClient).filter((client) => client.mobile || client.email || client.name !== "Unnamed Client");

    if (remoteMode === true) {
      setRemoteLoading(true);
      try {
        for (let index = 0; index < imported.length; index += 10) {
          const group = imported.slice(index, index + 10);
          const responses = await Promise.all(group.map((client) => fetch("/api/crm/clients", {
            body: JSON.stringify(client),
            headers: { "Content-Type": "application/json" },
            method: "POST"
          })));
          const failed = responses.find((response) => !response.ok && response.status !== 409);
          if (failed) throw new Error("Some client rows could not be imported.");
        }
        setRemoteCursor(null);
        setRemoteCursorHistory([]);
        setRemoteReload((value) => value + 1);
        setMessage(`${imported.length} client rows processed in the database.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Client import failed.");
      } finally {
        setRemoteLoading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
      return;
    }

    const byMobile = new Map<string, ClientRow>();
    clients.forEach((client) => byMobile.set(client.mobile || `id-${client.id}`, client));
    imported.forEach((client) => {
      const key = client.mobile || `import-${client.id}`;
      byMobile.set(key, { ...byMobile.get(key), ...client });
    });

    const next = Array.from(byMobile.values());
    save(next);
    setMessage(`${imported.length} rows imported. Duplicate mobile numbers were merged.`);
    setPage(1);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function exportXlsx() {
    try {
      const XLSX = await import("xlsx");
      const headers = ["Status", "Client ID", "Name", "Mobile", "Email", "DOB", "Gender", "Occupation", "Country", "State", "City"];
      const rows = filteredClients.map((client) => [
        client.status,
        client.id,
        client.name,
        client.mobile,
        client.email,
        client.dob,
        client.gender,
        client.occupation,
        client.country,
        client.state,
        client.city
      ]);
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
      XLSX.writeFile(workbook, "clients-export.xlsx");
      setMessage(`Excel export ready with ${filteredClients.length} client rows.`);
    } catch {
      exportCsv();
      setMessage("Excel export fallback: CSV file downloaded.");
    }
  }

  function exportCsv() {
    const headers = ["Status", "Client ID", "Name", "Mobile", "Email", "D.O.B.", "Gender", "Occupation", "Country", "State", "City"];
    const rows = filteredClients.map((client) => [
      client.status,
      client.id,
      client.name,
      client.mobile,
      client.email,
      client.dob,
      client.gender,
      client.occupation,
      client.country,
      client.state,
      client.city
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, "clients-export.csv", "text/csv;charset=utf-8;");
    setMessage(`CSV export ready with ${filteredClients.length} client rows.`);
  }

  async function downloadSample() {
    const rows = [
      ["Name", "Mobile", "Email", "DOB", "Gender", "Occupation", "Country", "State", "City", "Status"],
      ["Sample Client", "+91 00000 00000", "sample@example.com", "", "", "", "India", "", "", "Active"]
    ];

    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sample");
      XLSX.writeFile(workbook, "client-import-sample.xlsx");
      setMessage("Sample Excel template downloaded.");
    } catch {
      const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
      downloadBlob(csv, "client-import-sample.csv", "text/csv;charset=utf-8;");
      setMessage("Sample CSV template downloaded.");
    }
  }

  async function deleteClient(id: number) {
    if (remoteMode === true) {
      const response = await fetch(`/api/crm/clients?id=${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || "Failed to archive client.");
        return;
      }
      setDeleteTarget(null);
      setRemoteReload((value) => value + 1);
      setMessage("Client archived. Registration history is preserved.");
      return;
    }
    save(clients.filter((client) => client.id !== id));
    setDeleteTarget(null);
    setMessage("Client deleted.");
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.mobile.trim()) {
      setMessage("Client name and mobile are required.");
      return;
    }
    if (remoteMode === true) {
      const exists = clients.some((client) => client.id === editing.id);
      const response = await fetch("/api/crm/clients", {
        body: JSON.stringify(editing),
        headers: { "Content-Type": "application/json" },
        method: exists ? "PATCH" : "POST"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || "Failed to save client.");
        return;
      }
      setEditing(null);
      setRemoteCursor(null);
      setRemoteCursorHistory([]);
      setRemoteReload((value) => value + 1);
      setMessage("Client saved in the database.");
      return;
    }
    const exists = clients.some((client) => client.id === editing.id);
    const next = exists
      ? clients.map((client) => (client.id === editing.id ? editing : client))
      : [{ ...editing, id: editing.id || Date.now() }, ...clients];
    save(next);
    setEditing(null);
    setMessage("Client saved.");
  }

  return (
    <AdminPlatformShell
      activeLabel="Manage Client"
      description="Import your Excel client sheet, search instantly by mobile, edit records, delete duplicates and export reports."
      title="Manage Client"
    >
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Client Database</h2>
              <p className="mt-1 text-sm text-slate-500">Excel/CSV import, mobile-number duplicate merge, export and record management are ready.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Summary label="Active" tone="emerald" value={String(activeCount)} />
              <Summary label="Inactive" tone="slate" value={String(inactiveCount)} />
              <Summary label="Suspect" tone="rose" value={String(suspectCount)} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 xl:grid-cols-[1fr_auto]">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-600">Search By Status</span>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  onChange={(event) => {
                    setPage(1);
                    setRemoteCursor(null);
                    setRemoteCursorHistory([]);
                    setStatusFilter(event.target.value as "All" | ClientStatus);
                  }}
                  value={statusFilter}
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspect">Suspect</option>
                </select>
              </label>
              <label className="relative block">
                <span className="mb-2 block text-sm font-semibold text-slate-600">Universal Search</span>
                <Search className="pointer-events-none absolute bottom-3.5 left-3 size-4 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  onChange={(event) => {
                    setPage(1);
                    setRemoteCursor(null);
                    setRemoteCursorHistory([]);
                    setSearchTerm(event.target.value);
                  }}
                  placeholder="Name, mobile, email, city..."
                  value={searchTerm}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <input accept=".xlsx,.xls,.csv" className="hidden" onChange={importSheet} ref={inputRef} type="file" />
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={remoteLoading} onClick={() => inputRef.current?.click()} type="button">
                <Upload className="size-4" />
                Import Excel/CSV
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={downloadSample} type="button">
                <FileSpreadsheet className="size-4" />
                Sample Excel
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700" onClick={exportXlsx} type="button">
                <Download className="size-4" />
                Excel
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-4 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50" onClick={exportCsv} type="button">
                CSV
              </button>
            </div>
          </div>

          {message ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 md:p-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Show
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              onChange={(event) => {
                setPage(1);
                setRemoteCursor(null);
                setRemoteCursorHistory([]);
                setPageSize(Number(event.target.value));
              }}
              value={pageSize}
            >
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            entries
          </label>
          <button className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700" onClick={() => setEditing({ ...emptyClient, id: Date.now() })} type="button">
            Add Client
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-4">Action</th>
                {columns.map((column) => (
                  <th className="px-4 py-4" key={column.key}>
                    <button className="inline-flex items-center gap-1 font-black uppercase tracking-wide hover:text-indigo-700" onClick={() => changeSort(column.key)} type="button">
                      {column.label}
                      <span className="grid gap-0.5">
                        <ArrowUp className={`size-3 ${sortKey === column.key && sortDirection === "asc" ? "text-indigo-600" : "text-slate-300"}`} />
                        <ArrowDown className={`size-3 ${sortKey === column.key && sortDirection === "desc" ? "text-indigo-600" : "text-slate-300"}`} />
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {remoteLoading && !pageRows.length ? (
                <tr><td className="px-4 py-12 text-center font-semibold text-slate-500" colSpan={12}>Loading clients...</td></tr>
              ) : null}
              {pageRows.length ? pageRows.map((client) => (
                <tr className="transition hover:bg-indigo-50/40" key={client.id}>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setEditing(client)} type="button">
                        <Edit3 className="size-4" />
                      </button>
                      <button aria-label={`Delete ${client.name}`} className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => setDeleteTarget(client)} type="button">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={client.status} /></td>
                  <td className="px-4 py-4 font-bold text-slate-900">{client.id}</td>
                  <td className="px-4 py-4 font-bold text-slate-950">{client.name}</td>
                  <td className="px-4 py-4 text-slate-700">{client.mobile}</td>
                  <td className="px-4 py-4 text-slate-700">{client.email}</td>
                  <td className="px-4 py-4 text-slate-700">{client.dob}</td>
                  <td className="px-4 py-4 text-slate-700">{client.gender}</td>
                  <td className="px-4 py-4 text-slate-700">{client.occupation}</td>
                  <td className="px-4 py-4 text-slate-700">{client.country}</td>
                  <td className="px-4 py-4 text-slate-700">{client.state}</td>
                  <td className="px-4 py-4 text-slate-700">{client.city}</td>
                </tr>
              )) : !remoteLoading ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500" colSpan={12}>
                    No client records yet. Import your Excel/CSV sheet to start.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 md:p-6">
          <p>Showing {pageRows.length ? startIndex + 1 : 0} to {Math.min(startIndex + pageRows.length, resultCount)} of {resultCount.toLocaleString("en-IN")} entries</p>
          {remoteMode === true ? (
            <div className="flex items-center gap-1">
              <PageButton disabled={!remoteCursorHistory.length || remoteLoading} onClick={previousRemotePage}><ChevronLeft className="size-4" />Previous</PageButton>
              <span className="grid min-h-10 min-w-10 place-items-center rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white">{safePage}</span>
              <PageButton disabled={!remoteNextCursor || remoteLoading} onClick={nextRemotePage}>Next<ChevronRight className="size-4" /></PageButton>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <PageButton disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="size-4" />Previous</PageButton>
              {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 8).map((pageNumber) => (
                <PageButton active={safePage === pageNumber} key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</PageButton>
              ))}
              <PageButton disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next<ChevronRight className="size-4" /></PageButton>
            </div>
          )}
        </div>
      </section>

      {editing ? <ClientEditor client={editing} onChange={setEditing} onClose={() => setEditing(null)} onSave={saveEdit} /> : null}
      <ConfirmDialog
        confirmLabel="Delete Client"
        description={remoteMode === true ? "This archives the client while preserving registration history." : "This removes the client from the CRM list and synced app state."}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget ? deleteClient(deleteTarget.id) : undefined}
        open={Boolean(deleteTarget)}
        title="Delete client?"
      >
        {deleteTarget ? <span>{deleteTarget.name} · {deleteTarget.mobile || "No mobile"}</span> : null}
      </ConfirmDialog>
    </AdminPlatformShell>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

function ClientEditor({ client, onChange, onClose, onSave }: { client: ClientRow; onChange: (client: ClientRow) => void; onClose: () => void; onSave: () => void }) {
  const fields: Array<[keyof ClientRow, string, string]> = [
    ["name", "Name", "text"],
    ["mobile", "Mobile", "text"],
    ["email", "Email", "email"],
    ["dob", "D.O.B.", "text"],
    ["gender", "Gender", "text"],
    ["occupation", "Occupation", "text"],
    ["country", "Country", "text"],
    ["state", "State", "text"],
    ["city", "City", "text"]
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-xl font-black text-slate-950">Client Details</h3>
          <button className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={onClose} type="button"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-600">Status</span>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => onChange({ ...client, status: event.target.value as ClientStatus })} value={client.status}>
                <option>Active</option>
                <option>Inactive</option>
                <option>Suspect</option>
              </select>
            </label>
            {fields.map(([key, label, type]) => (
              <label className="block" key={key}>
                <span className="mb-1 block text-sm font-bold text-slate-600">{label}</span>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => onChange({ ...client, [key]: event.target.value })} type={type} value={String(client[key])} />
              </label>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-5 sm:flex-row sm:justify-end">
          <button className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={onClose} type="button">Cancel</button>
          <button className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700" onClick={onSave} type="button">Save Client</button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  const className = status === "Active" ? "bg-emerald-500 text-white" : status === "Inactive" ? "bg-slate-200 text-slate-700" : "bg-rose-100 text-rose-700";
  return <span className={`rounded-full px-3 py-1.5 text-xs font-black ${className}`}>{status}</span>;
}

function Summary({ label, tone, value }: { label: string; tone: "emerald" | "slate" | "rose"; value: string }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    rose: "bg-rose-50 text-rose-700 border-rose-100"
  };
  return (
    <div className={`min-w-[84px] rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

function PageButton({ active, children, disabled, onClick }: { active?: boolean; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={`inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-sm font-semibold transition ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"}`} disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  );
}
