"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Home,
  Layers3,
  Menu,
  Search,
  Settings,
  TableProperties,
  UsersRound,
  type LucideIcon
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

const clients: ClientRow[] = [
  {
    id: 192562,
    status: "Active",
    name: "Rohan Mehta",
    mobile: "+91 98250 11843",
    email: "rohan.mehta@example.com",
    dob: "14 Sep 1988",
    gender: "Male",
    occupation: "Founder",
    country: "India",
    state: "Gujarat",
    city: "Surat"
  },
  {
    id: 192563,
    status: "Active",
    name: "Priya Nair",
    mobile: "+91 98980 22314",
    email: "priya.nair@example.com",
    dob: "02 Jan 1991",
    gender: "Female",
    occupation: "Coach",
    country: "India",
    state: "Maharashtra",
    city: "Mumbai"
  },
  {
    id: 192564,
    status: "Suspect",
    name: "Sumeet Shah",
    mobile: "+91 99099 44112",
    email: "sumeet.shah@example.com",
    dob: "27 Mar 1985",
    gender: "Male",
    occupation: "Consultant",
    country: "India",
    state: "Gujarat",
    city: "Ahmedabad"
  },
  {
    id: 192565,
    status: "Inactive",
    name: "Kavya Desai",
    mobile: "+91 98795 78441",
    email: "kavya.desai@example.com",
    dob: "19 Jun 1993",
    gender: "Female",
    occupation: "Designer",
    country: "India",
    state: "Karnataka",
    city: "Bengaluru"
  },
  {
    id: 192566,
    status: "Active",
    name: "GlobalSoft HR",
    mobile: "+91 98111 44289",
    email: "hr@globalsoft.example",
    dob: "11 Nov 1982",
    gender: "Other",
    occupation: "Corporate",
    country: "India",
    state: "Delhi",
    city: "New Delhi"
  },
  {
    id: 192567,
    status: "Active",
    name: "Mehul Patel",
    mobile: "+91 94260 55218",
    email: "mehul.patel@example.com",
    dob: "05 May 1990",
    gender: "Male",
    occupation: "Trainer",
    country: "India",
    state: "Gujarat",
    city: "Vadodara"
  },
  {
    id: 192568,
    status: "Inactive",
    name: "Ananya Rao",
    mobile: "+91 99870 66120",
    email: "ananya.rao@example.com",
    dob: "22 Aug 1994",
    gender: "Female",
    occupation: "Nutritionist",
    country: "India",
    state: "Telangana",
    city: "Hyderabad"
  },
  {
    id: 192569,
    status: "Suspect",
    name: "Arvind Kumar",
    mobile: "+91 97122 80901",
    email: "arvind.kumar@example.com",
    dob: "10 Dec 1987",
    gender: "Male",
    occupation: "Sales Lead",
    country: "India",
    state: "Rajasthan",
    city: "Jaipur"
  },
  {
    id: 192570,
    status: "Active",
    name: "Neha Kapoor",
    mobile: "+91 98981 10045",
    email: "neha.kapoor@example.com",
    dob: "30 Apr 1992",
    gender: "Female",
    occupation: "Entrepreneur",
    country: "India",
    state: "Maharashtra",
    city: "Pune"
  },
  {
    id: 192571,
    status: "Active",
    name: "Acme Corp.",
    mobile: "+91 98111 44289",
    email: "admin@acme.example",
    dob: "01 Jul 1980",
    gender: "Other",
    occupation: "Corporate Account",
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai"
  }
];

const navItems: Array<{ href?: string; icon: LucideIcon; label: string; active?: boolean }> = [
  { href: "/", icon: Home, label: "Dashboard" },
  { icon: Layers3, label: "Masters", active: true },
  { icon: TableProperties, label: "Reports" },
  { icon: Settings, label: "Settings" }
];

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="Toggle sidebar"
              className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => setSidebarOpen((open) => !open)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Client Ops</p>
              <h1 className="text-lg font-black text-slate-950">Manage Client</h1>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <p className="text-xs text-slate-500">Welcome</p>
            <p className="text-sm font-semibold text-slate-900">Admin User</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1540px] gap-4 px-4 py-4 lg:grid-cols-[260px_1fr] lg:px-6">
        <aside className={`${sidebarOpen ? "block" : "hidden"} rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:block`}>
          <div className="mb-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
            <UsersRound className="size-7" />
            <p className="mt-3 text-sm text-indigo-100">Centralized user management</p>
            <p className="text-xl font-black">249,789 clients</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const className = `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                item.active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
              }`;

              if (item.href) {
                return (
                  <a className={className} href={item.href} key={item.label}>
                    <Icon className="size-5" />
                    {item.label}
                  </a>
                );
              }

              return (
                <button className={className} key={item.label} type="button">
                  <Icon className="size-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Manage Client</h2>
                <p className="mt-1 text-sm text-slate-500">Filter, search, sort, export, and manage all member records.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Summary label="Active" tone="emerald" value="6" />
                <Summary label="Inactive" tone="slate" value="2" />
                <Summary label="Suspect" tone="rose" value="2" />
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
      </div>
    </main>
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
