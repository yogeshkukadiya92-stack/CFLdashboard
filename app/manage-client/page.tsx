"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
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
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

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
  return value.replace(/[^\d+]/g, "").trim();
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

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) setClients(JSON.parse(raw) as ClientRow[]);
    fetch("/api/state")
      .then((response) => response.json())
      .then((state) => {
        if (state?.dbEnabled && Array.isArray(state.clients)) {
          setClients(state.clients as ClientRow[]);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.clients));
        }
      })
      .catch(() => undefined);
  }, []);

  function save(next: ClientRow[]) {
    setClients(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    void fetch("/api/state", {
      body: JSON.stringify({ clients: next }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }).catch(() => undefined);
  }

  const filteredClients = useMemo(() => {
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
  }, [clients, searchTerm, sortDirection, sortKey, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filteredClients.slice(startIndex, startIndex + pageSize);
  const activeCount = clients.filter((client) => client.status === "Active").length;
  const inactiveCount = clients.filter((client) => client.status === "Inactive").length;
  const suspectCount = clients.filter((client) => client.status === "Suspect").length;

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
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

  function deleteClient(id: number) {
    save(clients.filter((client) => client.id !== id));
    setMessage("Client deleted.");
  }

  function saveEdit() {
    if (!editing) return;
    const next = editing.id ? clients.map((client) => (client.id === editing.id ? editing : client)) : [{ ...editing, id: Date.now() }, ...clients];
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
                    setSearchTerm(event.target.value);
                  }}
                  placeholder="Name, mobile, email, city..."
                  value={searchTerm}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <input accept=".xlsx,.xls,.csv" className="hidden" onChange={importSheet} ref={inputRef} type="file" />
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800" onClick={() => inputRef.current?.click()} type="button">
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
              {pageRows.length ? pageRows.map((client) => (
                <tr className="transition hover:bg-indigo-50/40" key={client.id}>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setEditing(client)} type="button">
                        <Edit3 className="size-4" />
                      </button>
                      <button className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => deleteClient(client.id)} type="button">
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
              )) : (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500" colSpan={12}>
                    No client records yet. Import your Excel/CSV sheet to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 md:p-6">
          <p>Showing {filteredClients.length ? startIndex + 1 : 0} to {Math.min(startIndex + pageSize, filteredClients.length)} of {filteredClients.length} entries</p>
          <div className="flex items-center gap-1">
            <PageButton disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="size-4" />Previous</PageButton>
            {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 8).map((pageNumber) => (
              <PageButton active={safePage === pageNumber} key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</PageButton>
            ))}
            <PageButton disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next<ChevronRight className="size-4" /></PageButton>
          </div>
        </div>
      </section>

      {editing ? <ClientEditor client={editing} onChange={setEditing} onClose={() => setEditing(null)} onSave={saveEdit} /> : null}
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-950">Client Details</h3>
          <button className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={onClose} type="button"><X className="size-4" /></button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
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
        <div className="mt-6 flex justify-end gap-2">
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
