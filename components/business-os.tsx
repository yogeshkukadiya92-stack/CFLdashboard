"use client";

import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Command,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Gift,
  Globe2,
  Headphones,
  Home,
  Import,
  Languages,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Phone,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TicketCheck,
  Timer,
  TrendingUp,
  UserCheck,
  UsersRound,
  Workflow,
  type LucideIcon
} from "lucide-react";
import {
  activityLogs,
  batches,
  campaigns,
  dashboardKpis,
  leadsSeed,
  payments,
  pipelineStages,
  revenuePoints,
  teamMembers,
  tickets,
  workshops
} from "@/lib/data";
import type { Campaign, Lead, LeadStage, ModuleKey, Payment, Workshop } from "@/lib/types";
import { cn, formatCurrency, formatNumber, initials, normalizeSearch } from "@/lib/utils";
import { ChangeEvent, useMemo, useRef, useState } from "react";

type Language = "EN" | "HI" | "GU";

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const navItems: NavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "crm", label: "CRM", icon: UsersRound, badge: "342" },
  { key: "sales", label: "Sales", icon: Target },
  { key: "workshops", label: "Workshops", icon: CalendarDays },
  { key: "funnels", label: "Funnels", icon: LayoutTemplate },
  { key: "payments", label: "Payments", icon: CreditCard, badge: "47" },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "team", label: "Team", icon: BriefcaseBusiness },
  { key: "ai", label: "AI Assistant", icon: Sparkles },
  { key: "settings", label: "Security", icon: ShieldCheck }
];

const favoriteItems: NavItem[] = [
  { key: "crm", label: "Hot Leads", icon: UserCheck },
  { key: "workshops", label: "Today's Workshops", icon: CalendarDays },
  { key: "payments", label: "Payment Recovery", icon: RefreshCw },
  { key: "reports", label: "Revenue Report", icon: FileSpreadsheet }
];

const stageNext: Record<LeadStage, LeadStage> = {
  "New Leads": "Contacted",
  Contacted: "Qualified",
  Qualified: "Proposal",
  Proposal: "Won",
  Won: "Won",
  Lost: "Lost"
};

const kpiIcons: Record<string, LucideIcon> = {
  "Revenue Today": TrendingUp,
  Leads: UsersRound,
  Registrations: ClipboardCheck,
  "Pending Payments": AlertCircle
};

const languageCopy: Record<Language, { greeting: string; search: string; role: string }> = {
  EN: {
    greeting: "Hi Arjun, your revenue engine is live.",
    search: "Universal Search",
    role: "CFL Admin"
  },
  HI: {
    greeting: "Namaste Arjun, growth control center ready.",
    search: "Mobile, lead, invoice search",
    role: "Admin"
  },
  GU: {
    greeting: "Kem cho Arjun, business pulse ready.",
    search: "Mobile, city, client search",
    role: "Founder"
  }
};

const filterLabels = [
  "Date range",
  "Country",
  "State",
  "City",
  "Workshop",
  "Batch",
  "Lead source",
  "Sales person",
  "Payment status",
  "Revenue range"
];

export function BusinessOS() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("home");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<Language>("EN");
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>(leadsSeed);
  const [selectedLeadId, setSelectedLeadId] = useState(leadsSeed[0].id);
  const [aiQuestion, setAiQuestion] = useState("Show Surat revenue this month");
  const [aiAnswer, setAiAnswer] = useState(answerFor("Show Surat revenue this month"));
  const [activePaymentFilter, setActivePaymentFilter] = useState<"All" | Payment["status"]>("All");
  const [actionNote, setActionNote] = useState("47 payment recovery reminders are queued for WhatsApp.");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0];

  const searchResults = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) {
      return [];
    }

    const leadMatches = leads
      .filter((lead) => {
        const haystack = normalizeSearch(
          `${lead.name} ${lead.mobile} ${lead.email} ${lead.city} ${lead.source} ${lead.assignedTo}`
        );
        return haystack.includes(normalized);
      })
      .slice(0, 5);

    const paymentMatches = payments
      .filter((payment) => {
        const haystack = normalizeSearch(
          `${payment.id} ${payment.clientName} ${payment.mobile} ${payment.workshop} ${payment.status}`
        );
        return haystack.includes(normalized);
      })
      .slice(0, 3);

    const workshopMatches = workshops
      .filter((workshop) => {
        const haystack = normalizeSearch(`${workshop.title} ${workshop.city} ${workshop.trainer}`);
        return haystack.includes(normalized);
      })
      .slice(0, 3);

    return [
      ...leadMatches.map((lead) => ({ kind: "Lead", id: lead.id, title: lead.name, meta: lead.mobile })),
      ...paymentMatches.map((payment) => ({
        kind: "Payment",
        id: payment.id,
        title: payment.clientName,
        meta: `${payment.id} · ${formatCurrency(payment.amount)}`
      })),
      ...workshopMatches.map((workshop) => ({
        kind: "Workshop",
        id: workshop.id,
        title: workshop.title,
        meta: `${workshop.city} · ${workshop.registrations}/${workshop.capacity}`
      }))
    ];
  }, [leads, query]);

  function runAIQuery(question: string) {
    setAiQuestion(question);
    setAiAnswer(answerFor(question));
    setActiveModule("ai");
  }

  function moveLeadForward(leadId: string) {
    setLeads((current) =>
      current.map((lead) => (lead.id === leadId ? { ...lead, stage: stageNext[lead.stage] } : lead))
    );
    setActionNote("Lead stage updated, next follow-up and AI script refreshed.");
  }

  function addLead() {
    const created: Lead = {
      id: `lead-${Date.now()}`,
      name: "New Walk-in Lead",
      mobile: "+91 90000 00000",
      email: "new.lead@example.com",
      city: "Surat",
      state: "Gujarat",
      country: "India",
      source: "Manual",
      stage: "New Leads",
      assignedTo: "Auto assign",
      score: 64,
      revenuePotential: 45000,
      notes: ["Created from quick add"],
      callHistory: [],
      whatsappHistory: ["Welcome template queued"],
      workshopsAttended: [],
      paymentHistory: [],
      certificates: [],
      familyAccounts: [],
      tags: ["Manual", "Needs qualification"],
      createdAt: "2026-04-25",
      nextFollowUp: "Today 6:30 PM",
      bestTime: "6 PM - 8 PM"
    };

    setLeads((current) => [created, ...current]);
    setSelectedLeadId(created.id);
    setActiveModule("crm");
    setActionNote("New lead created and placed into round-robin assignment.");
  }

  function exportLeads() {
    const headers = [
      "name",
      "mobile",
      "email",
      "city",
      "state",
      "country",
      "source",
      "stage",
      "assigned_to",
      "score",
      "revenue_potential"
    ];
    const rows = leads.map((lead) =>
      [
        lead.name,
        lead.mobile,
        lead.email,
        lead.city,
        lead.state,
        lead.country,
        lead.source,
        lead.stage,
        lead.assignedTo,
        String(lead.score),
        String(lead.revenuePotential)
      ]
        .map((value) => `"${value.replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cfl-os-leads-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setActionNote(`${formatNumber(leads.length)} leads exported with CRM fields.`);
  }

  function importLeads(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const imported = text
        .split(/\r?\n/)
        .slice(1)
        .map((line, index) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim()))
        .filter((cells) => cells[0] && cells[1])
        .map<Lead>((cells, index) => ({
          id: `import-${Date.now()}-${index}`,
          name: cells[0],
          mobile: cells[1],
          email: cells[2] || "imported@example.com",
          city: cells[3] || "Unknown",
          state: cells[4] || "Unknown",
          country: cells[5] || "India",
          source: cells[6] || "CSV Import",
          stage: "New Leads",
          assignedTo: "Auto assign",
          score: 58,
          revenuePotential: 30000,
          notes: ["Imported from CSV"],
          callHistory: [],
          whatsappHistory: ["Import welcome template queued"],
          workshopsAttended: [],
          paymentHistory: [],
          certificates: [],
          familyAccounts: [],
          tags: ["Imported"],
          createdAt: "2026-04-25",
          nextFollowUp: "Tomorrow 10:00 AM",
          bestTime: "10 AM - 12 PM"
        }));

      if (imported.length > 0) {
        setLeads((current) => [...imported, ...current]);
        setActionNote(`${formatNumber(imported.length)} imported leads indexed for mobile search.`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  const content = (
    <div className="flex min-h-screen bg-[#f7f8f4] text-ink-900 dark:bg-[#101513] dark:text-slate-100">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          actionNote={actionNote}
          addLead={addLead}
          exportLeads={exportLeads}
          importInputRef={importInputRef}
          importLeads={importLeads}
          language={language}
          query={query}
          runAIQuery={runAIQuery}
          searchResults={searchResults}
          selectedLead={selectedLead}
          setActiveModule={setActiveModule}
          setLanguage={setLanguage}
          setQuery={setQuery}
          setSelectedLeadId={setSelectedLeadId}
          setTheme={setTheme}
          theme={theme}
        />

        <MobileNav activeModule={activeModule} setActiveModule={setActiveModule} />

        <div className="grid min-h-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_302px] lg:p-5">
          <main className="min-w-0">{renderActiveModule()}</main>
          <RightRail runAIQuery={runAIQuery} setActiveModule={setActiveModule} />
        </div>
      </div>
    </div>
  );

  return <div className={cn(theme === "dark" && "dark")}>{content}</div>;

  function renderActiveModule() {
    switch (activeModule) {
      case "home":
        return (
          <DashboardHome
            activePaymentFilter={activePaymentFilter}
            leads={leads}
            moveLeadForward={moveLeadForward}
            selectedLeadId={selectedLeadId}
            setActiveModule={setActiveModule}
            setActivePaymentFilter={setActivePaymentFilter}
            setSelectedLeadId={setSelectedLeadId}
          />
        );
      case "crm":
        return (
          <CRMView
            leads={leads}
            moveLeadForward={moveLeadForward}
            selectedLead={selectedLead}
            setSelectedLeadId={setSelectedLeadId}
          />
        );
      case "sales":
        return <SalesView leads={leads} moveLeadForward={moveLeadForward} />;
      case "workshops":
        return <WorkshopsView />;
      case "funnels":
        return <FunnelsView />;
      case "payments":
        return (
          <PaymentsView
            activePaymentFilter={activePaymentFilter}
            setActivePaymentFilter={setActivePaymentFilter}
          />
        );
      case "marketing":
        return <MarketingView />;
      case "reports":
        return <ReportsView />;
      case "support":
        return <SupportView />;
      case "team":
        return <TeamView />;
      case "ai":
        return (
          <AIView
            aiAnswer={aiAnswer}
            aiQuestion={aiQuestion}
            runAIQuery={runAIQuery}
            setAiAnswer={setAiAnswer}
            setAiQuestion={setAiQuestion}
          />
        );
      case "settings":
        return <SecurityView language={language} />;
      default:
        return null;
    }
  }
}

function Sidebar({
  activeModule,
  setActiveModule
}: {
  activeModule: ModuleKey;
  setActiveModule: (module: ModuleKey) => void;
}) {
  return (
    <aside className="hidden w-[252px] shrink-0 border-r border-ink-900/10 bg-white/78 px-4 py-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-1">
        <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-mint-600 to-ai-500 text-sm font-black text-white shadow-soft">
          C
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight text-mint-700 dark:text-mint-100">CFL OS</p>
          <p className="text-xs text-ink-500 dark:text-slate-400">Business command center</p>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {navItems.map((item) => (
          <NavButton
            active={activeModule === item.key}
            item={item}
            key={item.key}
            onClick={() => setActiveModule(item.key)}
          />
        ))}
      </nav>

      <div className="mt-6 border-t border-ink-900/10 pt-4 dark:border-white/10">
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-slate-500">
          Favorites
        </p>
        <div className="mt-2 space-y-1">
          {favoriteItems.map((item) => (
            <NavButton
              active={false}
              compact
              item={item}
              key={item.label}
              onClick={() => setActiveModule(item.key)}
            />
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-lg border border-ink-900/10 bg-[#f8faf7] p-3 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-mint-100 text-sm font-bold text-mint-700">
            AS
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Arjun Sharma</p>
            <p className="text-xs text-ink-500 dark:text-slate-400">CFL Admin</p>
          </div>
          <ChevronDown className="ml-auto size-4 text-ink-500" />
        </div>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  compact,
  item,
  onClick
}: {
  active: boolean;
  compact?: boolean;
  item: NavItem;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      className={cn(
        "group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
        compact && "py-2 text-xs",
        active
          ? "border border-mint-500/20 bg-mint-50 text-mint-700 shadow-soft dark:bg-mint-500/10 dark:text-mint-100"
          : "text-ink-700 hover:bg-ink-900/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            active ? "bg-white text-mint-700 dark:bg-white/10" : "bg-ink-900/5 text-ink-500 dark:bg-white/10"
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </button>
  );
}

function TopBar({
  actionNote,
  addLead,
  exportLeads,
  importInputRef,
  importLeads,
  language,
  query,
  runAIQuery,
  searchResults,
  selectedLead,
  setActiveModule,
  setLanguage,
  setQuery,
  setSelectedLeadId,
  setTheme,
  theme
}: {
  actionNote: string;
  addLead: () => void;
  exportLeads: () => void;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  importLeads: (event: ChangeEvent<HTMLInputElement>) => void;
  language: Language;
  query: string;
  runAIQuery: (question: string) => void;
  searchResults: Array<{ kind: string; id: string; title: string; meta: string }>;
  selectedLead: Lead;
  setActiveModule: (module: ModuleKey) => void;
  setLanguage: (language: Language) => void;
  setQuery: (query: string) => void;
  setSelectedLeadId: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  theme: "light" | "dark";
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/10 bg-white/82 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#101513]/86 lg:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-mint-600 to-ai-500 text-sm font-black text-white">
            C
          </div>
          <span className="font-bold text-mint-700 dark:text-mint-100">CFL OS</span>
        </div>

        <div className="relative min-w-[260px] flex-1 md:max-w-[650px]">
          <div className="flex items-center gap-2 rounded-lg border border-ink-900/10 bg-white px-3 py-2 shadow-soft dark:border-white/10 dark:bg-white/[0.05]">
            <span className="hidden items-center gap-1 rounded-md bg-[#f4f7f1] px-2 py-1 text-xs font-semibold text-ink-700 dark:bg-white/10 dark:text-slate-200 sm:flex">
              <Globe2 className="size-3.5" />
              +91
            </span>
            <Search className="size-4 shrink-0 text-ink-500" />
            <input
              aria-label="Universal search"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-500 dark:placeholder:text-slate-500"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={languageCopy[language].search}
              value={query}
            />
            <kbd className="hidden rounded border border-ink-900/10 bg-[#f8faf7] px-2 py-0.5 text-xs text-ink-500 dark:border-white/10 dark:bg-white/5 md:block">
              ⌘ K
            </kbd>
          </div>

          {query ? (
            <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-lg border border-ink-900/10 bg-white shadow-panel dark:border-white/10 dark:bg-[#17201c]">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    className="flex w-full items-center gap-3 border-b border-ink-900/5 px-3 py-3 text-left transition last:border-0 hover:bg-mint-50 dark:border-white/5 dark:hover:bg-white/[0.06]"
                    key={`${result.kind}-${result.id}`}
                    onClick={() => {
                      if (result.kind === "Lead") {
                        setSelectedLeadId(result.id);
                        setActiveModule("crm");
                      }
                      if (result.kind === "Payment") {
                        setActiveModule("payments");
                      }
                      if (result.kind === "Workshop") {
                        setActiveModule("workshops");
                      }
                      setQuery("");
                    }}
                    type="button"
                  >
                    <span className="rounded-md bg-mint-50 px-2 py-1 text-xs font-semibold text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
                      {result.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{result.title}</span>
                      <span className="block truncate text-xs text-ink-500 dark:text-slate-400">{result.meta}</span>
                    </span>
                    <ArrowUpRight className="size-4 text-ink-400" />
                  </button>
                ))
              ) : (
                <div className="px-4 py-5 text-sm text-ink-500 dark:text-slate-400">
                  No match yet. Try mobile, city, invoice, source, or workshop.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input
            accept=".csv,text/csv"
            className="hidden"
            onChange={importLeads}
            ref={importInputRef}
            type="file"
          />
          <IconButton label="Import CSV" onClick={() => importInputRef.current?.click()}>
            <Import className="size-4" />
          </IconButton>
          <IconButton label="Export CSV" onClick={exportLeads}>
            <Download className="size-4" />
          </IconButton>
          <button
            aria-label="New Lead"
            className="flex items-center gap-2 rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-mint-700"
            onClick={addLead}
            type="button"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Lead</span>
          </button>
          <div className="hidden items-center rounded-lg border border-ink-900/10 bg-white p-1 dark:border-white/10 dark:bg-white/[0.05] md:flex">
            {(["EN", "HI", "GU"] as Language[]).map((item) => (
              <button
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-semibold transition",
                  language === item
                    ? "bg-ink-900 text-white dark:bg-white dark:text-ink-900"
                    : "text-ink-500 hover:text-ink-900 dark:text-slate-400 dark:hover:text-white"
                )}
                key={item}
                onClick={() => setLanguage(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <IconButton
            label="Theme"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </IconButton>
          <IconButton label="AI Command" onClick={() => runAIQuery("Summarize today's activities")}>
            <Bot className="size-4" />
          </IconButton>
          <IconButton label="Notifications">
            <Bell className="size-4" />
          </IconButton>
          <div className="hidden items-center gap-2 rounded-lg border border-ink-900/10 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05] xl:flex">
            <div className="grid size-8 place-items-center rounded-full bg-ink-900 text-xs font-bold text-white dark:bg-white dark:text-ink-900">
              AS
            </div>
            <div>
              <p className="text-xs font-semibold leading-none">Arjun</p>
              <p className="mt-1 text-[11px] text-ink-500 dark:text-slate-400">{languageCopy[language].role}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 hidden items-center justify-between text-xs text-ink-500 dark:text-slate-400 md:flex">
        <span>{languageCopy[language].greeting}</span>
        <span>{actionNote}</span>
        <span>Selected lead: {selectedLead.name}</span>
      </div>
    </header>
  );
}

function MobileNav({
  activeModule,
  setActiveModule
}: {
  activeModule: ModuleKey;
  setActiveModule: (module: ModuleKey) => void;
}) {
  return (
    <div className="scrollbar-thin flex gap-2 overflow-x-auto border-b border-ink-900/10 bg-white/70 px-4 py-2 dark:border-white/10 dark:bg-white/[0.03] lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold",
              activeModule === item.key
                ? "bg-mint-600 text-white"
                : "bg-white text-ink-700 dark:bg-white/[0.06] dark:text-slate-200"
            )}
            key={item.key}
            onClick={() => setActiveModule(item.key)}
            type="button"
          >
            <Icon className="size-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="grid size-10 place-items-center rounded-lg border border-ink-900/10 bg-white text-ink-700 shadow-soft transition hover:border-mint-500/30 hover:bg-mint-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.09]"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function DashboardHome({
  activePaymentFilter,
  leads,
  moveLeadForward,
  selectedLeadId,
  setActiveModule,
  setActivePaymentFilter,
  setSelectedLeadId
}: {
  activePaymentFilter: "All" | Payment["status"];
  leads: Lead[];
  moveLeadForward: (leadId: string) => void;
  selectedLeadId: string;
  setActiveModule: (module: ModuleKey) => void;
  setActivePaymentFilter: (filter: "All" | Payment["status"]) => void;
  setSelectedLeadId: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardKpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
        <Panel
          action={
            <button
              className="rounded-md border border-ink-900/10 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-900/[0.04] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
              onClick={() => setActiveModule("crm")}
              type="button"
            >
              View all
            </button>
          }
          icon={Filter}
          title="Pipeline"
        >
          <PipelineBoard
            leads={leads}
            moveLeadForward={moveLeadForward}
            selectedLeadId={selectedLeadId}
            setSelectedLeadId={setSelectedLeadId}
          />
        </Panel>

        <Panel
          action={<span className="text-xs font-medium text-ink-500 dark:text-slate-400">This Month</span>}
          title="Revenue Overview"
        >
          <RevenueOverview />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1.1fr)_minmax(320px,0.9fr)]">
        <WorkshopMiniPanel />
        <PaymentsMiniPanel
          activePaymentFilter={activePaymentFilter}
          setActiveModule={setActiveModule}
          setActivePaymentFilter={setActivePaymentFilter}
        />
        <LeaderboardPanel />
      </div>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: (typeof dashboardKpis)[number] }) {
  const Icon = kpiIcons[kpi.label] ?? Activity;
  const toneStyles = {
    mint: "bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100",
    ai: "bg-ai-50 text-ai-600 dark:bg-ai-500/10 dark:text-ai-100",
    saffron: "bg-saffron-50 text-saffron-600 dark:bg-saffron-500/10 dark:text-saffron-100",
    slate: "bg-ink-900/5 text-ink-700 dark:bg-white/10 dark:text-slate-100"
  }[kpi.tone];

  return (
    <div className="rounded-lg border border-ink-900/10 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-start gap-3">
        <div className={cn("grid size-12 place-items-center rounded-lg", toneStyles)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-700 dark:text-slate-200">{kpi.label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            <span className="text-xs font-bold text-mint-600 dark:text-mint-300">{kpi.delta}</span>
          </div>
          <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">{kpi.helper}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({
  action,
  children,
  icon: Icon,
  title
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-ink-900/10 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {Icon ? <Icon className="size-4 text-ink-400" /> : null}
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function PipelineBoard({
  leads,
  moveLeadForward,
  selectedLeadId,
  setSelectedLeadId
}: {
  leads: Lead[];
  moveLeadForward: (leadId: string) => void;
  selectedLeadId: string;
  setSelectedLeadId: (id: string) => void;
}) {
  return (
    <div className="scrollbar-thin grid min-h-[326px] auto-cols-[178px] grid-flow-col gap-2 overflow-x-auto pb-1">
      {pipelineStages.map((stage) => {
        const stageLeads = leads.filter((lead) => lead.stage === stage);
        const stageValue = stageLeads.reduce((sum, lead) => sum + lead.revenuePotential, 0);

        return (
          <div
            className="rounded-lg bg-gradient-to-b from-[#f7faf5] to-white p-2 dark:from-white/[0.06] dark:to-white/[0.025]"
            key={stage}
          >
            <div className="mb-3 flex items-start justify-between px-1">
              <div>
                <p className="text-xs font-bold">{stage}</p>
                <p className="mt-1 text-[11px] text-ink-500 dark:text-slate-400">
                  {formatCurrency(stageValue)}
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500 dark:bg-white/10 dark:text-slate-300">
                {stageLeads.length || Math.floor(Math.random() * 20 + 14)}
              </span>
            </div>
            <div className="space-y-2">
              {stageLeads.slice(0, 4).map((lead) => (
                <button
                  className={cn(
                    "w-full rounded-md border bg-white p-2 text-left shadow-[0_10px_24px_-22px_rgba(15,23,42,0.9)] transition hover:-translate-y-0.5 hover:border-mint-500/30 dark:bg-[#17201c]",
                    selectedLeadId === lead.id
                      ? "border-mint-500/50 ring-2 ring-mint-500/15"
                      : "border-ink-900/10 dark:border-white/10"
                  )}
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  type="button"
                >
                  <p className="truncate text-xs font-bold">{lead.name}</p>
                  <p className="mt-1 truncate text-[11px] text-ink-500 dark:text-slate-400">{lead.source}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold">{formatCurrency(lead.revenuePotential)}</span>
                    <span className="rounded-full bg-mint-50 px-1.5 py-0.5 text-[10px] font-bold text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
                      {lead.score}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {stageLeads[0] ? (
              <button
                className="mt-3 w-full rounded-md border border-dashed border-ink-900/15 py-2 text-[11px] font-semibold text-ink-500 hover:border-mint-500/40 hover:text-mint-700 dark:border-white/15 dark:text-slate-400"
                onClick={() => moveLeadForward(stageLeads[0].id)}
                type="button"
              >
                Move next best lead
              </button>
            ) : (
              <p className="mt-4 text-center text-[11px] text-ink-400">Automation queue empty</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RevenueOverview() {
  const total = revenuePoints.at(-1)?.revenue ?? 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight">{formatCurrency(total)}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">
            vs last month {formatCurrency(2472000)} · <span className="font-bold text-mint-600">+16.3%</span>
          </p>
        </div>
        <div className="flex gap-2">
          {["Workshops", "Coaching", "Products"].map((label, index) => (
            <div
              className="rounded-md border border-ink-900/10 px-3 py-2 text-xs dark:border-white/10"
              key={label}
            >
              <p className="text-ink-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 font-bold">{formatCurrency([1840000, 785400, 250000][index])}</p>
            </div>
          ))}
        </div>
      </div>
      <LineChart points={revenuePoints} />
    </div>
  );
}

function LineChart({ points }: { points: typeof revenuePoints }) {
  const width = 720;
  const height = 240;
  const padding = 24;
  const max = Math.max(...points.map((point) => point.revenue));
  const min = Math.min(...points.map((point) => point.revenue));
  const coordinates = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.revenue - min) / (max - min)) * (height - padding * 2);
    return { x, y, point };
  });
  const path = coordinates.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`).join(" ");
  const area = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="relative overflow-hidden rounded-lg border border-ink-900/10 bg-[#fbfcfa] dark:border-white/10 dark:bg-white/[0.03]">
      <svg className="h-[250px] w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10a37f" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10a37f" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            stroke="rgba(99, 115, 107, 0.18)"
            strokeDasharray="5 7"
            strokeWidth="1"
            x1={padding}
            x2={width - padding}
            y1={padding + line * 54}
            y2={padding + line * 54}
          />
        ))}
        <path d={area} fill="url(#revenue-fill)" />
        <path d={path} fill="none" stroke="#07876b" strokeLinecap="round" strokeWidth="4" />
        {coordinates.map((coord, index) =>
          index === 7 ? (
            <g key={coord.point.day}>
              <circle cx={coord.x} cy={coord.y} fill="#ffffff" r="8" stroke="#07876b" strokeWidth="4" />
              <line stroke="#07876b" strokeDasharray="4 6" x1={coord.x} x2={coord.x} y1={coord.y} y2={padding} />
              <rect
                fill="#ffffff"
                height="46"
                rx="8"
                stroke="rgba(15,23,42,0.12)"
                width="108"
                x={coord.x - 36}
                y={padding + 2}
              />
              <text fill="#63736b" fontSize="11" x={coord.x - 24} y={padding + 20}>
                22 May
              </text>
              <text fill="#18211d" fontSize="13" fontWeight="700" x={coord.x - 24} y={padding + 38}>
                ₹22,18,600
              </text>
            </g>
          ) : null
        )}
      </svg>
      <div className="absolute bottom-3 left-5 right-5 flex justify-between text-[11px] text-ink-500 dark:text-slate-400">
        {["1 May", "7 May", "13 May", "19 May", "25 May", "31 May"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
    </div>
  );
}

function WorkshopMiniPanel() {
  return (
    <Panel
      action={<button className="text-xs font-semibold text-ink-500 hover:text-mint-700">View Calendar</button>}
      title="Workshops"
    >
      <div className="mb-4 grid grid-cols-7 gap-1 text-center text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
          <div key={day}>
            <p className="text-ink-500 dark:text-slate-400">{day}</p>
            <p
              className={cn(
                "mx-auto mt-1 grid size-9 place-items-center rounded-md font-bold",
                index === 0 ? "bg-mint-600 text-white" : "bg-ink-900/5 dark:bg-white/10"
              )}
            >
              {19 + index}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {workshops.slice(0, 3).map((workshop, index) => (
          <div
            className="flex items-center gap-3 rounded-md border border-ink-900/10 p-3 dark:border-white/10"
            key={workshop.id}
          >
            <div className="text-xs font-semibold text-ink-500 dark:text-slate-400">
              {["09:30 AM", "01:00 PM", "04:00 PM"][index]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{workshop.title}</p>
              <p className="text-xs text-ink-500 dark:text-slate-400">{workshop.city}</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-mint-600">
                {workshop.registrations} / {workshop.capacity}
              </p>
              <p className="text-ink-500 dark:text-slate-400">Registrations</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PaymentsMiniPanel({
  activePaymentFilter,
  setActiveModule,
  setActivePaymentFilter
}: {
  activePaymentFilter: "All" | Payment["status"];
  setActiveModule: (module: ModuleKey) => void;
  setActivePaymentFilter: (filter: "All" | Payment["status"]) => void;
}) {
  const tabs: Array<"All" | Payment["status"]> = ["All", "Due", "Overdue", "Paid"];
  const filtered = activePaymentFilter === "All" ? payments : payments.filter((item) => item.status === activePaymentFilter);
  const outstanding = payments
    .filter((payment) => payment.status === "Due" || payment.status === "Overdue")
    .reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <Panel
      action={
        <button
          className="text-xs font-semibold text-ink-500 hover:text-mint-700"
          onClick={() => setActiveModule("payments")}
          type="button"
        >
          View all
        </button>
      }
      title="Payments"
    >
      <div className="mb-3 flex gap-2 border-b border-ink-900/10 dark:border-white/10">
        {tabs.map((tab) => (
          <button
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-xs font-semibold",
              activePaymentFilter === tab
                ? "border-mint-600 text-mint-700 dark:text-mint-100"
                : "border-transparent text-ink-500"
            )}
            key={tab}
            onClick={() => setActivePaymentFilter(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.slice(0, 5).map((payment) => (
          <PaymentRow key={payment.id} payment={payment} />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-ink-900/10 pt-3 text-sm dark:border-white/10">
        <span className="font-bold">Total Outstanding</span>
        <span className="font-bold text-saffron-600">{formatCurrency(outstanding)}</span>
      </div>
    </Panel>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const statusStyles: Record<Payment["status"], string> = {
    Paid: "bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100",
    Due: "bg-saffron-50 text-saffron-600 dark:bg-saffron-500/10 dark:text-saffron-100",
    Overdue: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-100",
    Failed: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-100",
    Refunded: "bg-ink-900/5 text-ink-500 dark:bg-white/10 dark:text-slate-300"
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-ink-900/10 p-2 text-xs dark:border-white/10">
      <div className="min-w-0">
        <p className="truncate font-semibold">{payment.id} · {payment.clientName}</p>
        <p className="truncate text-ink-500 dark:text-slate-400">{payment.workshop}</p>
      </div>
      <div className="text-right">
        <p className="font-bold">{formatCurrency(payment.amount)}</p>
        <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold", statusStyles[payment.status])}>
          {payment.status === "Overdue" ? `Overdue ${Math.abs(payment.dueInDays)} days` : payment.status}
        </span>
      </div>
    </div>
  );
}

function LeaderboardPanel() {
  return (
    <Panel action={<span className="text-xs text-ink-500 dark:text-slate-400">This Month</span>} title="Sales Leaderboard">
      <div className="space-y-3">
        {teamMembers.map((member, index) => (
          <div className="flex items-center gap-3" key={member.id}>
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-xs font-black",
                index < 3 ? "bg-saffron-50 text-saffron-600" : "bg-ink-900/5 text-ink-500 dark:bg-white/10"
              )}
            >
              {index + 1}
            </span>
            <div className="grid size-8 place-items-center rounded-full bg-ink-900/5 text-xs font-bold dark:bg-white/10">
              {initials(member.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{member.name}</p>
              <p className="text-xs text-ink-500 dark:text-slate-400">{member.conversions} conversions</p>
            </div>
            <p className="text-sm font-bold">{formatCurrency(member.achieved)}</p>
          </div>
        ))}
      </div>
      <button className="mt-4 w-full rounded-md border border-ink-900/10 py-2 text-xs font-semibold hover:bg-ink-900/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]">
        View full leaderboard
      </button>
    </Panel>
  );
}

function RightRail({
  runAIQuery,
  setActiveModule
}: {
  runAIQuery: (question: string) => void;
  setActiveModule: (module: ModuleKey) => void;
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-[96px] lg:self-start">
      <Panel
        action={<span className="rounded-md bg-ai-50 px-2 py-1 text-[11px] font-bold text-ai-600 dark:bg-ai-500/10 dark:text-ai-100">New</span>}
        title="AI Founder Assistant"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold">Hi Arjun</p>
          <p className="text-sm text-ink-500 dark:text-slate-400">Revenue, teams, workshops, campaigns, and unpaid clients are indexed.</p>
          {[
            "Show me revenue trend",
            "Which workshops are underperforming?",
            "List overdue payments",
            "Summarize today's activities"
          ].map((question) => (
            <button
              className="flex w-full items-center gap-2 rounded-md border border-ink-900/10 px-3 py-2 text-left text-xs font-semibold text-ink-700 transition hover:border-ai-500/30 hover:bg-ai-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-ai-500/10"
              key={question}
              onClick={() => runAIQuery(question)}
              type="button"
            >
              <Sparkles className="size-3.5 text-ai-500" />
              {question}
            </button>
          ))}
          <button
            className="mt-1 flex w-full items-center justify-between rounded-md border border-ink-900/10 px-3 py-2 text-sm text-ink-500 dark:border-white/10 dark:text-slate-400"
            onClick={() => setActiveModule("ai")}
            type="button"
          >
            Ask anything...
            <Send className="size-4 text-ink-700 dark:text-slate-200" />
          </button>
        </div>
      </Panel>

      <Panel
        action={<button className="text-xs font-semibold text-ink-500 hover:text-mint-700">View all</button>}
        title="Upcoming Workshops"
      >
        <div className="space-y-3">
          {workshops.slice(0, 3).map((workshop) => {
            const date = new Date(workshop.startDate);
            return (
              <div className="grid grid-cols-[38px_1fr_auto] gap-3 border-b border-ink-900/10 pb-3 last:border-0 last:pb-0 dark:border-white/10" key={workshop.id}>
                <div className="text-center">
                  <p className="text-xl font-bold">{date.getDate()}</p>
                  <p className="text-xs text-ink-500 dark:text-slate-400">May</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{workshop.title}</p>
                  <p className="text-xs text-ink-500 dark:text-slate-400">{workshop.city}</p>
                </div>
                <p className="text-xs font-bold">
                  {workshop.registrations} / {workshop.capacity}
                </p>
              </div>
            );
          })}
          <p className="text-center text-xs text-ink-500 dark:text-slate-400">+ 6 more workshops</p>
        </div>
      </Panel>

      <Panel
        action={<button className="text-xs font-semibold text-ink-500 hover:text-mint-700">View all</button>}
        title="Active Automations"
      >
        <div className="space-y-3">
          {campaigns.slice(0, 4).map((campaign) => (
            <div className="flex items-center gap-3 border-b border-ink-900/10 pb-3 last:border-0 dark:border-white/10" key={campaign.id}>
              <Workflow className="size-4 text-mint-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{campaign.name}</p>
              </div>
              <span className="rounded-full border border-mint-500/30 px-2 py-0.5 text-[11px] font-bold text-mint-700 dark:text-mint-100">
                {campaign.status}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </aside>
  );
}

function ModuleHeader({
  actions,
  eyebrow,
  icon: Icon,
  title
}: {
  actions?: React.ReactNode;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="mb-4 rounded-lg border border-ink-900/10 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500 dark:text-slate-400">{eyebrow}</p>
            <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{title}</h1>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      </div>
    </div>
  );
}

function CRMView({
  leads,
  moveLeadForward,
  selectedLead,
  setSelectedLeadId
}: {
  leads: Lead[];
  moveLeadForward: (leadId: string) => void;
  selectedLead: Lead;
  setSelectedLeadId: (id: string) => void;
}) {
  const hotLeads = leads.filter((lead) => lead.score >= 80);

  return (
    <div>
      <ModuleHeader
        actions={
          <div className="flex gap-2">
            <button className="rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10" type="button">
              Duplicate merge
            </button>
            <button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white" type="button">
              Assign leads
            </button>
          </div>
        }
        eyebrow="CRM system"
        icon={UsersRound}
        title="Contacts, history, scores, and family accounts"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          action={<span className="text-xs font-semibold text-mint-600">{hotLeads.length} hot leads</span>}
          title="Lead Database"
        >
          <div className="mb-4 grid gap-2 md:grid-cols-5">
            {["All stages", "Gujarat", "Instagram Ads", "Neha Kapoor", "Due payment"].map((filter) => (
              <button
                className="rounded-md border border-ink-900/10 px-3 py-2 text-left text-xs font-semibold text-ink-600 hover:bg-ink-900/[0.04] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                key={filter}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-ink-900/10 dark:border-white/10">
            <div className="grid grid-cols-[1.3fr_120px_115px_115px_88px] bg-[#f6f8f4] px-3 py-2 text-xs font-bold text-ink-500 dark:bg-white/[0.05] dark:text-slate-400">
              <span>Contact</span>
              <span>City</span>
              <span>Stage</span>
              <span>Owner</span>
              <span className="text-right">Score</span>
            </div>
            {leads.map((lead) => (
              <button
                className={cn(
                  "grid w-full grid-cols-[1.3fr_120px_115px_115px_88px] items-center border-t border-ink-900/10 px-3 py-3 text-left text-sm transition hover:bg-mint-50/70 dark:border-white/10 dark:hover:bg-white/[0.06]",
                  selectedLead.id === lead.id && "bg-mint-50 dark:bg-mint-500/10"
                )}
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{lead.name}</span>
                  <span className="block truncate text-xs text-ink-500 dark:text-slate-400">{lead.mobile}</span>
                </span>
                <span className="text-xs">{lead.city}</span>
                <span>
                  <StatusPill label={lead.stage} />
                </span>
                <span className="truncate text-xs">{lead.assignedTo}</span>
                <span className="text-right font-bold text-mint-700 dark:text-mint-100">{lead.score}</span>
              </button>
            ))}
          </div>
        </Panel>

        <LeadProfile lead={selectedLead} moveLeadForward={moveLeadForward} />
      </div>
    </div>
  );
}

function LeadProfile({ lead, moveLeadForward }: { lead: Lead; moveLeadForward: (leadId: string) => void }) {
  return (
    <section className="rounded-lg border border-ink-900/10 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-start gap-3">
        <div className="grid size-12 place-items-center rounded-full bg-ink-900 text-sm font-bold text-white dark:bg-white dark:text-ink-900">
          {initials(lead.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{lead.name}</h2>
          <p className="text-sm text-ink-500 dark:text-slate-400">{lead.mobile}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lead.tags.map((tag) => (
              <span className="rounded-full bg-ink-900/5 px-2 py-1 text-[11px] font-semibold text-ink-600 dark:bg-white/10 dark:text-slate-300" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <button className="rounded-md border border-ink-900/10 p-2 dark:border-white/10" type="button">
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricTile label="Lead score" value={`${lead.score}/100`} />
        <MetricTile label="Potential" value={formatCurrency(lead.revenuePotential)} />
        <MetricTile label="Best time" value={lead.bestTime} />
        <MetricTile label="Follow-up" value={lead.nextFollowUp} />
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white" type="button">
          <MessageCircle className="size-4" />
          WhatsApp
        </button>
        <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10" type="button">
          <Phone className="size-4" />
          Call
        </button>
      </div>

      <button
        className="mt-3 w-full rounded-lg border border-ai-500/20 bg-ai-50 px-3 py-2 text-sm font-bold text-ai-600 transition hover:bg-ai-100 dark:bg-ai-500/10 dark:text-ai-100"
        onClick={() => moveLeadForward(lead.id)}
        type="button"
      >
        Move to {stageNext[lead.stage]} with AI follow-up
      </button>

      <div className="mt-5 space-y-4">
        <TimelineBlock icon={Clock3} title="Notes timeline" values={lead.notes} />
        <TimelineBlock icon={Phone} title="Call history" values={lead.callHistory.length ? lead.callHistory : ["No call logged yet"]} />
        <TimelineBlock icon={MessageCircle} title="WhatsApp history" values={lead.whatsappHistory} />
        <TimelineBlock icon={ReceiptText} title="Payment history" values={lead.paymentHistory.length ? lead.paymentHistory : ["No payment yet"]} />
        <TimelineBlock icon={BadgeCheck} title="Certificates" values={lead.certificates.length ? lead.certificates : ["No certificate issued"]} />
      </div>
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink-900/10 bg-[#f8faf7] p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function TimelineBlock({ icon: Icon, title, values }: { icon: LucideIcon; title: string; values: string[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4 text-mint-600" />
        {title}
      </div>
      <div className="space-y-2">
        {values.map((value) => (
          <div className="rounded-md bg-ink-900/[0.035] px-3 py-2 text-xs text-ink-600 dark:bg-white/[0.05] dark:text-slate-300" key={value}>
            {value}
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesView({
  leads,
  moveLeadForward
}: {
  leads: Lead[];
  moveLeadForward: (leadId: string) => void;
}) {
  const bestLeads = [...leads].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">Create target</button>}
        eyebrow="Sales system"
        icon={Target}
        title="Auto assignment, incentives, reminders, and conversion focus"
      />

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel title="AI Best Lead Suggestions">
          <div className="space-y-3">
            {bestLeads.map((lead) => (
              <div className="flex items-center gap-3 rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={lead.id}>
                <div className="grid size-10 place-items-center rounded-full bg-mint-50 text-sm font-bold text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
                  {lead.score}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{lead.name}</p>
                  <p className="truncate text-xs text-ink-500 dark:text-slate-400">
                    {lead.city} · {lead.source} · {lead.bestTime}
                  </p>
                </div>
                <button
                  className="rounded-md border border-ink-900/10 px-3 py-2 text-xs font-bold hover:bg-mint-50 dark:border-white/10"
                  onClick={() => moveLeadForward(lead.id)}
                  type="button"
                >
                  Advance
                </button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Team Performance Dashboard">
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div key={member.id}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold">{member.name}</span>
                  <span className="text-ink-500 dark:text-slate-400">
                    {formatCurrency(member.achieved)} / {formatCurrency(member.target)}
                  </span>
                </div>
                <ProgressBar value={(member.achieved / member.target) * 100} />
                <div className="mt-1 flex justify-between text-xs text-ink-500 dark:text-slate-400">
                  <span>{member.calls} calls</span>
                  <span>{member.conversions} wins</span>
                  <span>{formatCurrency(member.incentives)} incentive</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Round Robin Assignment">
          <div className="grid gap-3 md:grid-cols-3">
            {["New web leads", "Corporate inquiries", "Payment retry leads"].map((queue, index) => (
              <div className="rounded-lg border border-ink-900/10 p-4 dark:border-white/10" key={queue}>
                <p className="font-bold">{queue}</p>
                <p className="mt-2 text-3xl font-bold">{[72, 18, 47][index]}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">auto distributed by city and workload</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Follow-up Command Queue">
          <div className="grid gap-2 md:grid-cols-2">
            {leads.slice(0, 6).map((lead) => (
              <div className="rounded-md border border-ink-900/10 p-3 dark:border-white/10" key={lead.id}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{lead.name}</p>
                  <StatusPill label={lead.stage} />
                </div>
                <p className="mt-2 text-xs text-ink-500 dark:text-slate-400">{lead.nextFollowUp} · {lead.bestTime}</p>
                <p className="mt-2 rounded-md bg-ai-50 px-2 py-1.5 text-xs text-ai-600 dark:bg-ai-500/10 dark:text-ai-100">
                  Script: open with outcome, share 2-seat bonus, close with payment link.
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function WorkshopsView() {
  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">Create workshop</button>}
        eyebrow="Workshop management"
        icon={CalendarDays}
        title="Workshops, batches, capacity, waitlist, QR attendance, and feedback"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Panel title="Live Workshop Portfolio">
          <div className="grid gap-3 md:grid-cols-2">
            {workshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </div>
        </Panel>
        <Panel title="Batch and Attendance Control">
          <div className="space-y-3">
            {batches.map((batch) => {
              const workshop = workshops.find((item) => item.id === batch.workshopId);
              return (
                <div className="rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={batch.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{batch.name}</p>
                      <p className="text-xs text-ink-500 dark:text-slate-400">{workshop?.title} · {batch.startDate}</p>
                    </div>
                    <QrCode className="size-5 text-mint-600" />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={batch.attendanceRate} />
                    <span className="text-sm font-bold">{batch.attendanceRate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Auto Next Workshop Upsell">
          <div className="grid gap-3 md:grid-cols-3">
            {["Completed attendees", "High feedback", "Repeat buyers"].map((segment, index) => (
              <div className="rounded-lg border border-ink-900/10 p-4 dark:border-white/10" key={segment}>
                <p className="text-sm font-bold">{segment}</p>
                <p className="mt-2 text-2xl font-bold">{[1840, 1120, 418][index]}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">eligible for next offer</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function WorkshopCard({ workshop }: { workshop: Workshop }) {
  return (
    <div className="rounded-lg border border-ink-900/10 p-4 transition hover:-translate-y-0.5 hover:border-mint-500/30 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{workshop.title}</p>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
            {workshop.type} · {workshop.city} · {workshop.trainer}
          </p>
        </div>
        <StatusPill label={workshop.status} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <MetricTile label="Seats" value={`${workshop.registrations}/${workshop.capacity}`} />
        <MetricTile label="Waitlist" value={String(workshop.waitlist)} />
        <MetricTile label="Revenue" value={formatCurrency(workshop.revenue)} />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-ink-500 dark:text-slate-400">
          <span>Capacity</span>
          <span>{Math.round((workshop.registrations / workshop.capacity) * 100)}%</span>
        </div>
        <ProgressBar value={(workshop.registrations / workshop.capacity) * 100} />
      </div>
    </div>
  );
}

function FunnelsView() {
  const featured = workshops[0];

  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">Publish page</button>}
        eyebrow="Registration funnels"
        icon={LayoutTemplate}
        title="Landing pages with coupons, payments, WhatsApp, FAQ, and thank-you flows"
      />

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="Funnel Controls">
          <div className="space-y-3">
            {["Hero copy", "Testimonials", "Countdown", "Coupon box", "Razorpay button", "FAQ", "WhatsApp support", "Thank you page"].map((item) => (
              <div className="flex items-center justify-between rounded-md border border-ink-900/10 p-3 dark:border-white/10" key={item}>
                <span className="text-sm font-semibold">{item}</span>
                <CheckCircle2 className="size-4 text-mint-600" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Live Landing Page Preview">
          <div className="overflow-hidden rounded-lg border border-ink-900/10 bg-[#f7f4ee] dark:border-white/10 dark:bg-white/[0.04]">
            <div className="grid gap-5 p-5 md:grid-cols-[1fr_340px]">
              <div>
                <span className="rounded-full bg-mint-600 px-3 py-1 text-xs font-bold text-white">Live workshop</span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight">{featured.title}</h2>
                <p className="mt-3 text-sm text-ink-600 dark:text-slate-300">
                  Build leadership clarity, communication confidence, and execution discipline in a focused hybrid cohort.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MetricTile label="Starts" value="21 May" />
                  <MetricTile label="Seats left" value={String(featured.capacity - featured.registrations)} />
                  <MetricTile label="Rating" value={`${featured.feedbackScore}/5`} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-ink-900">
                    Pay {formatCurrency(featured.price)}
                  </button>
                  <button className="rounded-lg border border-ink-900/10 px-4 py-2 text-sm font-bold dark:border-white/10">
                    WhatsApp support
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-soft dark:bg-[#17201c]">
                <div className="flex items-center justify-between">
                  <p className="font-bold">Registration</p>
                  <span className="rounded-full bg-saffron-50 px-2 py-1 text-xs font-bold text-saffron-600">
                    CFL20
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {["Name", "Mobile", "Email", "City"].map((field) => (
                    <div className="rounded-md border border-ink-900/10 px-3 py-2 text-sm text-ink-500 dark:border-white/10 dark:text-slate-400" key={field}>
                      {field}
                    </div>
                  ))}
                </div>
                <button className="mt-4 w-full rounded-lg bg-mint-600 py-2.5 text-sm font-bold text-white">
                  Register with Razorpay
                </button>
                <p className="mt-3 text-center text-xs text-ink-500 dark:text-slate-400">Secure payment · GST invoice · instant confirmation</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PaymentsView({
  activePaymentFilter,
  setActivePaymentFilter
}: {
  activePaymentFilter: "All" | Payment["status"];
  setActivePaymentFilter: (filter: "All" | Payment["status"]) => void;
}) {
  const tabs: Array<"All" | Payment["status"]> = ["All", "Due", "Overdue", "Failed", "Paid", "Refunded"];
  const filtered = activePaymentFilter === "All" ? payments : payments.filter((payment) => payment.status === activePaymentFilter);

  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">Create payment link</button>}
        eyebrow="Payment system"
        icon={CreditCard}
        title="Razorpay, part payments, refunds, GST invoices, retries, and recovery"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.82fr]">
        <Panel title="Payment Recovery Flow">
          <div className="mb-3 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-bold",
                  activePaymentFilter === tab
                    ? "border-mint-500 bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
                    : "border-ink-900/10 text-ink-500 dark:border-white/10 dark:text-slate-400"
                )}
                key={tab}
                onClick={() => setActivePaymentFilter(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </div>
        </Panel>

        <Panel title="Razorpay and GST Control">
          <div className="grid gap-3">
            {([
              ["Signature verify", "Webhook security active", ShieldCheck],
              ["Installments", "8 active part-payment plans", Timer],
              ["Refunds", "3 requests need approval", RefreshCw],
              ["GST invoices", "Auto serial and tax split ready", ReceiptText],
              ["Failed recovery", "WhatsApp + SMS retry in 30 min", AlertCircle]
            ] satisfies Array<[string, string, LucideIcon]>).map(([title, helper, Icon]) => {
              const TypedIcon = Icon as LucideIcon;
              return (
                <div className="flex items-center gap-3 rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={String(title)}>
                  <div className="grid size-10 place-items-center rounded-lg bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
                    <TypedIcon className="size-5" />
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-xs text-ink-500 dark:text-slate-400">{helper}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MarketingView() {
  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">New campaign</button>}
        eyebrow="Marketing engine"
        icon={Megaphone}
        title="Bulk WhatsApp, email, SMS, drips, referrals, and rejoin campaigns"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        <Panel title="Campaign Performance">
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <CampaignRow campaign={campaign} key={campaign.id} />
            ))}
          </div>
        </Panel>
        <Panel title="Smart Segments">
          <div className="grid gap-3">
            {[
              ["Hot city opportunity", "Surat repeat clients with score 70+", 1840],
              ["Cart abandonment", "Payment page visitors without payment", 317],
              ["Likely rejoin users", "Attended 2+ workshops, no purchase in 90 days", 612],
              ["Festival offer audience", "Gujarati/Hindi preference and last active 30 days", 4200]
            ].map(([title, helper, count]) => (
              <div className="rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={String(title)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{title}</p>
                  <span className="rounded-full bg-ai-50 px-2 py-1 text-xs font-bold text-ai-600 dark:bg-ai-500/10 dark:text-ai-100">
                    {formatNumber(Number(count))}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">{helper}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Drip Automation Builder">
          <div className="grid gap-3 md:grid-cols-5">
            {["Lead captured", "WhatsApp welcome", "Email proof", "Payment retry", "Sales task"].map((step, index) => (
              <div className="relative rounded-lg border border-ink-900/10 p-3 text-center dark:border-white/10" key={step}>
                <div className="mx-auto grid size-10 place-items-center rounded-full bg-mint-50 font-bold text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
                  {index + 1}
                </div>
                <p className="mt-2 text-xs font-bold">{step}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  return (
    <div className="grid gap-3 rounded-lg border border-ink-900/10 p-3 dark:border-white/10 md:grid-cols-[1fr_110px_110px_130px] md:items-center">
      <div className="min-w-0">
        <p className="truncate font-bold">{campaign.name}</p>
        <p className="text-xs text-ink-500 dark:text-slate-400">{campaign.type} · {campaign.audience}</p>
      </div>
      <MetricTile label="Sent" value={formatNumber(campaign.sent)} />
      <MetricTile label="Conversion" value={`${campaign.conversion}%`} />
      <MetricTile label="Revenue" value={formatCurrency(campaign.revenue)} />
    </div>
  );
}

function ReportsView() {
  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">Export report</button>}
        eyebrow="Reports center"
        icon={BarChart3}
        title="Daily, sales, revenue, workshop, city, repeat client, and failed payment reports"
      />

      <div className="space-y-4">
        <Panel title="Advanced Filters">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {filterLabels.map((filter) => (
              <button
                className="flex items-center justify-between rounded-md border border-ink-900/10 px-3 py-2 text-left text-xs font-bold text-ink-600 dark:border-white/10 dark:text-slate-300"
                key={filter}
                type="button"
              >
                {filter}
                <ChevronDown className="size-3.5" />
              </button>
            ))}
          </div>
        </Panel>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {([
            ["Sales report", formatCurrency(2875000), "+16.3%", TrendingUp],
            ["Workshop report", "101 active", "+8.1%", CalendarDays],
            ["Repeat clients", "31%", "+4.2%", RefreshCw],
            ["Failed payments", "47", "-9.8%", AlertCircle]
          ] satisfies Array<[string, string, string, LucideIcon]>).map(([title, value, delta, Icon]) => {
            const TypedIcon = Icon as LucideIcon;
            return (
              <div className="rounded-lg border border-ink-900/10 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.045]" key={String(title)}>
                <TypedIcon className="size-5 text-mint-600" />
                <p className="mt-3 text-sm font-semibold text-ink-500 dark:text-slate-400">{title}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
                <p className="mt-1 text-xs font-bold text-mint-600">{delta}</p>
              </div>
            );
          })}
        </div>
        <Panel title="City / State / Country Growth">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Surat", 842700, 22],
              ["Mumbai", 685000, 18],
              ["Delhi", 621400, 14],
              ["Bengaluru", 492000, 11]
            ].map(([city, revenue, growth]) => (
              <div className="rounded-lg border border-ink-900/10 p-4 dark:border-white/10" key={String(city)}>
                <p className="font-bold">{city}</p>
                <p className="mt-2 text-xl font-bold">{formatCurrency(Number(revenue))}</p>
                <p className="mt-1 text-xs font-bold text-mint-600">+{growth}% opportunity</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SupportView() {
  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">New ticket</button>}
        eyebrow="Support system"
        icon={LifeBuoy}
        title="Tickets, complaints, refunds, priority support, and satisfaction"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Panel title="Ticketing Queue">
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div className="rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={ticket.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{ticket.id}</p>
                  <StatusPill label={ticket.priority} />
                  <StatusPill label={ticket.status} />
                </div>
                <p className="mt-2 font-semibold">{ticket.subject}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">
                  {ticket.client} · owner {ticket.owner} · satisfaction {ticket.satisfaction}/5
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Support Health">
          <div className="grid gap-3">
            <MetricTile label="Open complaints" value="18" />
            <MetricTile label="Refund requests" value="3 urgent" />
            <MetricTile label="Avg response" value="11 min" />
            <MetricTile label="Satisfaction" value="4.6 / 5" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TeamView() {
  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">Assign task</button>}
        eyebrow="Team management"
        icon={BriefcaseBusiness}
        title="Staff records, roles, attendance, incentives, salary notes, and tasks"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Panel title="Staff Records">
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div className="grid gap-3 rounded-lg border border-ink-900/10 p-3 dark:border-white/10 md:grid-cols-[1fr_120px_120px_120px] md:items-center" key={member.id}>
                <div>
                  <p className="font-bold">{member.name}</p>
                  <p className="text-xs text-ink-500 dark:text-slate-400">{member.role} · {member.city}</p>
                </div>
                <MetricTile label="Attendance" value={`${member.attendance}%`} />
                <MetricTile label="Calls" value={String(member.calls)} />
                <MetricTile label="Incentive" value={formatCurrency(member.incentives)} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Role Permissions">
          <div className="space-y-3">
            {[
              ["Founder", "All modules, billing, tenant settings"],
              ["Sales Lead", "CRM, sales, payments, campaigns"],
              ["Trainer", "Workshops, batches, attendance, feedback"],
              ["Support", "Tickets, refunds, client history"]
            ].map(([role, permissions]) => (
              <div className="rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={role}>
                <p className="font-bold">{role}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">{permissions}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AIView({
  aiAnswer,
  aiQuestion,
  runAIQuery,
  setAiAnswer,
  setAiQuestion
}: {
  aiAnswer: string;
  aiQuestion: string;
  runAIQuery: (question: string) => void;
  setAiAnswer: (answer: string) => void;
  setAiQuestion: (question: string) => void;
}) {
  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-ai-600 px-3 py-2 text-sm font-semibold text-white">Save insight</button>}
        eyebrow="Advanced AI features"
        icon={Sparkles}
        title="Sales Brain, Growth Brain, Customer Brain, and Founder Assistant"
      />

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Natural Language Query">
          <div className="space-y-2">
            {[
              "Show Surat revenue this month",
              "Which salesperson weak this week",
              "Show unpaid clients above ₹5000",
              "Best campaign in last 30 days"
            ].map((question) => (
              <button
                className="w-full rounded-md border border-ink-900/10 px-3 py-2 text-left text-sm font-semibold hover:bg-ai-50 dark:border-white/10 dark:hover:bg-ai-500/10"
                key={question}
                onClick={() => runAIQuery(question)}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-ink-900/10 p-2 dark:border-white/10">
            <textarea
              className="h-24 w-full resize-none bg-transparent p-2 text-sm outline-none"
              onChange={(event) => setAiQuestion(event.target.value)}
              value={aiQuestion}
            />
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md bg-ai-600 px-3 py-2 text-sm font-bold text-white"
              onClick={() => setAiAnswer(answerFor(aiQuestion))}
              type="button"
            >
              <Command className="size-4" />
              Run query
            </button>
          </div>
        </Panel>
        <Panel title="AI Answer">
          <div className="rounded-lg border border-ai-500/20 bg-ai-50 p-4 text-ai-950 dark:bg-ai-500/10 dark:text-ai-50">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ai-600 dark:text-ai-100">Founder answer</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6">{aiAnswer}</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["AI Sales Brain", "Likely convert, best time, suggested script"],
              ["AI Growth Brain", "City opportunity, weak workshops, revenue prediction"],
              ["AI Customer Brain", "Likely rejoin, churn risk, upsell timing"]
            ].map(([title, helper]) => (
              <div className="rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={title}>
                <Bot className="size-5 text-ai-600" />
                <p className="mt-2 font-bold">{title}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">{helper}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SecurityView({ language }: { language: Language }) {
  return (
    <div>
      <ModuleHeader
        actions={<button className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white">Review audit log</button>}
        eyebrow="Security and SaaS readiness"
        icon={ShieldCheck}
        title="OTP auth, role access, audit logs, payment security, backups, and tenant controls"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.86fr]">
        <Panel title="Security Controls">
          <div className="grid gap-3 md:grid-cols-2">
            {([
              ["OTP login", "Custom OTP, Clerk, or Auth.js ready", LockKeyhole],
              ["2FA ready", "Device and IP tracking planned", ShieldCheck],
              ["Payment verify", "Razorpay signature verification", CreditCard],
              ["Daily backups", "Postgres snapshots and R2 exports", Database],
              ["Audit logs", "Every write action captured", Activity],
              ["Multi language", `${language} active, EN/HI/GU supported`, Languages]
            ] satisfies Array<[string, string, LucideIcon]>).map(([title, helper, Icon]) => {
              const TypedIcon = Icon as LucideIcon;
              return (
                <div className="rounded-lg border border-ink-900/10 p-4 dark:border-white/10" key={String(title)}>
                  <TypedIcon className="size-5 text-mint-600" />
                  <p className="mt-2 font-bold">{title}</p>
                  <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">{helper}</p>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Activity Logs">
          <div className="space-y-3">
            {activityLogs.map((log) => (
              <div className="rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={log.id}>
                <p className="font-bold">{log.actor}</p>
                <p className="mt-1 text-sm">{log.action}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">{log.meta} · {log.createdAt}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-900/10 dark:bg-white/10">
      <div className="h-full rounded-full bg-mint-600" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  const styles =
    label.includes("Overdue") || label === "Urgent" || label === "Failed"
      ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-100"
      : label === "Due" || label === "High"
        ? "bg-saffron-50 text-saffron-600 dark:bg-saffron-500/10 dark:text-saffron-100"
        : label === "Won" || label === "Paid" || label === "Live" || label === "Resolved"
          ? "bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
          : "bg-ink-900/5 text-ink-600 dark:bg-white/10 dark:text-slate-300";

  return <span className={cn("inline-flex rounded-full px-2 py-1 text-[11px] font-bold", styles)}>{label}</span>;
}

function answerFor(question: string) {
  const normalized = question.toLowerCase();

  if (normalized.includes("surat")) {
    return "Surat revenue is ₹8,42,700 this month, up 22% versus the previous period. The strongest source is Instagram Ads, and the best next move is a WhatsApp rejoin campaign for 1,840 warm contacts with score above 70.";
  }

  if (normalized.includes("salesperson") || normalized.includes("weak")) {
    return "Kavya Rao needs attention this week: 85% of target, 11 conversions, and 89% attendance. The issue is not lead volume; conversion drops after the first call. Assign Neha's follow-up script and review 10 call notes today.";
  }

  if (normalized.includes("unpaid") || normalized.includes("overdue") || normalized.includes("payment")) {
    return "There are 47 unpaid invoices in the recovery queue. Highest priority: Rohan Mehta ₹2,10,000 overdue 3 days, BrightWave Ltd. ₹85,000 overdue 7 days, GlobalSoft HR ₹45,000 due in 3 days. Send Razorpay retry links plus GST invoice copy.";
  }

  if (normalized.includes("campaign") || normalized.includes("last 30")) {
    return "The best campaign in the last 30 days is Workshop Follow-up on WhatsApp. It converted 18.4% and attributed ₹6,85,000 revenue. Clone it for Mindset Mastery attendees and add a 48-hour coupon.";
  }

  if (normalized.includes("workshop")) {
    return "Communication Skills is underperforming on seat fill: 18/25 registrations and 3 waitlist holds. Push Pune lookalike leads, add trainer proof to the funnel, and run payment reminders for interested clients.";
  }

  return "Today: 342 leads, 128 registrations, ₹8,42,700 revenue, and ₹6,21,400 pending payments. AI recommends calling 5 high-score corporate leads before 6 PM and triggering the payment recovery automation for 47 invoices.";
}
