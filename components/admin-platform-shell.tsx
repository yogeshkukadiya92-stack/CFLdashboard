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
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type NavGroup = {
  icon: LucideIcon;
  items: NavItem[];
  label: string;
};

const quickItems: NavItem[] = [
  { href: "/", icon: Home, label: "Dashboard" }
];

const footerItems: NavItem[] = [
  { href: "/settings", icon: Settings, label: "Settings" }
];

const navGroups: NavGroup[] = [
  {
    icon: Layers3,
    label: "Workshop",
    items: [
      { href: "/workshop-master", icon: Layers3, label: "Workshop Master" },
      { href: "/workshop-scheduling-admin", icon: CalendarDays, label: "Workshop Schedule" },
      { href: "/process/import-data-workshop-wise", icon: Import, label: "Import Workshop Data" }
    ]
  },
  {
    icon: UsersRound,
    label: "CRM / Clients",
    items: [
      { href: "/manage-client", icon: UsersRound, label: "Manage Client" },
      { href: "/sales-person", icon: Target, label: "Sales Person" },
      { href: "/process/manual-client-registration", icon: UserPlus, label: "Manual Registration" },
      { href: "/process/merge-client", icon: Merge, label: "Merge Client" }
    ]
  },
  {
    icon: ClipboardCheck,
    label: "Process",
    items: [
      { href: "/process/client-batch-transfer", icon: ClipboardCheck, label: "Batch Transfer" },
      { href: "/process/refund", icon: TicketCheck, label: "Refund" },
      { href: "/process/apply-coupon", icon: Tags, label: "Apply Coupon" },
      { href: "/process/re-check-failed-payment", icon: Activity, label: "Failed Payment Check" },
      { href: "/process/manual-client-part-payment", icon: Activity, label: "Part Payment" }
    ]
  },
  {
    icon: BarChart3,
    label: "Reports",
    items: [
      { href: "/manage-client", icon: BarChart3, label: "Client Report" },
      { href: "/process/refund", icon: TicketCheck, label: "Payment Report" },
      { href: "/process/import-data-workshop-wise", icon: Import, label: "Import Report" }
    ]
  }
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
  const activeGroup = useMemo(() => navGroups.find((group) => group.items.some((item) => item.href === pathname))?.label ?? "Workshop", [pathname]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ [activeGroup]: true });

  function toggleGroup(label: string) {
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  }

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
          <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">Unified Platform</p>
            <p className="mt-1 text-xl font-black">CFL Admin</p>
            <p className="mt-1 text-xs text-indigo-100">Compact grouped menu.</p>
          </div>

          <nav className="mt-3 space-y-1.5">
            {quickItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <a
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                    active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  <span className={`grid size-8 place-items-center rounded-xl ${active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">{item.label}</span>
                </a>
              );
            })}

            <div className="my-3 border-t border-slate-100" />

            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const groupActive = group.items.some((item) => item.href === pathname);
              const open = openGroups[group.label] ?? groupActive;

              return (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-1" key={group.label}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-black transition ${
                      groupActive ? "bg-white text-indigo-700 shadow-sm" : "text-slate-800 hover:bg-white"
                    }`}
                    onClick={() => toggleGroup(group.label)}
                    type="button"
                  >
                    <span className={`grid size-8 place-items-center rounded-lg ${groupActive ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}>
                      <GroupIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">{group.label}</span>
                    <ChevronDown className={`size-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                  </button>

                  {open ? (
                    <div className="mt-1 space-y-1 px-1 pb-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href;
                        return (
                          <a
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
                              active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-white hover:text-slate-950"
                            }`}
                            href={item.href}
                            key={`${group.label}-${item.label}`}
                          >
                            <Icon className="size-3.5" />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="my-3 border-t border-slate-100" />

            {footerItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <a
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                    active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  <span className={`grid size-8 place-items-center rounded-xl ${active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">{item.label}</span>
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
              <div className="flex flex-wrap gap-2">
                <a className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800" href="/manage-client">
                  Import / Export
                </a>
                <a className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-100" href="/settings">
                  Integrations
                </a>
              </div>
            </div>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
