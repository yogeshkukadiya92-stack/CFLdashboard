"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Home,
  Import,
  Layers3,
  Menu,
  Merge,
  Search,
  Settings,
  Tags,
  Target,
  TicketCheck,
  UserPlus,
  UserRound,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  group?: string;
};

const navItems: NavItem[] = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/workshop-master", icon: Layers3, label: "Workshop Master", group: "Masters" },
  { href: "/workshop-scheduling-admin", icon: CalendarDays, label: "Workshop Schedule", group: "Masters" },
  { href: "/manage-client", icon: UsersRound, label: "Manage Client", group: "Masters" },
  { href: "/sales-person", icon: Target, label: "Sales Person", group: "CRM" },
  { href: "/process/client-batch-transfer", icon: ClipboardCheck, label: "Client Batch Transfer", group: "Process" },
  { href: "/process/refund", icon: TicketCheck, label: "Refund", group: "Process" },
  { href: "/process/import-data-workshop-wise", icon: Import, label: "Import Data Workshop Wise", group: "Process" },
  { href: "/process/merge-client", icon: Merge, label: "Merge Client", group: "Process" },
  { href: "/process/apply-coupon", icon: Tags, label: "Apply Coupon", group: "Process" },
  { href: "/process/re-check-failed-payment", icon: Activity, label: "Re-Check Failed Payment", group: "Process" },
  { href: "/process/manual-client-registration", icon: UserPlus, label: "Manual Client Registration", group: "Process" },
  { href: "/process/manual-client-part-payment", icon: Activity, label: "Manual Client Part Payment", group: "Process" },
  { href: "/manage-client", icon: BarChart3, label: "Reports" },
  { href: "/workshop-master", icon: Settings, label: "Settings" }
];

export function AdminPlatformShell({
  activeLabel,
  children,
  description,
  title
}: {
  activeLabel: string;
  children: ReactNode;
  description?: string;
  title: string;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
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
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Business OS</p>
              <h1 className="text-lg font-black text-slate-950">{activeLabel}</h1>
            </div>
          </div>

          <div className="hidden min-w-[340px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
            <Search className="size-4 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Universal search by mobile, client, workshop..."
            />
            <kbd className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-400">Ctrl K</kbd>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-500">Welcome</p>
              <p className="text-sm font-bold text-slate-900">Admin User</p>
            </div>
            <div className="grid size-10 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">
              AU
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1540px] gap-4 px-4 py-4 lg:grid-cols-[280px_1fr] lg:px-6">
        <aside className={`${sidebarOpen ? "block" : "hidden"} rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:block`}>
          <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">Unified Platform</p>
            <p className="mt-2 text-2xl font-black">CFL Admin</p>
            <p className="mt-1 text-sm text-indigo-100">Dashboard, masters, clients and schedules in one place.</p>
          </div>

          <nav className="mt-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href && item.label === activeLabel || pathname === item.href;
              return (
                <a
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                    active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  <span className={`grid size-9 place-items-center rounded-xl ${active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.group ? <ChevronDown className="-rotate-90 size-4 text-slate-400" /> : null}
                </a>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Admin Platform</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h2>
                {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p> : null}
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">
                Same platform layout
              </div>
            </div>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
