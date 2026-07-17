"use client";

import {
  Activity,
  Archive,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  Home,
  FileText,
  Import,
  Layers3,
  LogOut,
  Menu,
  Merge,
  Search,
  Settings,
  Tags,
  Target,
  TicketCheck,
  UserPlus,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const BRAND_LOGO_SRC = "/brand/coach-for-life-logo.jpeg";

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type NavGroup = {
  icon: LucideIcon;
  items: NavItem[];
  label: string;
  sections?: ReportSection[];
};

type ReportSection = {
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
      { href: "/workshop-setup", icon: Tags, label: "Workshop Setup" },
      { href: "/process/import-data-workshop-wise", icon: Import, label: "Import Workshop Data" },
      { href: "/form-builder", icon: FileText, label: "Form Builder" },
      { href: "/workshop-attendance", icon: ClipboardCheck, label: "Workshop Attendance" }
    ]
  },
  {
    icon: UsersRound,
    label: "CRM / Clients",
    items: [
      { href: "/manage-client", icon: UsersRound, label: "Manage Client" },
      { href: "/historical-data", icon: Archive, label: "Historical Data" },
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
    items: [],
    sections: [
      {
        icon: Activity,
        label: "Workshop",
        items: [
          { href: "/reports/daily-report", icon: Activity, label: "Daily Report" },
          { href: "/reports/workshop-url-status", icon: Activity, label: "Workshop URL & Status" },
          { href: "/reports/yearly-public-session", icon: Activity, label: "Yearly Public Session" },
          { href: "/reports/yearly-workshop", icon: Activity, label: "Yearly Workshop" },
          { href: "/reports/facilitators-performance", icon: Activity, label: "Facilitators Performance" },
          { href: "/reports/workshop-summary", icon: Activity, label: "Workshop Summary" },
          { href: "/reports/batch-wise-workshop-summary", icon: Activity, label: "Batch-wise Workshop Summary" }
        ]
      },
      {
        icon: Activity,
        label: "Clients",
        items: [
          { href: "/reports/client-milestone", icon: Activity, label: "Client Milestone" },
          { href: "/reports/failed-payment", icon: Activity, label: "Failed Payment" },
          { href: "/reports/part-payment", icon: Activity, label: "Part Payment" },
          { href: "/reports/workshop-wise-member", icon: Activity, label: "Workshop-wise Member" },
          { href: "/reports/member-attend-more-workshop", icon: Activity, label: "Member Attend More Workshop" },
          { href: "/reports/member-details", icon: Activity, label: "Member Details" },
          { href: "/reports/member-details-part-payment", icon: Activity, label: "Member Details (Part Payment)" },
          { href: "/reports/session-conversation", icon: Activity, label: "Session Conversation" },
          { href: "/reports/client-batch-transfer", icon: Activity, label: "Client Batch Transfer" }
        ]
      },
      {
        icon: Activity,
        label: "Sales Person",
        items: [
          { href: "/reports/sales-person-milestone", icon: Activity, label: "Sales Person Milestone" },
          { href: "/reports/sales-person-payment", icon: Activity, label: "Sales Person Payment" },
          { href: "/reports/sales-person-lead-assign", icon: Activity, label: "Sales Person Lead Assign" }
        ]
      }
    ]
  }
];

const allNavItems = [
  ...quickItems,
  ...navGroups.flatMap((group) => [
    ...group.items,
    ...(group.sections?.flatMap((section) => section.items) ?? [])
  ]),
  ...footerItems
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
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const activeGroup = useMemo(() => navGroups.find((group) => isGroupActive(group, pathname))?.label ?? "Workshop", [pathname]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ [activeGroup]: true });
  const [openReportSections, setOpenReportSections] = useState<Record<string, boolean>>({ Workshop: true });
  const searchMatches = useMemo(() => {
    const value = searchQuery.trim().toLowerCase();
    if (!value) return [];
    return allNavItems.filter((item) => item.label.toLowerCase().includes(value)).slice(0, 7);
  }, [searchQuery]);
  const showResults = searchFocused && searchMatches.length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    setSidebarOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  // Global Ctrl/Cmd+K shortcut to focus the command palette.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close the results dropdown when clicking outside the search box.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function goToMatch(href: string) {
    setSearchQuery("");
    setSearchFocused(false);
    router.push(href);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchQuery("");
      setSearchFocused(false);
      searchInputRef.current?.blur();
      return;
    }
    if (!searchMatches.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % searchMatches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + searchMatches.length) % searchMatches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const match = searchMatches[activeIndex] ?? searchMatches[0];
      if (match) goToMatch(match.href);
    }
  }

  function toggleGroup(label: string) {
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  }

  function toggleReportSection(label: string) {
    setOpenReportSections((current) => ({ ...current, [label]: !current[label] }));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-[0_1px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              aria-expanded={sidebarOpen}
              aria-label="Toggle sidebar"
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => setSidebarOpen((open) => !open)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <img
                alt="Coach For Life"
                className="h-8 w-auto max-w-[190px] rounded-md bg-white object-contain"
                src={BRAND_LOGO_SRC}
              />
              <h1 className="truncate text-lg font-black text-slate-950">{activeLabel}</h1>
            </div>
          </div>

          <div
            className="relative hidden min-w-[360px] max-w-xl flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-emerald-300 focus-within:bg-white focus-within:shadow-sm md:flex"
            ref={searchBoxRef}
          >
            <Search className="size-4 text-slate-400" />
            <input
              aria-label="Search pages, reports and workflows"
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search pages, reports, workflows..."
              ref={searchInputRef}
              value={searchQuery}
            />
            <kbd className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-400">Ctrl K</kbd>
            {showResults ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                {searchMatches.map((item, index) => {
                  const Icon = item.icon;
                  const active = index === activeIndex;
                  return (
                    <a
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition ${
                        active ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                      href={item.href}
                      key={`${item.href}-${item.label}`}
                      onClick={(event) => {
                        event.preventDefault();
                        goToMatch(item.href);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className={`grid size-8 place-items-center rounded-lg ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        <Icon className="size-4" />
                      </span>
                      {item.label}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-500">Welcome</p>
              <p className="text-sm font-bold text-slate-900">Admin User</p>
            </div>
            <div className="hidden size-10 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-950/20 min-[380px]:grid">
              AU
            </div>
            <button
              aria-expanded={mobileSearchOpen}
              aria-label="Search pages and workflows"
              className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 md:hidden"
              onClick={() => setMobileSearchOpen((open) => !open)}
              type="button"
            >
              {mobileSearchOpen ? <X className="size-4" /> : <Search className="size-4" />}
            </button>
            <ThemeToggle />
            <button
              aria-label="Logout"
              className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              onClick={logout}
              type="button"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        {mobileSearchOpen ? (
          <div className="border-t border-slate-200/80 px-3 py-3 md:hidden">
            <div className="relative mx-auto max-w-[1540px]" ref={searchBoxRef}>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search pages, reports and workflows"
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-semibold outline-none placeholder:text-slate-400"
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search pages, reports, workflows..."
                value={searchQuery}
              />
              {searchQuery.trim() ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                  {searchMatches.length ? searchMatches.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <button
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${index === activeIndex ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}
                        key={`${item.href}-${item.label}-mobile`}
                        onClick={() => goToMatch(item.href)}
                        type="button"
                      >
                        <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-4" /></span>
                        {item.label}
                      </button>
                    );
                  }) : <p className="px-3 py-4 text-sm font-semibold text-slate-500">No matching page found.</p>}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      {sidebarOpen ? (
        <button
          aria-label="Dismiss sidebar backdrop"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div className="mx-auto grid min-w-0 max-w-[1540px] gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[286px_minmax(0,1fr)] lg:px-6 lg:py-5">
        <aside
          className={`${sidebarOpen ? "left-3 translate-x-0" : "left-0 -translate-x-full"} fixed bottom-3 top-3 z-50 w-[min(286px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-3 shadow-2xl transition-transform duration-200 lg:sticky lg:top-[84px] lg:z-20 lg:block lg:h-[calc(100vh-104px)] lg:w-auto lg:translate-x-0 lg:shadow-panel`}
          data-open={sidebarOpen}
        >
          <div className="mb-2 flex items-center justify-end lg:hidden">
            <button
              aria-label="Close sidebar"
              className="grid size-9 place-items-center rounded-lg bg-white/10 text-slate-200 hover:bg-white/15 hover:text-white"
              onClick={() => setSidebarOpen(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">Unified Platform</p>
            <div className="mt-3 rounded-xl bg-white p-2 shadow-sm">
              <img alt="Coach For Life" className="h-12 w-full object-contain" src={BRAND_LOGO_SRC} />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-300">Live business workspace.</p>
          </div>

          <nav aria-label="Primary navigation" className="mt-3 space-y-1.5">
            {quickItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <a
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                    active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  <span className={`grid size-8 place-items-center rounded-lg ${active ? "bg-emerald-500 text-white" : "bg-white/10 text-slate-300"}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">{item.label}</span>
                </a>
              );
            })}

            <div className="my-3 border-t border-white/10" />

            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const groupActive = isGroupActive(group, pathname);
              const open = openGroups[group.label] ?? groupActive;

              return (
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-1" key={group.label}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-black transition ${
                      groupActive ? "bg-white text-slate-950 shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                    onClick={() => toggleGroup(group.label)}
                    type="button"
                  >
                    <span className={`grid size-8 place-items-center rounded-lg ${groupActive ? "bg-emerald-500 text-white" : "bg-white/10 text-slate-300"}`}>
                      <GroupIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">{group.label}</span>
                    <ChevronDown className={`size-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                  </button>

                  {open ? (
                    <div className="mt-1 space-y-1 px-1 pb-1">
                      {group.sections ? (
                        group.sections.map((section) => {
                          const SectionIcon = section.icon;
                          const sectionActive = section.items.some((item) => item.href === pathname);
                          const sectionOpen = openReportSections[section.label] ?? sectionActive;

                          return (
                            <div className="rounded-lg bg-white/[0.04]" key={section.label}>
                              <button
                                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-black transition ${
                                  sectionActive ? "text-emerald-200" : "text-slate-300 hover:text-white"
                                }`}
                                onClick={() => toggleReportSection(section.label)}
                                type="button"
                              >
                                <SectionIcon className="size-3.5" />
                                <span className="min-w-0 flex-1 truncate">{section.label}</span>
                                <ChevronDown className={`size-3.5 text-slate-400 transition ${sectionOpen ? "rotate-180" : ""}`} />
                              </button>

                              {sectionOpen ? (
                                <div className="space-y-1 pb-1 pl-5 pr-1">
                                  {section.items.map((item) => {
                                    const active = pathname === item.href;
                                    return (
                                      <a
                                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                                          active ? "bg-emerald-500 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
                                        }`}
                                        href={item.href}
                                        key={`${section.label}-${item.label}`}
                                      >
                                        <span className={`size-2 rounded-full border ${active ? "border-white bg-white" : "border-slate-500"}`} />
                                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                      </a>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      ) : group.items.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href;
                        return (
                          <a
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
                              active ? "bg-emerald-500 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
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

            <div className="my-3 border-t border-white/10" />

            {footerItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <a
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                    active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  <span className={`grid size-8 place-items-center rounded-lg ${active ? "bg-emerald-500 text-white" : "bg-white/10 text-slate-300"}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">{item.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 space-y-4 lg:space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft md:p-6 lg:px-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Admin Platform</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-[30px]">{title}</h2>
                {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a aria-label="Import / Export" className="grid size-10 place-items-center rounded-lg bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800" href="/manage-client" title="Import / Export">
                  <Import className="size-4" />
                </a>
                <a aria-label="Integrations" className="grid size-10 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" href="/settings" title="Integrations">
                  <Settings className="size-4" />
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

function isGroupActive(group: NavGroup, pathname: string) {
  return (
    group.items.some((item) => item.href === pathname) ||
    Boolean(group.sections?.some((section) => section.items.some((item) => item.href === pathname)))
  );
}
