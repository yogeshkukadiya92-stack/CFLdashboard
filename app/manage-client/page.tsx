"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Search,
  UsersRound
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

type ClientStatus = "Active" | "Inactive" | "Suspect";

type ClientRow = {
  id: number;
  status: ClientStatus;
  name: string;
  mobile: string;
  email: string;
  dob: string;
  gender: string;
  occupation: string;
  country: string;
  state: string;
  city: string;
};

type SortKey = keyof ClientRow;
type SortDirection = "asc" | "desc";

const clients: ClientRow[] = [];

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

export default function ManageClientPage() {
  const [statusFilter, setStatusFilter] = useState<"All" | ClientStatus>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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
  }, [searchTerm, sortDirection, sortKey, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filteredClients.slice(startIndex, startIndex + pageSize);

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
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

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "manage-client-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPlatformShell activeLabel="Manage Client" description="Centralized client table with filters, sorting, export and pagination in the same admin platform." title="Manage Client">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Manage Client</h2>
                <p className="mt-1 text-sm text-slate-500">Filter, search, sort, export, and manage all member records.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Summary label="Active" tone="emerald" value="0" />
                <Summary label="Inactive" tone="slate" value="0" />
                <Summary label="Suspect" tone="rose" value="0" />
              </div>
            </div>

            <div className="mt-6 max-w-md">
              <label className="mb-2 block text-sm font-semibold text-slate-600" htmlFor="statusFilter">
                Search By Status
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                id="statusFilter"
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
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
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
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                entries
              </label>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
                onClick={exportCsv}
                type="button"
              >
                <Download className="size-4" />
                Export
              </button>
            </div>

            <label className="relative block w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                onChange={(event) => {
                  setPage(1);
                  setSearchTerm(event.target.value);
                }}
                placeholder="Search name, mobile, email, city..."
                value={searchTerm}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-4">Action</th>
                  {columns.map((column) => (
                    <th className="px-4 py-4" key={column.key}>
                      <button
                        className="inline-flex items-center gap-1 font-black uppercase tracking-wide hover:text-indigo-700"
                        onClick={() => changeSort(column.key)}
                        type="button"
                      >
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
                {pageRows.length ? (
                  pageRows.map((client) => (
                    <tr className="transition hover:bg-indigo-50/40" key={client.id}>
                      <td className="px-4 py-4">
                        <button
                          aria-label={`Edit ${client.name}`}
                          className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700"
                          type="button"
                        >
                          <Edit3 className="size-4" />
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={client.status} />
                      </td>
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
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-slate-500" colSpan={12}>
                      No client records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 md:p-6">
            <p>
              Showing {filteredClients.length ? startIndex + 1 : 0} to {Math.min(startIndex + pageSize, filteredClients.length)} of{" "}
              {filteredClients.length} entries
            </p>
            <div className="flex items-center gap-1">
              <PageButton disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                <ChevronLeft className="size-4" />
                Previous
              </PageButton>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <PageButton active={safePage === pageNumber} key={pageNumber} onClick={() => setPage(pageNumber)}>
                  {pageNumber}
                </PageButton>
              ))}
              <PageButton disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
                <ChevronRight className="size-4" />
              </PageButton>
            </div>
          </div>
        </section>
      <section className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-indigo-600 text-white">
            <UsersRound className="size-5" />
          </span>
          <div>
            <p className="text-xl font-black text-slate-950">0 clients ready for upload</p>
            <p className="text-sm font-semibold text-indigo-700">Search, filter, sort and export flow is active.</p>
          </div>
        </div>
      </section>
    </AdminPlatformShell>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  const className =
    status === "Active"
      ? "bg-emerald-500 text-white"
      : status === "Inactive"
        ? "bg-slate-200 text-slate-700"
        : "bg-rose-100 text-rose-700";

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

function PageButton({
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
      className={`inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-sm font-semibold transition ${
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

