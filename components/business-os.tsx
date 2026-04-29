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
  Menu,
  Moon,
  MoreHorizontal,
  Eye,
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
  X,
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
import type { Campaign, Lead, LeadStage, ModuleKey, Payment, RegistrationEntry, Workshop } from "@/lib/types";
import { cn, formatCurrency, formatNumber, initials, normalizeSearch } from "@/lib/utils";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Language = "EN" | "HI" | "GU";
type WorkshopType = Workshop["type"];

const emptyLead: Lead = {
  id: "empty-lead",
  name: "No lead selected",
  mobile: "",
  email: "",
  city: "",
  state: "",
  country: "India",
  source: "",
  stage: "New Leads",
  assignedTo: "",
  score: 0,
  revenuePotential: 0,
  notes: ["Add your first lead to begin."],
  callHistory: [],
  whatsappHistory: [],
  workshopsAttended: [],
  paymentHistory: [],
  certificates: [],
  familyAccounts: [],
  tags: ["Empty"],
  createdAt: "",
  nextFollowUp: "",
  bestTime: ""
};

const emptyWorkshop: Workshop = {
  id: "empty-workshop",
  title: "No workshop selected",
  slug: "no-workshop",
  type: "Online",
  price: 0,
  trainer: "",
  status: "Draft",
  city: "",
  startDate: "",
  capacity: 0,
  registrations: 0,
  waitlist: 0,
  revenue: 0,
  feedbackScore: 0
};

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const navItems: NavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "crm", label: "CRM", icon: UsersRound },
  { key: "sales", label: "Sales", icon: Target },
  { key: "workshops", label: "Workshops", icon: CalendarDays },
  { key: "funnels", label: "Funnels", icon: LayoutTemplate },
  { key: "payments", label: "Payments", icon: CreditCard },
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

const ACTION_NOTE_EVENT = "cfl:action-note";
const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const RESET_MARKER_KEY = "cfl_blank_reset_2026_04_28";

function shouldOpenActionPanel(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("required") ||
    normalized.includes("select workshop first") ||
    normalized.includes("please select") ||
    normalized.includes("filter focused") ||
    normalized.includes("quick filter")
  ) {
    return false;
  }

  return [
    "opened",
    "created",
    "generated",
    "queued",
    "started",
    "saved",
    "sent",
    "copied",
    "exported",
    "loaded",
    "deleted",
    "updated",
    "scan completed",
    "executed"
  ].some((keyword) => normalized.includes(keyword));
}

function emitActionNote(message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<string>(ACTION_NOTE_EVENT, { detail: message }));
}

export function BusinessOS() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("home");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<Language>("EN");
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>(leadsSeed);
  const [workshopList, setWorkshopList] = useState<Workshop[]>(workshops);
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState(leadsSeed[0]?.id ?? "");
  const [selectedWorkshopId, setSelectedWorkshopId] = useState(workshops[0]?.id ?? "");
  const [aiQuestion, setAiQuestion] = useState("Show Surat revenue this month");
  const [aiAnswer, setAiAnswer] = useState(answerFor("Show Surat revenue this month"));
  const [activePaymentFilter, setActivePaymentFilter] = useState<"All" | Payment["status"]>("All");
  const [actionNote, setActionNote] = useState("Fresh workspace ready. Add your first lead or workshop.");
  const [actionPanel, setActionPanel] = useState<{ message: string; openedAt: number } | null>(null);
  const [showRightRail, setShowRightRail] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handleActionNote(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) {
        setActionNote(detail);
        if (shouldOpenActionPanel(detail)) {
          setActionPanel({ message: detail, openedAt: Date.now() });
        }
      }
    }

    window.addEventListener(ACTION_NOTE_EVENT, handleActionNote as EventListener);
    return () => window.removeEventListener(ACTION_NOTE_EVENT, handleActionNote as EventListener);
  }, []);

  useEffect(() => {
    function readRegistrations() {
      try {
        if (localStorage.getItem(RESET_MARKER_KEY) !== "done") {
          localStorage.removeItem(REGISTRATION_STORAGE_KEY);
          localStorage.setItem(RESET_MARKER_KEY, "done");
        }
        const raw = localStorage.getItem(REGISTRATION_STORAGE_KEY);
        const parsed: RegistrationEntry[] = raw ? JSON.parse(raw) : [];
        setRegistrations(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRegistrations([]);
      }
    }

    readRegistrations();
    function onStorage(event: StorageEvent) {
      if (!event.key || event.key === REGISTRATION_STORAGE_KEY) {
        readRegistrations();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    function handleHotKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleHotKey);
    return () => window.removeEventListener("keydown", handleHotKey);
  }, []);

  useEffect(() => {
    if (!registrations.length) {
      return;
    }

    setLeads((current) => {
      const byMobile = new Map<string, Lead>();
      current.forEach((lead) => byMobile.set(normalizeSearch(lead.mobile), lead));

      registrations.forEach((entry) => {
        const key = normalizeSearch(entry.mobile);
        const existing = byMobile.get(key);
        if (existing) {
          byMobile.set(key, {
            ...existing,
            email: entry.email || existing.email,
            name: entry.fullName || existing.name,
            notes: [
              `Registration via link for ${entry.workshopTitle} (${entry.createdAt})`,
              ...existing.notes
            ].slice(0, 6),
            paymentHistory: [
              `Link Payment ${formatCurrency(entry.amountPaid)} | ${entry.status}`,
              ...existing.paymentHistory
            ].slice(0, 6),
            workshopsAttended: Array.from(new Set([entry.workshopTitle, ...existing.workshopsAttended]))
          });
        } else {
          byMobile.set(key, {
            id: `lead-link-${key}`,
            name: entry.fullName,
            mobile: entry.mobile,
            email: entry.email,
            city: entry.city || "Unknown",
            state: "Unknown",
            country: "India",
            source: "Registration Link",
            stage: "Qualified",
            assignedTo: "Auto assign",
            score: 78,
            revenuePotential: entry.amountDue > 0 ? entry.amountDue : entry.amountPaid,
            notes: [`Registered via public link (${entry.createdAt})`],
            callHistory: [],
            whatsappHistory: ["Registration confirmation sent"],
            workshopsAttended: [entry.workshopTitle],
            paymentHistory: [`Link Payment ${formatCurrency(entry.amountPaid)} | ${entry.status}`],
            certificates: [],
            familyAccounts: [],
            tags: ["Link Registration", entry.status],
            createdAt: entry.createdAt,
            nextFollowUp: "Tomorrow 11:00 AM",
            bestTime: "10 AM - 12 PM"
          });
        }
      });

      return Array.from(byMobile.values());
    });

  }, [registrations]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0] ?? emptyLead;
  const selectedWorkshop =
    workshopList.find((workshop) => workshop.id === selectedWorkshopId) ?? workshopList[0] ?? emptyWorkshop;

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

    const workshopMatches = workshopList
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
        meta: `${payment.id} | ${formatCurrency(payment.amount)}`
      })),
      ...workshopMatches.map((workshop) => ({
        kind: "Workshop",
        id: workshop.id,
        title: workshop.title,
        meta: `${workshop.city} | ${workshop.registrations}/${workshop.capacity}`
      }))
    ];
  }, [leads, query, workshopList]);

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

  function addLead(input?: Partial<Pick<Lead, "name" | "mobile" | "email" | "city" | "state" | "country" | "source">>) {
    const created: Lead = {
      id: `lead-${Date.now()}`,
      name: input?.name?.trim() || "New Walk-in Lead",
      mobile: input?.mobile?.trim() || "+91 90000 00000",
      email: input?.email?.trim() || "new.lead@example.com",
      city: input?.city?.trim() || "Surat",
      state: input?.state?.trim() || "Gujarat",
      country: input?.country?.trim() || "India",
      source: input?.source?.trim() || "Manual",
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

  function updateSelectedLead(input: Partial<Pick<Lead, "name" | "mobile" | "email" | "city" | "state" | "country" | "source">>) {
    if (!selectedLead || selectedLead.id === emptyLead.id) {
      return;
    }
    const name = input.name?.trim();
    const mobile = input.mobile?.trim();
    if (!name || !mobile) {
      return;
    }
    setLeads((current) =>
      current.map((lead) =>
        lead.id === selectedLead.id
          ? {
              ...lead,
              city: input.city?.trim() || lead.city,
              country: input.country?.trim() || lead.country,
              email: input.email?.trim() || lead.email,
              mobile,
              name,
              source: input.source?.trim() || lead.source,
              state: input.state?.trim() || lead.state
            }
          : lead
      )
    );
    setActionNote(`Lead updated: ${name}.`);
  }

  function deleteSelectedLead() {
    if (!selectedLead || selectedLead.id === emptyLead.id) {
      return;
    }
    setLeads((current) => {
      const remaining = current.filter((lead) => lead.id !== selectedLead.id);
      if (remaining.length > 0) {
        setSelectedLeadId(remaining[0].id);
      }
      return remaining.length > 0 ? remaining : current;
    });
    setActionNote(`Lead deleted: ${selectedLead.name}.`);
  }

  function addWorkshop(input?: {
    city?: string;
    price?: number;
    title: string;
    trainer?: string;
    type?: WorkshopType;
  }) {
    const title = input?.title?.trim();
    if (!title) {
      return;
    }
    const city = input?.city?.trim() || "Surat";
    const trainer = input?.trainer?.trim() || "Arjun Sharma";
    const created: Workshop = {
      id: `workshop-${Date.now()}`,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      type: input?.type ?? "Hybrid",
      price: input?.price ?? 9900,
      trainer,
      status: "Draft",
      city,
      startDate: "2026-05-30",
      capacity: 30,
      registrations: 0,
      waitlist: 0,
      revenue: 0,
      feedbackScore: 0
    };
    setWorkshopList((current) => [created, ...current]);
    setSelectedWorkshopId(created.id);
    setActiveModule("workshops");
    setActionNote(`Workshop created: ${created.title}.`);
  }

  function updateSelectedWorkshop(input: {
    city?: string;
    price?: number;
    title: string;
    trainer?: string;
    type?: WorkshopType;
  }) {
    if (!selectedWorkshop || selectedWorkshop.id === emptyWorkshop.id) {
      return;
    }
    const title = input.title?.trim();
    if (!title) {
      return;
    }
    setWorkshopList((current) =>
      current.map((workshopItem) =>
        workshopItem.id === selectedWorkshop.id
          ? {
              ...workshopItem,
              city: input.city?.trim() || workshopItem.city,
              price: input.price ?? workshopItem.price,
              trainer: input.trainer?.trim() || workshopItem.trainer,
              title,
              type: input.type ?? workshopItem.type,
              slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
            }
          : workshopItem
      )
    );
    setActionNote(`Workshop updated: ${title}.`);
  }

  function deleteSelectedWorkshop() {
    if (!selectedWorkshop || selectedWorkshop.id === emptyWorkshop.id) {
      return;
    }
    setWorkshopList((current) => {
      const remaining = current.filter((item) => item.id !== selectedWorkshop.id);
      if (remaining.length > 0) {
        setSelectedWorkshopId(remaining[0].id);
      }
      return remaining.length > 0 ? remaining : current;
    });
    setActionNote(`Workshop deleted: ${selectedWorkshop.title}.`);
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
          setSelectedWorkshopId={setSelectedWorkshopId}
          setTheme={setTheme}
          setShowRightRail={setShowRightRail}
          showRightRail={showRightRail}
          searchInputRef={searchInputRef}
          theme={theme}
        />

        <MobileNav activeModule={activeModule} setActiveModule={setActiveModule} />

        <div
          className={cn(
            "grid min-h-0 gap-3 p-3 lg:p-4",
            showRightRail
              ? "lg:grid-cols-[minmax(0,1fr)_296px]"
              : "lg:grid-cols-[minmax(0,1fr)]"
          )}
        >
          <main className="min-w-0">{renderActiveModule()}</main>
          {showRightRail ? (
            <RightRail
              runAIQuery={runAIQuery}
              setActiveModule={setActiveModule}
              workshops={workshopList}
            />
          ) : null}
        </div>
      </div>

      {actionPanel ? (
        <ActionPanel
          message={actionPanel.message}
          onClose={() => setActionPanel(null)}
          setActiveModule={setActiveModule}
        />
      ) : null}
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
            addLead={addLead}
            deleteSelectedLead={deleteSelectedLead}
            leads={leads}
            moveLeadForward={moveLeadForward}
            selectedLead={selectedLead}
            setSelectedLeadId={setSelectedLeadId}
            updateSelectedLead={updateSelectedLead}
          />
        );
      case "sales":
        return <SalesView leads={leads} moveLeadForward={moveLeadForward} workshops={workshopList} />;
      case "workshops":
        return (
          <WorkshopsView
            addWorkshop={addWorkshop}
            deleteSelectedWorkshop={deleteSelectedWorkshop}
            registrations={registrations}
            selectedWorkshop={selectedWorkshop}
            setSelectedWorkshopId={setSelectedWorkshopId}
            updateSelectedWorkshop={updateSelectedWorkshop}
            workshops={workshopList}
          />
        );
      case "funnels":
        return <FunnelsView workshops={workshopList} />;
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
        return <ReportsView leads={leads} workshops={workshopList} />;
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
    <aside className="hidden w-[240px] shrink-0 border-r border-ink-900/10 bg-white/78 px-3 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] lg:flex lg:flex-col">
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

function inferActionModule(message: string): ModuleKey {
  const normalized = message.toLowerCase();
  if (normalized.includes("lead") || normalized.includes("crm") || normalized.includes("duplicate")) {
    return "crm";
  }
  if (normalized.includes("workshop") || normalized.includes("schedule") || normalized.includes("registration link")) {
    return "workshops";
  }
  if (normalized.includes("payment") || normalized.includes("razorpay") || normalized.includes("invoice")) {
    return "payments";
  }
  if (normalized.includes("campaign") || normalized.includes("whatsapp") || normalized.includes("email") || normalized.includes("sms")) {
    return "marketing";
  }
  if (normalized.includes("report") || normalized.includes("export")) {
    return "reports";
  }
  if (normalized.includes("sales") || normalized.includes("commission") || normalized.includes("target")) {
    return "sales";
  }
  if (normalized.includes("ticket") || normalized.includes("support")) {
    return "support";
  }
  if (normalized.includes("team") || normalized.includes("task")) {
    return "team";
  }
  if (normalized.includes("ai") || normalized.includes("insight")) {
    return "ai";
  }
  return "home";
}

function ActionPanel({
  message,
  onClose,
  setActiveModule
}: {
  message: string;
  onClose: () => void;
  setActiveModule: (module: ModuleKey) => void;
}) {
  const module = inferActionModule(message);
  const title = message.replace(/\.$/, "");

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-900/35 p-4 backdrop-blur-[1px]">
      <section className="w-full max-w-[520px] rounded-xl border border-ink-900/10 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#16201c]">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500 dark:text-slate-400">
              Action Opened
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug">{title}</h2>
            <p className="mt-2 text-sm text-ink-500 dark:text-slate-400">
              This action is ready. Continue in the related module or close this panel.
            </p>
          </div>
          <button
            className="grid size-8 place-items-center rounded-md border border-ink-900/10 text-ink-500 hover:bg-ink-900/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => {
              setActiveModule(module);
              onClose();
            }}
            type="button"
          >
            Open Module
          </button>
          <button
            className="rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
            onClick={() => emitActionNote(`${title} marked for follow-up.`)}
            type="button"
          >
            Follow-up
          </button>
          <button
            className="rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </div>
      </section>
    </div>
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
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
        compact && "py-2 text-xs",
        active
          ? "border border-mint-500/30 bg-gradient-to-r from-mint-50 to-white text-mint-700 shadow-soft dark:from-mint-500/20 dark:to-white/[0.04] dark:text-mint-100"
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
  setSelectedWorkshopId,
  setTheme,
  setShowRightRail,
  showRightRail,
  searchInputRef,
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
  setSelectedWorkshopId: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setShowRightRail: (show: boolean | ((prev: boolean) => boolean)) => void;
  showRightRail: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  theme: "light" | "dark";
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/10 bg-white/82 px-3 py-2.5 shadow-[0_8px_28px_-22px_rgba(16,24,40,0.8)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101513]/86 lg:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-mint-600 to-ai-500 text-sm font-black text-white">
            C
          </div>
          <span className="font-bold text-mint-700 dark:text-mint-100">CFL OS</span>
        </div>

        <div className="relative min-w-[250px] flex-1 md:max-w-[630px]">
          <div className="flex items-center gap-2 rounded-xl border border-ink-900/10 bg-white px-3 py-2 shadow-soft dark:border-white/10 dark:bg-white/[0.05]">
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
              ref={searchInputRef}
              value={query}
            />
            <kbd className="hidden rounded border border-ink-900/10 bg-[#f8faf7] px-2 py-0.5 text-xs text-ink-500 dark:border-white/10 dark:bg-white/5 md:block">
              Ctrl K
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
                        setSelectedWorkshopId(result.id);
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
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-mint-600 to-mint-700 px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:brightness-110"
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
          <IconButton label={showRightRail ? "Hide Insights" : "Show Insights"} onClick={() => setShowRightRail((prev) => !prev)}>
            <LayoutDashboard className="size-4" />
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

      <div className="mt-2 hidden items-center justify-between rounded-lg border border-ink-900/10 bg-white/55 px-2.5 py-1.5 text-[11px] text-ink-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 md:flex">
        <span className="truncate">{languageCopy[language].greeting}</span>
        <span className="mx-3 truncate">{actionNote}</span>
        <span className="shrink-0">Lead: {selectedLead.name}</span>
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
      className="grid size-9 place-items-center rounded-md border border-ink-900/10 bg-white text-ink-700 shadow-soft transition hover:border-mint-500/30 hover:bg-mint-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.09]"
      onClick={onClick ?? (() => emitActionNote(`${label} opened.`))}
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
  const [homeFocus, setHomeFocus] = useState<"overview" | "pipeline" | "revenue" | "operations">("overview");

  return (
    <div className="space-y-3">
      <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
        {([
          ["overview", "Overview"],
          ["pipeline", "Pipeline"],
          ["revenue", "Revenue"],
          ["operations", "Operations"]
        ] as const).map(([key, label]) => (
          <button
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              homeFocus === key
                ? "border-mint-500/40 bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
                : "border-ink-900/10 text-ink-600 dark:border-white/10 dark:text-slate-300"
            )}
            key={key}
            onClick={() => setHomeFocus(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboardKpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {homeFocus === "overview" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <Panel
            defaultOpen
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
          <LeaderboardPanel />
        </div>
      ) : null}

      {homeFocus === "pipeline" ? (
        <Panel
          defaultOpen
          action={
            <button
              className="rounded-md border border-ink-900/10 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-900/[0.04] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
              onClick={() => setActiveModule("crm")}
              type="button"
            >
              Open CRM
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
      ) : null}

      {homeFocus === "revenue" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <Panel
            defaultOpen
            action={<span className="text-xs font-medium text-ink-500 dark:text-slate-400">This Month</span>}
            title="Revenue Overview"
          >
            <RevenueOverview />
          </Panel>
          <PaymentsMiniPanel
            activePaymentFilter={activePaymentFilter}
            setActiveModule={setActiveModule}
            setActivePaymentFilter={setActivePaymentFilter}
          />
        </div>
      ) : null}

      {homeFocus === "operations" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <WorkshopMiniPanel />
          <PaymentsMiniPanel
            activePaymentFilter={activePaymentFilter}
            setActiveModule={setActiveModule}
            setActivePaymentFilter={setActivePaymentFilter}
          />
        </div>
      ) : null}
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
    <div className="rounded-xl border border-ink-900/10 bg-white p-3 shadow-soft dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-start gap-3">
        <div className={cn("grid size-12 place-items-center rounded-lg", toneStyles)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-700 dark:text-slate-200">{kpi.label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="truncate text-[2rem] font-bold leading-none tracking-tight tabular-nums">{kpi.value}</p>
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
  defaultOpen = false,
  icon: Icon,
  title
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: LucideIcon;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-ink-900/10 bg-white p-3 shadow-soft dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {Icon ? <Icon className="size-4 text-ink-400" /> : null}
        <div className="ml-auto flex items-center gap-2">
          {action}
          <button
            className="flex items-center gap-1 rounded-md border border-ink-900/10 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:bg-ink-900/[0.04] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            onClick={() => setIsOpen((state) => !state)}
            type="button"
          >
            {isOpen ? "Hide" : "Open"}
            <ChevronDown className={cn("size-3.5 transition", isOpen && "rotate-180")} />
          </button>
        </div>
      </div>
      {isOpen ? (
        children
      ) : (
        <div className="rounded-lg border border-dashed border-ink-900/20 px-3 py-5 text-center text-xs font-medium text-ink-500 dark:border-white/20 dark:text-slate-400">
          Section collapsed. Click Open to view details.
        </div>
      )}
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
                {stageLeads.length}
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
            vs last month {formatCurrency(2472000)} | <span className="font-bold text-mint-600">+16.3%</span>
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
  const range = Math.max(1, max - min);
  const coordinates = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.revenue - min) / range) * (height - padding * 2);
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
                  INR 22,18,600
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
      defaultOpen
      action={
        <button
          className="text-xs font-semibold text-ink-500 hover:text-mint-700"
          onClick={() => emitActionNote("Workshop calendar opened for capacity planning.")}
          type="button"
        >
          View Calendar
        </button>
      }
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
      defaultOpen
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
        {filtered.length ? (
          filtered.slice(0, 5).map((payment) => <PaymentRow key={payment.id} payment={payment} />)
        ) : (
          <div className="rounded-md border border-dashed border-ink-900/20 px-3 py-5 text-center text-xs text-ink-500 dark:border-white/20 dark:text-slate-400">
            No invoices in this status yet.
          </div>
        )}
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
        <p className="truncate font-semibold">{payment.id} | {payment.clientName}</p>
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
    <Panel defaultOpen action={<span className="text-xs text-ink-500 dark:text-slate-400">This Month</span>} title="Sales Leaderboard">
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
      <button
        className="mt-4 w-full rounded-md border border-ink-900/10 py-2 text-xs font-semibold hover:bg-ink-900/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]"
        onClick={() => emitActionNote("Full sales leaderboard opened.")}
        type="button"
      >
        View full leaderboard
      </button>
    </Panel>
  );
}

function RightRail({
  runAIQuery,
  setActiveModule,
  workshops
}: {
  runAIQuery: (question: string) => void;
  setActiveModule: (module: ModuleKey) => void;
  workshops: Workshop[];
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-[96px] lg:self-start">
      <Panel
        defaultOpen
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
        defaultOpen
        action={
          <button
            className="text-xs font-semibold text-ink-500 hover:text-mint-700"
            onClick={() => emitActionNote("Upcoming workshop list expanded.")}
            type="button"
          >
            View all
          </button>
        }
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
        defaultOpen
        action={
          <button
            className="text-xs font-semibold text-ink-500 hover:text-mint-700"
            onClick={() => emitActionNote("Automation history opened.")}
            type="button"
          >
            View all
          </button>
        }
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
    <div className="mb-3 rounded-md border border-ink-900/10 bg-white p-3 shadow-soft dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
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
  addLead,
  deleteSelectedLead,
  leads,
  moveLeadForward,
  selectedLead,
  setSelectedLeadId,
  updateSelectedLead
}: {
  addLead: (input?: Partial<Pick<Lead, "name" | "mobile" | "email" | "city" | "state" | "country" | "source">>) => void;
  deleteSelectedLead: () => void;
  leads: Lead[];
  moveLeadForward: (leadId: string) => void;
  selectedLead: Lead;
  setSelectedLeadId: (id: string) => void;
  updateSelectedLead: (input: Partial<Pick<Lead, "name" | "mobile" | "email" | "city" | "state" | "country" | "source">>) => void;
}) {
  const hotLeads = leads.filter((lead) => lead.score >= 80);
  const [quickFilter, setQuickFilter] = useState("All stages");
  const [leadFormMode, setLeadFormMode] = useState<"create" | "edit">("create");
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadProfileOpen, setLeadProfileOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    city: "",
    country: "",
    email: "",
    mobile: "",
    name: "",
    source: "",
    state: ""
  });

  function openLeadForm(mode: "create" | "edit") {
    setLeadFormMode(mode);
    if (mode === "edit" && selectedLead) {
      setLeadForm({
        city: selectedLead.city,
        country: selectedLead.country,
        email: selectedLead.email,
        mobile: selectedLead.mobile,
        name: selectedLead.name,
        source: selectedLead.source,
        state: selectedLead.state
      });
    } else {
      setLeadForm({
        city: "Surat",
        country: "India",
        email: "",
        mobile: "+91 ",
        name: "",
        source: "Manual",
        state: "Gujarat"
      });
    }
    setLeadFormOpen(true);
  }

  function saveLeadForm() {
    if (!leadForm.name.trim() || !leadForm.mobile.trim()) {
      emitActionNote("Lead name and mobile required.");
      return;
    }
    if (leadFormMode === "create") {
      addLead(leadForm);
    } else {
      updateSelectedLead(leadForm);
    }
    setLeadFormOpen(false);
  }
  const filteredLeads = leads.filter((lead) => {
    switch (quickFilter) {
      case "All stages":
        return true;
      case "Gujarat":
        return lead.state === "Gujarat";
      case "Instagram Ads":
        return lead.source === "Instagram Ads";
      case "Neha Kapoor":
        return lead.assignedTo === "Neha Kapoor";
      case "Due payment":
        return lead.paymentHistory.some((entry) => /due|pending/i.test(entry));
      default:
        return true;
    }
  });

  return (
    <div>
      <ModuleHeader
        actions={
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
              onClick={() => openLeadForm("create")}
              type="button"
            >
              Add lead
            </button>
            <button
              className="rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
              onClick={() => emitActionNote("Duplicate merge scan completed: 3 potential duplicate contacts found.")}
              type="button"
            >
              Duplicate merge
            </button>
            <button
              className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => emitActionNote("Round-robin assignment executed for unassigned leads.")}
              type="button"
            >
              Assign leads
            </button>
            <button
              className="rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
              onClick={() => openLeadForm("edit")}
              type="button"
            >
              Edit selected
            </button>
            <button
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
              onClick={deleteSelectedLead}
              type="button"
            >
              Delete
            </button>
          </div>
        }
        eyebrow="CRM system"
        icon={UsersRound}
        title="Contacts, history, scores, and family accounts"
      />

      {leadFormOpen ? (
        <Panel defaultOpen title={leadFormMode === "create" ? "Create Lead" : `Edit Lead: ${selectedLead?.name ?? ""}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => setLeadForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full Name" value={leadForm.name} />
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => setLeadForm((current) => ({ ...current, mobile: event.target.value }))} placeholder="Mobile" value={leadForm.mobile} />
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" value={leadForm.email} />
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => setLeadForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" value={leadForm.city} />
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => setLeadForm((current) => ({ ...current, state: event.target.value }))} placeholder="State" value={leadForm.state} />
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => setLeadForm((current) => ({ ...current, country: event.target.value }))} placeholder="Country" value={leadForm.country} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => setLeadForm((current) => ({ ...current, source: event.target.value }))} placeholder="Lead Source" value={leadForm.source} />
            <button className="rounded-lg bg-mint-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!leadForm.name.trim() || !leadForm.mobile.trim()} onClick={saveLeadForm} type="button">
              {leadFormMode === "create" ? "Save lead" : "Update lead"}
            </button>
            <button className="rounded-lg border border-ink-900/10 px-4 py-2 text-sm font-semibold dark:border-white/10" onClick={() => setLeadFormOpen(false)} type="button">
              Cancel
            </button>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4">
        <Panel
          defaultOpen
          action={<span className="text-xs font-semibold text-mint-600">{hotLeads.length} hot leads</span>}
          title="Lead Database"
        >
          <div className="mb-4 grid gap-2 md:grid-cols-5">
            {["All stages", "Gujarat", "Instagram Ads", "Neha Kapoor", "Due payment"].map((filter) => (
              <button
                className={cn(
                  "rounded-md border border-ink-900/10 px-3 py-2 text-left text-xs font-semibold text-ink-600 hover:bg-ink-900/[0.04] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]",
                  quickFilter === filter && "border-mint-500/40 bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
                )}
                key={filter}
                onClick={() => {
                  setQuickFilter(filter);
                  emitActionNote(`CRM quick filter applied: ${filter}.`);
                }}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-ink-900/10 dark:border-white/10">
            <div className="grid min-w-[720px] grid-cols-[1.3fr_120px_115px_115px_88px] bg-[#f6f8f4] px-3 py-2 text-xs font-bold text-ink-500 dark:bg-white/[0.05] dark:text-slate-400">
              <span>Contact</span>
              <span>City</span>
              <span>Stage</span>
              <span>Owner</span>
              <span className="text-right">Score</span>
            </div>
            {filteredLeads.map((lead) => (
              <button
                className={cn(
                  "grid w-full min-w-[720px] grid-cols-[1.3fr_120px_115px_115px_88px] items-center border-t border-ink-900/10 px-3 py-3 text-left text-sm transition hover:bg-mint-50/70 dark:border-white/10 dark:hover:bg-white/[0.06]",
                  selectedLead.id === lead.id && "bg-mint-50 dark:bg-mint-500/10"
                )}
                key={lead.id}
                onClick={() => {
                  setSelectedLeadId(lead.id);
                  setLeadProfileOpen(true);
                }}
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
      </div>

      {leadProfileOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/45 p-4 backdrop-blur-[1px]">
          <div className="relative max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-xl bg-white p-0 shadow-2xl dark:bg-[#16201c]">
            <button
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-md border border-ink-900/10 bg-white text-ink-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200"
              onClick={() => setLeadProfileOpen(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
            <div className="p-3">
              <LeadProfile
                deleteSelectedLead={() => {
                  deleteSelectedLead();
                  setLeadProfileOpen(false);
                }}
                editSelectedLead={() => {
                  openLeadForm("edit");
                  setLeadProfileOpen(false);
                }}
                lead={selectedLead}
                moveLeadForward={moveLeadForward}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LeadProfile({
  deleteSelectedLead,
  editSelectedLead,
  lead,
  moveLeadForward
}: {
  deleteSelectedLead: () => void;
  editSelectedLead: () => void;
  lead: Lead;
  moveLeadForward: (leadId: string) => void;
}) {
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
        <button
          className="rounded-md border border-ink-900/10 p-2 dark:border-white/10"
          onClick={() => emitActionNote(`Profile options opened for ${lead.name}.`)}
          type="button"
        >
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
        <button
          className="flex items-center justify-center gap-2 rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
          onClick={editSelectedLead}
          type="button"
        >
          Edit
        </button>
        <button
          className="flex items-center justify-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-300"
          onClick={deleteSelectedLead}
          type="button"
        >
          Delete
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
          onClick={() => emitActionNote(`WhatsApp chat opened for ${lead.name}.`)}
          type="button"
        >
          <MessageCircle className="size-4" />
          WhatsApp
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
          onClick={() => emitActionNote(`Call task created for ${lead.name}.`)}
          type="button"
        >
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
    <div className="rounded-md border border-ink-900/10 bg-[#f8faf7] p-2.5 dark:border-white/10 dark:bg-white/[0.04]">
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
  moveLeadForward,
  workshops
}: {
  leads: Lead[];
  moveLeadForward: (leadId: string) => void;
  workshops: Workshop[];
}) {
  const bestLeads = [...leads].sort((a, b) => b.score - a.score).slice(0, 5);
  const [salesPersonForm, setSalesPersonForm] = useState({
    canViewOtherWorkshopReg: true,
    directClientConversation: "",
    email: "",
    firstName: "",
    generalLeadConversation: "",
    group: "",
    isActive: true,
    lastName: "",
    middleName: "",
    mobile: "",
    password: ""
  });
  const [salesPeople, setSalesPeople] = useState<
    Array<{
      id: string;
      fullName: string;
      group: string;
      isActive: boolean;
      mobile: string;
    }>
  >([]);
  const [commissionForm, setCommissionForm] = useState({
    directClientPercent: "5",
    leadAssignPercent: "15",
    workshopId: ""
  });
  const [commissions, setCommissions] = useState<
    Array<{ id: string; workshopId: string; workshopName: string; leadAssignPercent: number; directClientPercent: number }>
  >([]);
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);

  function saveSalesPerson() {
    if (!salesPersonForm.firstName.trim() || !salesPersonForm.lastName.trim() || !salesPersonForm.mobile.trim()) {
      emitActionNote("Sales person first name, last name and mobile are required.");
      return;
    }
    const fullName = `${salesPersonForm.firstName} ${salesPersonForm.middleName} ${salesPersonForm.lastName}`
      .replace(/\s+/g, " ")
      .trim();
    const record = {
      id: `sp-${salesPersonForm.mobile.replace(/\D/g, "")}`,
      fullName,
      group: salesPersonForm.group || "General",
      isActive: salesPersonForm.isActive,
      mobile: salesPersonForm.mobile
    };
    setSalesPeople((current) => {
      const index = current.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        const next = [...current];
        next[index] = record;
        return next;
      }
      return [record, ...current];
    });
    emitActionNote(`Sales person saved: ${fullName}.`);
  }

  function clearSalesPersonForm() {
    setSalesPersonForm({
      canViewOtherWorkshopReg: true,
      directClientConversation: "",
      email: "",
      firstName: "",
      generalLeadConversation: "",
      group: "",
      isActive: true,
      lastName: "",
      middleName: "",
      mobile: "",
      password: ""
    });
    emitActionNote("Sales person form cleared.");
  }

  function addOrUpdateCommission() {
    const workshop = workshops.find((item) => item.id === commissionForm.workshopId);
    if (!workshop) {
      emitActionNote("Select workshop for commission.");
      return;
    }
    const leadAssignPercent = Number(commissionForm.leadAssignPercent || 0);
    const directClientPercent = Number(commissionForm.directClientPercent || 0);
    const payload = {
      id: editingCommissionId ?? `com-${workshop.id}`,
      workshopId: workshop.id,
      workshopName: workshop.title,
      leadAssignPercent,
      directClientPercent
    };
    setCommissions((current) => {
      const index = current.findIndex((item) => item.id === payload.id);
      if (index >= 0) {
        const next = [...current];
        next[index] = payload;
        return next;
      }
      return [payload, ...current];
    });
    setEditingCommissionId(null);
    emitActionNote(`Commission saved for ${workshop.title}.`);
  }

  function editCommission(id: string) {
    const found = commissions.find((item) => item.id === id);
    if (!found) {
      return;
    }
    setEditingCommissionId(found.id);
    setCommissionForm({
      directClientPercent: String(found.directClientPercent),
      leadAssignPercent: String(found.leadAssignPercent),
      workshopId: found.workshopId
    });
  }

  function deleteCommission(id: string) {
    setCommissions((current) => current.filter((item) => item.id !== id));
    if (editingCommissionId === id) {
      setEditingCommissionId(null);
    }
    emitActionNote("Commission row deleted.");
  }

  return (
    <div>
      <ModuleHeader
        actions={
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => emitActionNote("New sales target sheet created for the current month.")}
            type="button"
          >
            Create target
          </button>
        }
        eyebrow="Sales system"
        icon={Target}
        title="Auto assignment, incentives, reminders, and conversion focus"
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
            <button className="rounded-md border border-gray-200 p-2 text-gray-600" type="button">
              <Menu className="size-4" />
            </button>
            <p className="text-sm font-medium text-gray-700">Welcome User</p>
          </div>
          <div className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-gray-900">Manage Sales Person</h3>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-indigo-500 px-3 py-2 text-sm font-medium text-indigo-600"
                onClick={() => emitActionNote(`${salesPeople.length} sales person records loaded.`)}
                type="button"
              >
                <Eye className="size-4" />
                View Data
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <label className="block text-sm text-gray-700">First Name <span className="text-red-500">*</span><input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={salesPersonForm.firstName} onChange={(event) => setSalesPersonForm((current) => ({ ...current, firstName: event.target.value }))} /></label>
              <label className="block text-sm text-gray-700">Middle Name<input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={salesPersonForm.middleName} onChange={(event) => setSalesPersonForm((current) => ({ ...current, middleName: event.target.value }))} /></label>
              <label className="block text-sm text-gray-700">Last Name <span className="text-red-500">*</span><input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={salesPersonForm.lastName} onChange={(event) => setSalesPersonForm((current) => ({ ...current, lastName: event.target.value }))} /></label>
              <label className="block text-sm text-gray-700">Mobile No [Login ID] <span className="text-red-500">*</span><input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={salesPersonForm.mobile} onChange={(event) => setSalesPersonForm((current) => ({ ...current, mobile: event.target.value }))} /></label>
              <label className="block text-sm text-gray-700">Password <span className="text-red-500">*</span><input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" type="password" value={salesPersonForm.password} onChange={(event) => setSalesPersonForm((current) => ({ ...current, password: event.target.value }))} /></label>
              <label className="block text-sm text-gray-700">Email Id <span className="text-red-500">*</span><input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" type="email" value={salesPersonForm.email} onChange={(event) => setSalesPersonForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label className="block text-sm text-gray-700 md:col-span-1">Sales Person Group <span className="text-red-500">*</span><select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={salesPersonForm.group} onChange={(event) => setSalesPersonForm((current) => ({ ...current, group: event.target.value }))}><option value="">SELECT SALES PERSON GROUP</option><option value="Inbound">Inbound</option><option value="Outbound">Outbound</option><option value="Corporate">Corporate</option><option value="Closers">Closers</option></select></label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-6">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input checked={salesPersonForm.canViewOtherWorkshopReg} className="size-4 accent-indigo-600" onChange={(event) => setSalesPersonForm((current) => ({ ...current, canViewOtherWorkshopReg: event.target.checked }))} type="checkbox" />Can View Client Other Reg.?</label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input checked={salesPersonForm.isActive} className="size-4 accent-indigo-600" onChange={(event) => setSalesPersonForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" />Is Active?</label>
            </div>
            <div className="mt-5 space-y-4">
              <textarea className="min-h-[96px] w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Select Category For General Lead Assign" value={salesPersonForm.generalLeadConversation} onChange={(event) => setSalesPersonForm((current) => ({ ...current, generalLeadConversation: event.target.value }))} />
              <textarea className="min-h-[96px] w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Select Category For Direct Client" value={salesPersonForm.directClientConversation} onChange={(event) => setSalesPersonForm((current) => ({ ...current, directClientConversation: event.target.value }))} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={saveSalesPerson} type="button">Save</button>
              <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700" onClick={clearSalesPersonForm} type="button">Clear</button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {salesPeople.slice(0, 4).map((person) => (
              <div className="flex items-center justify-between rounded-md border border-ink-900/10 p-2.5 text-sm dark:border-white/10" key={person.id}>
                <span>{person.fullName} | {person.mobile}</span>
                <span className="text-xs font-semibold">{person.group} | {person.isActive ? "Active" : "Inactive"}</span>
              </div>
            ))}
          </div>
        </div>

        <Panel defaultOpen title="Manage Workshop wise Commission & Commission [Direct Client]">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-white/[0.03]" value={commissionForm.workshopId} onChange={(event) => setCommissionForm((current) => ({ ...current, workshopId: event.target.value }))}>
              <option value="">SELECT WORKSHOP</option>
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.title}
                </option>
              ))}
            </select>
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-white/[0.03]" placeholder="Commission Via Lead Assign (%)" value={commissionForm.leadAssignPercent} onChange={(event) => setCommissionForm((current) => ({ ...current, leadAssignPercent: event.target.value }))} />
            <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-white/[0.03]" placeholder="Commission [Direct Client] (%)" value={commissionForm.directClientPercent} onChange={(event) => setCommissionForm((current) => ({ ...current, directClientPercent: event.target.value }))} />
          </div>
          <button className="mt-3 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-ink-900" onClick={addOrUpdateCommission} type="button">
            {editingCommissionId ? "Update Workshop Commission" : "Add Workshop Commission"}
          </button>
          <div className="mt-3 overflow-x-auto rounded-lg border border-ink-900/10 dark:border-white/10">
            <div className="grid min-w-[620px] grid-cols-[1.2fr_1fr_1fr_90px_90px] bg-[#f6f8f4] px-3 py-2 text-xs font-bold dark:bg-white/[0.05]">
              <span>Workshop Name</span>
              <span>Commission Via Lead Assign (%)</span>
              <span>Commission [Direct Client] (%)</span>
              <span className="text-center">Edit</span>
              <span className="text-center">Delete</span>
            </div>
            {commissions.length ? (
              commissions.map((row) => (
                <div className="grid min-w-[620px] grid-cols-[1.2fr_1fr_1fr_90px_90px] items-center border-t border-ink-900/10 px-3 py-2 text-sm dark:border-white/10" key={row.id}>
                  <span>{row.workshopName}</span>
                  <span>{row.leadAssignPercent}%</span>
                  <span>{row.directClientPercent}%</span>
                  <button className="rounded-md border border-ink-900/10 px-2 py-1 text-xs dark:border-white/10" onClick={() => editCommission(row.id)} type="button">Edit</button>
                  <button className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 dark:text-red-300" onClick={() => deleteCommission(row.id)} type="button">Delete</button>
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-ink-500 dark:text-slate-400">No Data Added</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel defaultOpen title="AI Best Lead Suggestions">
          <div className="space-y-3">
            {bestLeads.map((lead) => (
              <div className="flex items-center gap-3 rounded-lg border border-ink-900/10 p-3 dark:border-white/10" key={lead.id}>
                <div className="grid size-10 place-items-center rounded-full bg-mint-50 text-sm font-bold text-mint-700 dark:bg-mint-500/10 dark:text-mint-100">
                  {lead.score}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{lead.name}</p>
                  <p className="truncate text-xs text-ink-500 dark:text-slate-400">
                    {lead.city} | {lead.source} | {lead.bestTime}
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
                <p className="mt-2 text-xs text-ink-500 dark:text-slate-400">{lead.nextFollowUp} | {lead.bestTime}</p>
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

function WorkshopsView({
  addWorkshop,
  deleteSelectedWorkshop,
  registrations,
  updateSelectedWorkshop,
  selectedWorkshop,
  setSelectedWorkshopId,
  workshops
}: {
  addWorkshop: (input: { city?: string; price?: number; title: string; trainer?: string; type?: WorkshopType }) => void;
  deleteSelectedWorkshop: () => void;
  registrations: RegistrationEntry[];
  updateSelectedWorkshop: (input: { city?: string; price?: number; title: string; trainer?: string; type?: WorkshopType }) => void;
  selectedWorkshop: Workshop | undefined;
  setSelectedWorkshopId: (id: string) => void;
  workshops: Workshop[];
}) {
  const workshopReportGroups: Record<"Workshop" | "Clients" | "Sales Person", string[]> = {
    Workshop: [
      "Daily Report",
      "WorkShop Url & Status",
      "Yearly Public Session",
      "Yearly Workshop",
      "Facilitators Performance",
      "Workshop Summary",
      "Batch Wise Workshop summary"
    ],
    Clients: [
      "Client Milestone",
      "Failed Payment",
      "Part Payment",
      "Workshop wise Member",
      "Member Attend More Workshop",
      "Member Details",
      "Member Details (Part Payment)",
      "Session Conversation",
      "Client Batch Transfer"
    ],
    "Sales Person": ["Sales Person Milestone", "Sales Person Conversion", "Sales Person Collection"]
  };
  const [workshopReportGroup, setWorkshopReportGroup] = useState<"Workshop" | "Clients" | "Sales Person">("Workshop");
  const [workshopReportOption, setWorkshopReportOption] = useState(workshopReportGroups.Workshop[0]);
  const [workshopUrlStatusFilters, setWorkshopUrlStatusFilters] = useState({
    activeType: "ALL",
    facilitator: "ALL FACILITATORS",
    paidType: "ALL",
    search: "",
    showEntries: "10"
  });
  const [scheduleForm, setScheduleForm] = useState({
    aiSensyCampaignName: "",
    aiSensyFailedCampaignName: "",
    aiSensyFailedMediaUrl: "",
    aiSensyMediaUrl: "",
    autoAssignSalesPerson: true,
    batch: "",
    clickMagicCampaignId: "",
    clickMagicHid: "",
    clickMagicUid: "",
    discountDescription: "",
    discountEod: "",
    discountType: "flat" as "flat" | "percent",
    discountValue: "0",
    emailAfterRegistration: true,
    emailBody: "Hi [Name],\n\nThank you for registering. Your seat is confirmed.",
    emailId: "",
    emailSubject: "Thank you for registering",
    endDate: "",
    facilitator: "",
    imagePreviewName: "",
    isPaidWorkshop: true,
    isPartPaymentAllow: false,
    lastRegistrationDate: "",
    linkType: "NA",
    maxOrderQty: "",
    minOrderQty: "",
    minimumPartPayment: "0",
    orderQtyTitle: "",
    redirectUrl: "",
    scheduleWorkshopId: "",
    startDate: "",
    transferLeadToZoho: false,
    venue: "",
    workshopDescription: ""
  });
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [form, setForm] = useState({
    city: "Surat",
    isPaid: true,
    productGroup: "Leadership",
    title: "",
    trainer: "Arjun Sharma",
    type: "Hybrid" as WorkshopType
  });
  const [defaultFields, setDefaultFields] = useState({
    address: false,
    age: false,
    city: false,
    country: true,
    email: true,
    firstName: true,
    gender: false,
    lastName: true,
    mobile: true,
    occupation: false,
    state: false
  });

  function toggleField(key: keyof typeof defaultFields) {
    setDefaultFields((current) => ({ ...current, [key]: !current[key] }));
  }

  function updateScheduleForm<K extends keyof typeof scheduleForm>(
    key: K,
    value: (typeof scheduleForm)[K]
  ) {
    setScheduleForm((current) => ({ ...current, [key]: value }));
  }

  function openWorkshopForm(mode: "create" | "edit", workshopOverride?: Workshop) {
    const workshopToEdit = workshopOverride ?? selectedWorkshop;
    setFormMode(mode);
    if (mode === "edit" && workshopToEdit) {
      setForm({
        city: workshopToEdit.city,
        isPaid: workshopToEdit.price > 0,
        productGroup: "Leadership",
        title: workshopToEdit.title,
        trainer: workshopToEdit.trainer,
        type: workshopToEdit.type
      });
    } else {
      setForm({
        city: "Surat",
        isPaid: true,
        productGroup: "Leadership",
        title: "",
        trainer: "Arjun Sharma",
        type: "Hybrid"
      });
    }
    setIsCreateOpen(true);
  }

  function saveWorkshopForm() {
    if (!form.title.trim()) {
      emitActionNote("Workshop title required.");
      return;
    }
    const payload = {
      city: form.city,
      price: form.isPaid ? 9900 : 0,
      title: form.title,
      trainer: form.trainer,
      type: form.type
    };
    if (formMode === "create") {
      addWorkshop(payload);
    } else {
      updateSelectedWorkshop(payload);
    }
    setIsCreateOpen(false);
  }

  function clearScheduleForm() {
    setScheduleForm((current) => ({
      ...current,
      aiSensyCampaignName: "",
      aiSensyFailedCampaignName: "",
      aiSensyFailedMediaUrl: "",
      aiSensyMediaUrl: "",
      batch: "",
      clickMagicCampaignId: "",
      clickMagicHid: "",
      clickMagicUid: "",
      discountDescription: "",
      discountEod: "",
      discountType: "flat",
      discountValue: "0",
      emailBody: "Hi [Name],\n\nThank you for registering. Your seat is confirmed.",
      emailId: "",
      emailSubject: "Thank you for registering",
      endDate: "",
      facilitator: "",
      imagePreviewName: "",
      lastRegistrationDate: "",
      linkType: "NA",
      maxOrderQty: "",
      minOrderQty: "",
      minimumPartPayment: "0",
      orderQtyTitle: "",
      redirectUrl: "",
      scheduleWorkshopId: "",
      startDate: "",
      venue: "",
      workshopDescription: ""
    }));
    emitActionNote("Workshop schedule form cleared.");
  }

  function generateScheduleLink() {
    const selected = workshops.find((item) => item.id === scheduleForm.scheduleWorkshopId);
    if (!selected) {
      emitActionNote("Select workshop first to generate schedule link.");
      return;
    }
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://dashboard.coachforlife.in";
    const link = `${base}/register/${selected.slug}?batch=${encodeURIComponent(
      scheduleForm.batch || "main"
    )}&type=${encodeURIComponent(scheduleForm.linkType)}&venue=${encodeURIComponent(
      scheduleForm.venue || selected.city
    )}&paid=${scheduleForm.isPaidWorkshop ? "1" : "0"}&part=${scheduleForm.isPartPaymentAllow ? "1" : "0"}`;
    navigator.clipboard.writeText(link).then(() => {
      emitActionNote(`Schedule link copied: ${selected.title}`);
    });
  }

  function saveScheduleConfig() {
    const selected = workshops.find((item) => item.id === scheduleForm.scheduleWorkshopId);
    if (!selected) {
      emitActionNote("Please select workshop before saving schedule.");
      return;
    }
    emitActionNote(`Schedule settings saved for ${selected.title}.`);
  }

  function exportWorkshopUrlStatus() {
    const headers = ["copy_link", "workshop_name", "last_reg_date", "reg_status", "is_paid"];
    const rows = workshopUrlStatusRows.map((row) =>
      [
        row.link,
        row.workshopName,
        row.lastRegDate || "",
        row.regStatus,
        row.isPaid ? "Paid" : "Free"
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workshop-url-status.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    emitActionNote("Workshop URL & Status exported.");
  }

  const workshopUrlStatusRows = workshops
    .map((workshop) => ({
      id: workshop.id,
      facilitator: workshop.trainer || "Unknown",
      isPaid: workshop.price > 0,
      lastRegDate: scheduleForm.lastRegistrationDate || workshop.startDate || "",
      link:
        (typeof window !== "undefined" ? window.location.origin : "https://dashboard.coachforlife.in") +
        `/register/${workshop.slug}`,
      regStatus: workshop.status === "Live" ? "Running" : "Not Running",
      workshopName: workshop.title
    }))
    .filter((row) => {
      if (
        workshopUrlStatusFilters.facilitator !== "ALL FACILITATORS" &&
        row.facilitator !== workshopUrlStatusFilters.facilitator
      ) {
        return false;
      }
      if (workshopUrlStatusFilters.paidType === "PAID" && !row.isPaid) {
        return false;
      }
      if (workshopUrlStatusFilters.paidType === "FREE" && row.isPaid) {
        return false;
      }
      if (workshopUrlStatusFilters.activeType === "RUNNING" && row.regStatus !== "Running") {
        return false;
      }
      if (workshopUrlStatusFilters.activeType === "NOT RUNNING" && row.regStatus !== "Not Running") {
        return false;
      }
      const needle = normalizeSearch(workshopUrlStatusFilters.search);
      if (!needle) {
        return true;
      }
      return normalizeSearch(`${row.workshopName} ${row.facilitator} ${row.regStatus}`).includes(needle);
    });

  return (
    <div>
      <ModuleHeader
        actions={
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-ai-500/40 px-3 py-2 text-sm font-semibold text-ai-600 dark:border-ai-400/40 dark:text-ai-200"
              onClick={() => setIsScheduleOpen((state) => !state)}
              type="button"
            >
              {isScheduleOpen ? "Hide Schedule" : "Manage Schedule"}
            </button>
            <button
              className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => (isCreateOpen ? setIsCreateOpen(false) : openWorkshopForm("create"))}
              type="button"
            >
              {isCreateOpen && formMode === "create" ? "Close form" : "Create workshop"}
            </button>
            <button
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
              onClick={deleteSelectedWorkshop}
              type="button"
            >
              Delete
            </button>
          </div>
        }
        eyebrow="Workshop management"
        icon={CalendarDays}
        title="Workshops, batches, capacity, waitlist, QR attendance, and feedback"
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[280px_1fr]">
        <Panel defaultOpen title="Workshop Reports">
          <div className="space-y-2">
            {(["Workshop", "Clients", "Sales Person"] as const).map((group) => (
              <button
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-semibold",
                  workshopReportGroup === group
                    ? "border-mint-500/40 bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
                    : "border-ink-900/10 dark:border-white/10"
                )}
                key={group}
                onClick={() => {
                  setWorkshopReportGroup(group);
                  setWorkshopReportOption(workshopReportGroups[group][0]);
                }}
                type="button"
              >
                <span>{group}</span>
                <ChevronDown className="size-4 -rotate-90" />
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          defaultOpen
          action={
            <button
              className="rounded-md border border-ink-900/10 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
              onClick={() => emitActionNote(`${workshopReportOption} opened from Workshop module.`)}
              type="button"
            >
              Open
            </button>
          }
          title={`${workshopReportGroup} Options`}
        >
          <div className="grid gap-2 md:grid-cols-2">
            {workshopReportGroups[workshopReportGroup].map((option) => (
              <button
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm",
                  workshopReportOption === option
                    ? "border-mint-500/40 bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
                    : "border-ink-900/10 dark:border-white/10"
                )}
                key={option}
                onClick={() => setWorkshopReportOption(option)}
                type="button"
              >
                <span className="text-base leading-none">{workshopReportOption === option ? "◉" : "○"}</span>
                <span>{option}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {workshopReportGroup === "Workshop" && workshopReportOption === "WorkShop Url & Status" ? (
        <Panel defaultOpen title="View Workshop URL and Status">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Search By Facilitators</label>
              <select
                className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]"
                onChange={(event) =>
                  setWorkshopUrlStatusFilters((current) => ({ ...current, facilitator: event.target.value }))
                }
                value={workshopUrlStatusFilters.facilitator}
              >
                <option>ALL FACILITATORS</option>
                {[...new Set(workshops.map((item) => item.trainer).filter(Boolean))].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Paid Type</label>
              <select
                className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]"
                onChange={(event) =>
                  setWorkshopUrlStatusFilters((current) => ({ ...current, paidType: event.target.value }))
                }
                value={workshopUrlStatusFilters.paidType}
              >
                <option>ALL</option>
                <option>PAID</option>
                <option>FREE</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Active Type</label>
              <select
                className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]"
                onChange={(event) =>
                  setWorkshopUrlStatusFilters((current) => ({ ...current, activeType: event.target.value }))
                }
                value={workshopUrlStatusFilters.activeType}
              >
                <option>ALL</option>
                <option>RUNNING</option>
                <option>NOT RUNNING</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span>Show</span>
              <select
                className="rounded-md border border-ink-900/10 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/[0.03]"
                onChange={(event) =>
                  setWorkshopUrlStatusFilters((current) => ({ ...current, showEntries: event.target.value }))
                }
                value={workshopUrlStatusFilters.showEntries}
              >
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
              <span>entries</span>
              <button
                className="ml-2 rounded-md border border-ink-900/10 px-3 py-1.5 text-sm dark:border-white/10"
                onClick={exportWorkshopUrlStatus}
                type="button"
              >
                Export
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>Search:</span>
              <input
                className="rounded-md border border-ink-900/10 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.03]"
                onChange={(event) =>
                  setWorkshopUrlStatusFilters((current) => ({ ...current, search: event.target.value }))
                }
                value={workshopUrlStatusFilters.search}
              />
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-ink-900/10 dark:border-white/10">
            <div className="grid min-w-[980px] grid-cols-[140px_1.3fr_170px_200px_140px] bg-[#f6f8f4] px-3 py-2 text-xs font-bold dark:bg-white/[0.05]">
              <span>COPY LINK</span>
              <span>WORKSHOP NAME</span>
              <span>LAST REG. DATE</span>
              <span>REG. STATUS</span>
              <span>IS PAID ?</span>
            </div>
            {workshopUrlStatusRows.slice(0, Number(workshopUrlStatusFilters.showEntries)).map((row) => (
              <div
                className="grid min-w-[980px] grid-cols-[140px_1.3fr_170px_200px_140px] items-center border-t border-ink-900/10 px-3 py-3 text-sm dark:border-white/10"
                key={row.id}
              >
                <div className="flex items-center gap-1">
                  <button
                    className="w-fit rounded-md px-2 py-1 font-semibold text-ai-600 hover:bg-ai-50 dark:text-ai-100"
                    onClick={() => {
                      navigator.clipboard.writeText(row.link);
                      emitActionNote(`Copy Link: ${row.workshopName}`);
                    }}
                    type="button"
                  >
                    Copy Link
                  </button>
                  <button
                    className="w-fit rounded-md border border-ink-900/10 px-2 py-1 text-xs font-semibold dark:border-white/10"
                    onClick={() => window.open(row.link, "_blank", "noopener,noreferrer")}
                    type="button"
                  >
                    Open
                  </button>
                </div>
                <p className="truncate">{row.workshopName}</p>
                <p>{row.lastRegDate || "-"}</p>
                <span
                  className={cn(
                    "w-fit rounded-md px-3 py-1.5 font-semibold text-white",
                    row.regStatus === "Running" ? "bg-mint-500" : "bg-red-500"
                  )}
                >
                  {row.regStatus}
                </span>
                <span
                  className={cn(
                    "w-fit rounded-md px-3 py-1.5 font-semibold",
                    row.isPaid ? "bg-ink-900 text-white dark:bg-white dark:text-ink-900" : "bg-saffron-400 text-white"
                  )}
                >
                  {row.isPaid ? "Paid" : "Free"}
                </span>
              </div>
            ))}
            {!workshopUrlStatusRows.length ? (
              <p className="px-3 py-6 text-center text-sm text-ink-500 dark:text-slate-400">No workshop data found.</p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {isCreateOpen ? (
        <Panel defaultOpen title={formMode === "create" ? "Create Workshop / Product" : "Edit Workshop / Product"}>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Workshop/Product Name"
              value={form.title}
            />
            <select
              className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as WorkshopType }))}
              value={form.type}
            >
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Hybrid">Hybrid</option>
            </select>
            <input
              className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) => setForm((current) => ({ ...current, trainer: event.target.value }))}
              placeholder="Default Facilitator"
              value={form.trainer}
            />
            <select
              className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) => setForm((current) => ({ ...current, productGroup: event.target.value }))}
              value={form.productGroup}
            >
              <option>Leadership</option>
              <option>Sales</option>
              <option>Coaching</option>
              <option>Communication</option>
            </select>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500 dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              placeholder="City"
              value={form.city}
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm font-semibold dark:border-white/10">
              <input
                checked={form.isPaid}
                className="size-4 accent-ai-500"
                onChange={(event) => setForm((current) => ({ ...current, isPaid: event.target.checked }))}
                type="checkbox"
              />
              Is Paid?
            </label>
          </div>
          <div className="my-4 border-t border-ink-900/10 dark:border-white/10" />
          <p className="mb-3 text-sm font-bold">Default Setting For Workshop</p>
          <div className="grid gap-2 md:grid-cols-3">
            {[
              ["firstName", "First Name"],
              ["lastName", "Last Name"],
              ["mobile", "Mobile"],
              ["email", "Email"],
              ["country", "Country"],
              ["state", "State"],
              ["city", "City"],
              ["address", "Address"],
              ["age", "Age"],
              ["gender", "Gender"],
              ["occupation", "Occupation"]
            ].map(([key, label]) => (
              <label
                className="inline-flex items-center justify-between rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm dark:border-white/10"
                key={key}
              >
                <span>{label}</span>
                <input
                  checked={defaultFields[key as keyof typeof defaultFields]}
                  className="size-4 accent-ai-500"
                  onChange={() => toggleField(key as keyof typeof defaultFields)}
                  type="checkbox"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg bg-mint-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!form.title.trim()}
              onClick={saveWorkshopForm}
              type="button"
            >
              {formMode === "create" ? "Save workshop" : "Update workshop"}
            </button>
            <button
              className="rounded-lg border border-ink-900/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
              onClick={() => setIsCreateOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </Panel>
      ) : null}

      {isScheduleOpen ? (
      <Panel defaultOpen title="Manage Workshop Schedule">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-ink-500 dark:text-slate-400">Create registration link, email, API mapping, and scheduling rules.</p>
          <button
            className="rounded-lg border border-ai-500/40 px-3 py-2 text-sm font-semibold text-ai-600 dark:text-ai-200"
            onClick={() => emitActionNote("Schedule data preview opened.")}
            type="button"
          >
            View Data
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Select Workshop</label>
            <select
              className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) => updateScheduleForm("scheduleWorkshopId", event.target.value)}
              value={scheduleForm.scheduleWorkshopId}
            >
              <option value="">SELECT WORKSHOP</option>
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.title}
                </option>
              ))}
            </select>
            <label className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
              <input
                checked={scheduleForm.transferLeadToZoho}
                className="size-4 accent-ai-500"
                onChange={(event) => updateScheduleForm("transferLeadToZoho", event.target.checked)}
                type="checkbox"
              />
              Transfer Lead to Zoho?
            </label>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Facilitator</label>
            <select
              className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) => updateScheduleForm("facilitator", event.target.value)}
              value={scheduleForm.facilitator}
            >
              <option value="">SELECT FACILITATOR</option>
              {[...new Set(workshops.map((item) => item.trainer))].map((trainer) => (
                <option key={trainer} value={trainer}>
                  {trainer}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Batch</label>
            <input
              className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) => updateScheduleForm("batch", event.target.value)}
              placeholder="Batch"
              value={scheduleForm.batch}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input
              checked={scheduleForm.isPaidWorkshop}
              className="size-4 accent-ai-500"
              onChange={(event) => updateScheduleForm("isPaidWorkshop", event.target.checked)}
              type="checkbox"
            />
            Is Paid Workshop?
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input
              checked={scheduleForm.isPartPaymentAllow}
              className="size-4 accent-ai-500"
              onChange={(event) => updateScheduleForm("isPartPaymentAllow", event.target.checked)}
              type="checkbox"
            />
            Is Part Payment Allow?
          </label>
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("minimumPartPayment", event.target.value)} placeholder="Minimum Part Payment" value={scheduleForm.minimumPartPayment} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("discountEod", event.target.value)} placeholder="Discount EOD" value={scheduleForm.discountEod} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("discountValue", event.target.value)} placeholder="Discount Value" value={scheduleForm.discountValue} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Discount Type</label>
            <div className="flex gap-4 rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm dark:border-white/10">
              <label className="inline-flex items-center gap-2">
                <input
                  checked={scheduleForm.discountType === "percent"}
                  onChange={() => updateScheduleForm("discountType", "percent")}
                  type="radio"
                />
                %
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  checked={scheduleForm.discountType === "flat"}
                  onChange={() => updateScheduleForm("discountType", "flat")}
                  type="radio"
                />
                Flat Amount
              </label>
            </div>
          </div>
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("orderQtyTitle", event.target.value)} placeholder="Order Qty Title" value={scheduleForm.orderQtyTitle} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("minOrderQty", event.target.value)} placeholder="Min Order Qty" value={scheduleForm.minOrderQty} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("maxOrderQty", event.target.value)} placeholder="Max Order Qty" value={scheduleForm.maxOrderQty} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("startDate", event.target.value)} placeholder="Start Date" type="date" value={scheduleForm.startDate} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("endDate", event.target.value)} placeholder="End Date" type="date" value={scheduleForm.endDate} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("lastRegistrationDate", event.target.value)} placeholder="Last Registration Date" type="date" value={scheduleForm.lastRegistrationDate} />
          <select className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("linkType", event.target.value)} value={scheduleForm.linkType}>
            <option>NA</option>
            <option>Public</option>
            <option>Private</option>
            <option>Affiliate</option>
          </select>
          <select className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("venue", event.target.value)} value={scheduleForm.venue}>
            <option value="">SELECT VENUE</option>
            <option value="Online Zoom">Online Zoom</option>
            <option value="Surat">Surat</option>
            <option value="Ahmedabad">Ahmedabad</option>
            <option value="Mumbai">Mumbai</option>
          </select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("redirectUrl", event.target.value)} placeholder="Re-Direct URL After Registration" value={scheduleForm.redirectUrl} />
          <div className="rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm dark:border-white/10">
            <label className="mb-1 block font-semibold">Image Preview [1024 * 576]</label>
            <input
              onChange={(event) =>
                updateScheduleForm("imagePreviewName", event.target.files?.[0]?.name ?? "")
              }
              type="file"
            />
            {scheduleForm.imagePreviewName ? (
              <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">{scheduleForm.imagePreviewName}</p>
            ) : null}
          </div>
        </div>

        <textarea
          className="mt-3 min-h-[96px] w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]"
          onChange={(event) => updateScheduleForm("discountDescription", event.target.value)}
          placeholder="Discount Description"
          value={scheduleForm.discountDescription}
        />
        <textarea
          className="mt-3 min-h-[110px] w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]"
          onChange={(event) => updateScheduleForm("workshopDescription", event.target.value)}
          placeholder="Workshop Description"
          value={scheduleForm.workshopDescription}
        />

        <div className="my-4 border-t border-ink-900/10 dark:border-white/10" />
        <h3 className="mb-2 text-base font-bold">Send Email After Registration</h3>
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input
            checked={scheduleForm.emailAfterRegistration}
            className="size-4 accent-ai-500"
            onChange={(event) => updateScheduleForm("emailAfterRegistration", event.target.checked)}
            type="checkbox"
          />
          Thank you Email After Registration
        </label>
        <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto]">
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("emailId", event.target.value)} placeholder="Email ID" value={scheduleForm.emailId} />
          <button
            className="rounded-lg border border-ink-900/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
            onClick={() => emitActionNote("Test email format sent to preview queue.")}
            type="button"
          >
            Test Email Format
          </button>
        </div>
        <input className="mt-3 w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("emailSubject", event.target.value)} placeholder="Email Subject" value={scheduleForm.emailSubject} />
        <textarea className="mt-3 min-h-[120px] w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("emailBody", event.target.value)} placeholder="Email Body (use [Name])" value={scheduleForm.emailBody} />

        <div className="my-4 border-t border-ink-900/10 dark:border-white/10" />
        <h3 className="mb-2 text-base font-bold">Third Party API Setup</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("aiSensyCampaignName", event.target.value)} placeholder="AiSensy Campaign Name (Small Letter)" value={scheduleForm.aiSensyCampaignName} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("aiSensyMediaUrl", event.target.value)} placeholder="AiSensy Media URL" value={scheduleForm.aiSensyMediaUrl} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("aiSensyFailedCampaignName", event.target.value)} placeholder="AiSensy Failed Campaign Name (Small Letter)" value={scheduleForm.aiSensyFailedCampaignName} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("aiSensyFailedMediaUrl", event.target.value)} placeholder="AiSensy Failed Media URL" value={scheduleForm.aiSensyFailedMediaUrl} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("clickMagicUid", event.target.value)} placeholder="Click Magic UID" value={scheduleForm.clickMagicUid} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("clickMagicHid", event.target.value)} placeholder="Click Magic HID" value={scheduleForm.clickMagicHid} />
          <input className="rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-ai-500 dark:border-white/10 dark:bg-white/[0.03]" onChange={(event) => updateScheduleForm("clickMagicCampaignId", event.target.value)} placeholder="Click Magic Campaign ID" value={scheduleForm.clickMagicCampaignId} />
          <label className="inline-flex items-center gap-2 rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm font-semibold dark:border-white/10">
            <input
              checked={scheduleForm.autoAssignSalesPerson}
              className="size-4 accent-ai-500"
              onChange={(event) => updateScheduleForm("autoAssignSalesPerson", event.target.checked)}
              type="checkbox"
            />
            Auto Lead Assign to Sales Person
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-mint-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={saveScheduleConfig}
            type="button"
          >
            Save Config
          </button>
          <button
            className="rounded-lg border border-ink-900/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
            onClick={generateScheduleLink}
            type="button"
          >
            Generate Link
          </button>
          <button
            className="rounded-lg border border-ink-900/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
            onClick={clearScheduleForm}
            type="button"
          >
            Clear
          </button>
        </div>
      </Panel>
      ) : null}

      <Panel
        defaultOpen
        action={<span className="text-xs font-semibold text-mint-700">{registrations.length} entries</span>}
        title="Registration Link Entries"
      >
        {registrations.length ? (
          <div className="space-y-2">
            {registrations.slice(0, 8).map((entry) => (
              <div className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-ink-900/10 p-2.5 text-sm dark:border-white/10" key={entry.id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{entry.fullName} | {entry.mobile}</p>
                  <p className="truncate text-xs text-ink-500 dark:text-slate-400">{entry.workshopTitle} | {entry.createdAt}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(entry.amountPaid)}</p>
                  <p className="text-xs text-ink-500 dark:text-slate-400">{entry.status}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500 dark:text-slate-400">No public registrations yet.</p>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Panel defaultOpen title="Live Workshop Portfolio">
          <div className="grid gap-3 md:grid-cols-2">
            {workshops.map((workshop) => (
              <WorkshopCard
                key={workshop.id}
                onClick={() => {
                  setSelectedWorkshopId(workshop.id);
                  openWorkshopForm("edit", workshop);
                  emitActionNote(`Workshop edit opened: ${workshop.title}.`);
                }}
                selected={selectedWorkshop?.id === workshop.id}
                workshop={workshop}
              />
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
                      <p className="text-xs text-ink-500 dark:text-slate-400">{workshop?.title} | {batch.startDate}</p>
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
        <Panel defaultOpen title={selectedWorkshop ? `Selected: ${selectedWorkshop.title}` : "Selected workshop"}>
          {selectedWorkshop ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <MetricTile label="Type" value={selectedWorkshop.type} />
                <MetricTile label="Trainer" value={selectedWorkshop.trainer} />
                <MetricTile label="City" value={selectedWorkshop.city} />
                <MetricTile label="Price" value={formatCurrency(selectedWorkshop.price)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MetricTile label="Capacity" value={String(selectedWorkshop.capacity)} />
                <MetricTile label="Registered" value={String(selectedWorkshop.registrations)} />
                <MetricTile label="Waitlist" value={String(selectedWorkshop.waitlist)} />
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-ink-900/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
                  onClick={() => openWorkshopForm("edit")}
                  type="button"
                >
                  Edit workshop
                </button>
                <button
                  className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-300"
                  onClick={deleteSelectedWorkshop}
                  type="button"
                >
                  Delete workshop
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-500 dark:text-slate-400">No workshop selected.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function WorkshopCard({
  onClick,
  selected,
  workshop
}: {
  onClick: () => void;
  selected: boolean;
  workshop: Workshop;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-lg border border-ink-900/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-mint-500/30 dark:border-white/10",
        selected && "border-mint-500/60 bg-mint-50/60 dark:bg-mint-500/10"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{workshop.title}</p>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
            {workshop.type} | {workshop.city} | {workshop.trainer}
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
    </button>
  );
}

function FunnelsView({ workshops }: { workshops: Workshop[] }) {
  const featured = workshops[0];

  return (
    <div>
      <ModuleHeader
        actions={
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => emitActionNote("Registration funnel published and ready to accept payments.")}
            type="button"
          >
            Publish page
          </button>
        }
        eyebrow="Registration funnels"
        icon={LayoutTemplate}
        title="Landing pages with coupons, payments, WhatsApp, FAQ, and thank-you flows"
      />

      {!featured ? (
        <Panel defaultOpen title="No Funnel Yet">
          <p className="text-sm text-ink-500 dark:text-slate-400">
            Create a workshop first, then its registration funnel preview will appear here.
          </p>
        </Panel>
      ) : (
      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel defaultOpen title="Funnel Controls">
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
                  <button
                    className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-ink-900"
                    onClick={() => emitActionNote(`Payment flow started for ${featured.title}.`)}
                    type="button"
                  >
                    Pay {formatCurrency(featured.price)}
                  </button>
                  <button
                    className="rounded-lg border border-ink-900/10 px-4 py-2 text-sm font-bold dark:border-white/10"
                    onClick={() => emitActionNote("WhatsApp support widget opened for funnel queries.")}
                    type="button"
                  >
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
                <button
                  className="mt-4 w-full rounded-lg bg-mint-600 py-2.5 text-sm font-bold text-white"
                  onClick={() => emitActionNote("Razorpay registration link generated and sent.")}
                  type="button"
                >
                  Register with Razorpay
                </button>
                <p className="mt-3 text-center text-xs text-ink-500 dark:text-slate-400">Secure payment | GST invoice | instant confirmation</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
      )}
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
        actions={
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => emitActionNote("Fresh Razorpay payment link created.")}
            type="button"
          >
            Create payment link
          </button>
        }
        eyebrow="Payment system"
        icon={CreditCard}
        title="Razorpay, part payments, refunds, GST invoices, retries, and recovery"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.82fr]">
        <Panel defaultOpen title="Payment Recovery Flow">
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
            {filtered.length ? (
              filtered.map((payment) => <PaymentRow key={payment.id} payment={payment} />)
            ) : (
              <div className="rounded-md border border-dashed border-ink-900/20 px-3 py-6 text-center text-sm text-ink-500 dark:border-white/20 dark:text-slate-400">
                No invoices in this status.
              </div>
            )}
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
        actions={
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => emitActionNote("Campaign builder opened with WhatsApp template defaults.")}
            type="button"
          >
            New campaign
          </button>
        }
        eyebrow="Marketing engine"
        icon={Megaphone}
        title="Bulk WhatsApp, email, SMS, drips, referrals, and rejoin campaigns"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        <Panel defaultOpen title="Campaign Performance">
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
        <p className="text-xs text-ink-500 dark:text-slate-400">{campaign.type} | {campaign.audience}</p>
      </div>
      <MetricTile label="Sent" value={formatNumber(campaign.sent)} />
      <MetricTile label="Conversion" value={`${campaign.conversion}%`} />
      <MetricTile label="Revenue" value={formatCurrency(campaign.revenue)} />
    </div>
  );
}

function ReportsView({
  leads,
  workshops
}: {
  leads: Lead[];
  workshops: Workshop[];
}) {
  const [selectedFilter, setSelectedFilter] = useState("Date range");
  const [dailyReportFilter, setDailyReportFilter] = useState({
    batch: "ALL BATCH",
    date: "",
    workshop: "",
    workshopGroup: ""
  });
  const [reportCategory, setReportCategory] = useState<"Workshop" | "Clients" | "Sales Person">("Workshop");
  const reportGroups: Record<"Workshop" | "Clients" | "Sales Person", string[]> = {
    Workshop: [
      "Daily Report",
      "WorkShop Url & Status",
      "Yearly Public Session",
      "Yearly Workshop",
      "Facilitators Performance",
      "Workshop Summary",
      "Batch Wise Workshop Summary"
    ],
    Clients: [
      "Client Milestone",
      "Failed Payment",
      "Part Payment",
      "Workshop Wise Member",
      "Member Attend More Workshop",
      "Member Details",
      "Member Details (Part Payment)",
      "Session Conversation",
      "Client Batch Transfer"
    ],
    "Sales Person": ["Sales Person Milestone", "Sales Person Conversion", "Sales Person Collection"]
  };
  const [selectedReport, setSelectedReport] = useState(reportGroups.Workshop[0]);

  function toCsv(headers: string[], rows: string[][]) {
    const body = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
    return [headers.join(","), ...body].join("\n");
  }

  function exportReport() {
    let csv = "";
    let filename = "cfl-report.csv";

    if (reportCategory === "Workshop") {
      filename = "cfl-workshop-report.csv";
      csv = toCsv(
        ["workshop", "slug", "type", "trainer", "city", "start_date", "price", "registrations", "revenue", "status"],
        workshops.map((item) => [
          item.title,
          item.slug,
          item.type,
          item.trainer,
          item.city,
          item.startDate,
          String(item.price),
          String(item.registrations),
          String(item.revenue),
          item.status
        ])
      );
    } else if (reportCategory === "Clients") {
      filename = "cfl-client-report.csv";
      csv = toCsv(
        ["name", "mobile", "email", "city", "state", "source", "stage", "owner", "score", "potential"],
        leads.map((lead) => [
          lead.name,
          lead.mobile,
          lead.email,
          lead.city,
          lead.state,
          lead.source,
          lead.stage,
          lead.assignedTo,
          String(lead.score),
          String(lead.revenuePotential)
        ])
      );
    } else {
      filename = "cfl-sales-person-report.csv";
      csv = toCsv(
        ["sales_person", "role", "city", "target", "achieved", "calls", "conversions", "incentives"],
        teamMembers.map((member) => [
          member.name,
          member.role,
          member.city,
          String(member.target),
          String(member.achieved),
          String(member.calls),
          String(member.conversions),
          String(member.incentives)
        ])
      );
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    emitActionNote(`${selectedReport} exported as CSV.`);
  }

  return (
    <div>
      <ModuleHeader
        actions={
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={exportReport}
            type="button"
          >
            Export report
          </button>
        }
        eyebrow="Reports center"
        icon={BarChart3}
        title="Daily, sales, revenue, workshop, city, repeat client, and failed payment reports"
      />

        <div className="space-y-4">
          {selectedReport === "Daily Report" && (
            <div className="rounded-lg bg-gray-50 p-2">
              <div className="flex items-center justify-between rounded-md bg-white px-4 py-3 shadow-sm">
                <button className="rounded-md border border-gray-200 p-2 text-gray-600" type="button">
                  <Menu className="size-4" />
                </button>
                <p className="text-sm font-medium text-gray-700">Welcome User</p>
              </div>

              <div className="mx-auto mt-6 w-full rounded-md bg-white p-6 shadow-sm">
                <h3 className="text-lg font-medium text-gray-800">Daily Report</h3>
                <div className="mt-4 grid grid-cols-1 items-end gap-4 md:grid-cols-5">
                  <label className="block text-sm text-gray-600">
                    WorkShop Group
                    <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={dailyReportFilter.workshopGroup} onChange={(event) => setDailyReportFilter((current) => ({ ...current, workshopGroup: event.target.value }))}>
                      <option value="">SEARCH ...</option>
                      <option value="Leadership">Leadership</option>
                      <option value="Growth">Growth</option>
                    </select>
                  </label>
                  <label className="block text-sm text-gray-600">
                    Workshop
                    <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search Workshop" value={dailyReportFilter.workshop} onChange={(event) => setDailyReportFilter((current) => ({ ...current, workshop: event.target.value }))} />
                  </label>
                  <label className="block text-sm text-gray-600">
                    Batch
                    <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={dailyReportFilter.batch} onChange={(event) => setDailyReportFilter((current) => ({ ...current, batch: event.target.value }))}>
                      <option value="ALL BATCH">ALL BATCH</option>
                      <option value="Batch A">Batch A</option>
                      <option value="Batch B">Batch B</option>
                    </select>
                  </label>
                  <label className="block text-sm text-gray-600">
                    Date
                    <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="14-Sep-2024" type="date" value={dailyReportFilter.date} onChange={(event) => setDailyReportFilter((current) => ({ ...current, date: event.target.value }))} />
                  </label>
                  <button className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-md bg-gray-700 text-white transition hover:bg-gray-800" onClick={exportReport} type="button">
                    <Download className="size-4" />
                  </button>
                </div>
              </div>

              <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-1 pt-4 text-sm text-gray-600">
                <p>Copyright © 2024 Your Company</p>
                <p>Maintained By Developer</p>
              </footer>
            </div>
          )}

          {selectedReport !== "Daily Report" && (
            <>
          <Panel defaultOpen title="Advanced Filters">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {filterLabels.map((filter) => (
              <button
                className={cn(
                  "flex items-center justify-between rounded-md border border-ink-900/10 px-3 py-2 text-left text-xs font-bold text-ink-600 dark:border-white/10 dark:text-slate-300",
                  selectedFilter === filter && "border-mint-500/40 bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
                )}
                key={filter}
                onClick={() => {
                  setSelectedFilter(filter);
                  emitActionNote(`Report filter focused: ${filter}.`);
                }}
                type="button"
              >
                {filter}
                <ChevronDown className="size-3.5" />
              </button>
            ))}
          </div>
        </Panel>
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <Panel defaultOpen title="Report Groups">
            <div className="space-y-2">
              {(["Workshop", "Clients", "Sales Person"] as const).map((group) => (
                <button
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-semibold",
                    reportCategory === group
                      ? "border-mint-500/40 bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
                      : "border-ink-900/10 dark:border-white/10"
                  )}
                  key={group}
                  onClick={() => {
                    setReportCategory(group);
                    setSelectedReport(reportGroups[group][0]);
                  }}
                  type="button"
                >
                  <span>{group}</span>
                  <ChevronDown className="size-4 -rotate-90" />
                </button>
              ))}
            </div>
          </Panel>
          <Panel defaultOpen title={`${reportCategory} Reports`}>
            <div className="grid gap-2 md:grid-cols-2">
              {reportGroups[reportCategory].map((report) => (
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm",
                    selectedReport === report
                      ? "border-mint-500/40 bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-100"
                      : "border-ink-900/10 dark:border-white/10"
                  )}
                  key={report}
                  onClick={() => setSelectedReport(report)}
                  type="button"
                >
                  <span className="text-base leading-none">{selectedReport === report ? "◉" : "○"}</span>
                  <span>{report}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
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
            </>
          )}
        </div>
    </div>
  );
}

function SupportView() {
  return (
    <div>
      <ModuleHeader
        actions={
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => emitActionNote("Support ticket creation flow opened.")}
            type="button"
          >
            New ticket
          </button>
        }
        eyebrow="Support system"
        icon={LifeBuoy}
        title="Tickets, complaints, refunds, priority support, and satisfaction"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Panel defaultOpen title="Ticketing Queue">
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
                  {ticket.client} | owner {ticket.owner} | satisfaction {ticket.satisfaction}/5
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
        actions={
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => emitActionNote("Team task assignment board opened.")}
            type="button"
          >
            Assign task
          </button>
        }
        eyebrow="Team management"
        icon={BriefcaseBusiness}
        title="Staff records, roles, attendance, incentives, salary notes, and tasks"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Panel defaultOpen title="Staff Records">
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div className="grid gap-3 rounded-lg border border-ink-900/10 p-3 dark:border-white/10 md:grid-cols-[1fr_120px_120px_120px] md:items-center" key={member.id}>
                <div>
                  <p className="font-bold">{member.name}</p>
                  <p className="text-xs text-ink-500 dark:text-slate-400">{member.role} | {member.city}</p>
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
        actions={
          <button
            className="rounded-lg bg-ai-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => emitActionNote("AI insight saved to founder notes.")}
            type="button"
          >
            Save insight
          </button>
        }
        eyebrow="Advanced AI features"
        icon={Sparkles}
        title="Sales Brain, Growth Brain, Customer Brain, and Founder Assistant"
      />

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel defaultOpen title="Natural Language Query">
          <div className="space-y-2">
            {[
              "Show Surat revenue this month",
              "Which salesperson weak this week",
              "Show unpaid clients above INR 5000",
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
        actions={
          <button
            className="rounded-lg bg-mint-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => emitActionNote("Audit log review opened with latest security events.")}
            type="button"
          >
            Review audit log
          </button>
        }
        eyebrow="Security and SaaS readiness"
        icon={ShieldCheck}
        title="OTP auth, role access, audit logs, payment security, backups, and tenant controls"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.86fr]">
        <Panel defaultOpen title="Security Controls">
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
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">{log.meta} | {log.createdAt}</p>
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
    return "Surat revenue is INR 8,42,700 this month, up 22% versus the previous period. The strongest source is Instagram Ads, and the best next move is a WhatsApp rejoin campaign for 1,840 warm contacts with score above 70.";
  }

  if (normalized.includes("salesperson") || normalized.includes("weak")) {
    return "Kavya Rao needs attention this week: 85% of target, 11 conversions, and 89% attendance. The issue is not lead volume; conversion drops after the first call. Assign Neha's follow-up script and review 10 call notes today.";
  }

  if (normalized.includes("unpaid") || normalized.includes("overdue") || normalized.includes("payment")) {
    return "There are 47 unpaid invoices in the recovery queue. Highest priority: Rohan Mehta INR 2,10,000 overdue 3 days, BrightWave Ltd. INR 85,000 overdue 7 days, GlobalSoft HR INR 45,000 due in 3 days. Send Razorpay retry links plus GST invoice copy.";
  }

  if (normalized.includes("campaign") || normalized.includes("last 30")) {
    return "The best campaign in the last 30 days is Workshop Follow-up on WhatsApp. It converted 18.4% and attributed INR 6,85,000 revenue. Clone it for Mindset Mastery attendees and add a 48-hour coupon.";
  }

  if (normalized.includes("workshop")) {
    return "Communication Skills is underperforming on seat fill: 18/25 registrations and 3 waitlist holds. Push Pune lookalike leads, add trainer proof to the funnel, and run payment reminders for interested clients.";
  }

  return "Today: 342 leads, 128 registrations, INR 8,42,700 revenue, and INR 6,21,400 pending payments. AI recommends calling 5 high-score corporate leads before 6 PM and triggering the payment recovery automation for 47 invoices.";
}
