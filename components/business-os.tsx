"use client";

import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bold,
  Bell,
  Bot,
  Box,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Command,
  ChevronUp,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Gift,
  Globe2,
  Headphones,
  HelpCircle,
  Home,
  Import,
  Italic,
  Languages,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  LockKeyhole,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  MessageCircle,
  Menu,
  MapPin,
  Moon,
  MoreHorizontal,
  Eye,
  Phone,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  SquarePen,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Underline,
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
import dynamic from "next/dynamic";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart as ReLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ManageWorkshopScheduleForm } from "@/components/manage-workshop-schedule-form";

type Language = "EN" | "HI" | "GU";
type WorkshopType = Workshop["type"];
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

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
const LEADS_STORAGE_KEY = "cfl_leads_v1";
const WORKSHOPS_STORAGE_KEY = "cfl_workshops_v1";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

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
  const [dbEnabled, setDbEnabled] = useState(false);
  const [showRightRail, setShowRightRail] = useState(false);
  const [openAdminMenu, setOpenAdminMenu] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handleActionNote(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) {
        setActionNote(detail);
      }
    }

    window.addEventListener(ACTION_NOTE_EVENT, handleActionNote as EventListener);
    return () => window.removeEventListener(ACTION_NOTE_EVENT, handleActionNote as EventListener);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function syncFromDb() {
      try {
        const response = await fetch("/api/state", { method: "GET" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        if (data?.dbEnabled) {
          setDbEnabled(true);
          if (Array.isArray(data.leads) && data.leads.length) setLeads(data.leads);
          if (Array.isArray(data.workshops) && data.workshops.length) setWorkshopList(data.workshops);
          setActionNote("PostgreSQL mode active. Data is persistent.");
        }
      } catch {
        // fallback to local storage mode
      }
    }
    syncFromDb();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const rawLeads = localStorage.getItem(LEADS_STORAGE_KEY);
      const rawWorkshops = localStorage.getItem(WORKSHOPS_STORAGE_KEY);
      if (rawLeads) {
        const parsed = JSON.parse(rawLeads);
        if (Array.isArray(parsed) && parsed.length) {
          setLeads(parsed);
        }
      }
      if (rawWorkshops) {
        const parsed = JSON.parse(rawWorkshops);
        if (Array.isArray(parsed) && parsed.length) {
          setWorkshopList(parsed);
        }
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    } catch {
      // ignore quota/storage errors
    }
  }, [leads]);

  useEffect(() => {
    try {
      localStorage.setItem(WORKSHOPS_STORAGE_KEY, JSON.stringify(workshopList));
    } catch {
      // ignore quota/storage errors
    }
  }, [workshopList]);

  useEffect(() => {
    if (!dbEnabled) return;
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads, workshops: workshopList })
        });
      } catch {
        // keep local mode
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [dbEnabled, leads, workshopList]);

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

  useEffect(() => {
    setWorkshopList((current) => {
      let changed = false;
      const next = current.map((workshop) => {
        const workshopRegistrations = registrations.filter((entry) => entry.workshopId === workshop.id);
        const registrationCount = workshopRegistrations.length;
        const collectedRevenue = workshopRegistrations.reduce((sum, entry) => sum + entry.amountPaid, 0);
        if (workshop.registrations === registrationCount && workshop.revenue === collectedRevenue) {
          return workshop;
        }
        changed = true;
        return {
          ...workshop,
          registrations: registrationCount,
          revenue: collectedRevenue
        };
      });
      return changed ? next : current;
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

  function assignLeadsToSalesPerson(leadIds: string[], salesPerson: string) {
    if (!leadIds.length || !salesPerson.trim()) {
      return;
    }
    setLeads((current) =>
      current.map((lead) => (leadIds.includes(lead.id) ? { ...lead, assignedTo: salesPerson } : lead))
    );
    setActionNote(`${leadIds.length} leads assigned to ${salesPerson}.`);
  }

  function deleteLeadsByIds(leadIds: string[]) {
    if (!leadIds.length) {
      return;
    }
    setLeads((current) => {
      const remaining = current.filter((lead) => !leadIds.includes(lead.id));
      if (remaining.length > 0) {
        setSelectedLeadId(remaining[0].id);
      }
      return remaining.length > 0 ? remaining : current;
    });
    setActionNote(`${leadIds.length} selected leads deleted.`);
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

  function addClientToWorkshop(input: {
    leadId: string;
    paymentMode: "Full" | "Part";
    partAmount?: number;
    workshopId: string;
  }) {
    const lead = leads.find((item) => item.id === input.leadId);
    const workshop = workshopList.find((item) => item.id === input.workshopId);
    if (!lead || !workshop) {
      emitActionNote("Select a valid client and workshop.");
      return;
    }

    const mobile = digitsOnly(lead.mobile);
    if (!mobile) {
      emitActionNote("Client mobile is required for registration.");
      return;
    }

    const fullAmount = Math.max(0, workshop.price);
    const cappedPart = Math.max(0, Math.min(Number(input.partAmount || 0), fullAmount));
    const amountPaid = input.paymentMode === "Part" ? cappedPart : fullAmount;
    const amountDue = Math.max(0, fullAmount - amountPaid);
    const registrationId = `reg-${workshop.id}-${mobile}`;

    setRegistrations((current) => {
      const payload: RegistrationEntry = {
        id: registrationId,
        workshopId: workshop.id,
        workshopSlug: workshop.slug,
        workshopTitle: workshop.title,
        fullName: lead.name,
        mobile: lead.mobile.trim() || `+91 ${mobile}`,
        email: lead.email,
        city: lead.city || workshop.city || "Unknown",
        paymentMode: input.paymentMode,
        amountPaid,
        amountDue,
        status: amountDue > 0 ? "Due" : "Paid",
        createdAt: new Date().toISOString().slice(0, 10)
      };

      const existingIndex = current.findIndex((item) => item.id === registrationId);
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = payload;
      } else {
        next.unshift(payload);
      }

      try {
        localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    emitActionNote(`Client added to workshop: ${lead.name} -> ${workshop.title}.`);
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
    <div className="min-h-screen bg-[#f3f4f6] p-2 text-ink-900 dark:bg-[#101513] dark:text-slate-100">
      <AdminHorizontalNav
        activeModule={activeModule}
        openMenu={openAdminMenu}
        setActiveModule={setActiveModule}
        setOpenMenu={setOpenAdminMenu}
      />
      <main className="mt-3 min-w-0">{renderActiveModule()}</main>
    </div>
  );

  return <div className={cn(theme === "dark" && "dark")}>{content}</div>;

  function renderActiveModule() {
    switch (activeModule) {
      case "home":
        return (
          <PremiumDashboardHome
            leads={leads}
          />
        );
      case "crm":
        return (
          <CRMView
            assignLeadsToSalesPerson={assignLeadsToSalesPerson}
            addLead={addLead}
            deleteLeadsByIds={deleteLeadsByIds}
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
            addClientToWorkshop={addClientToWorkshop}
            deleteSelectedWorkshop={deleteSelectedWorkshop}
            leads={leads}
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

function AdminHorizontalNav({
  activeModule,
  openMenu,
  setActiveModule,
  setOpenMenu
}: {
  activeModule: ModuleKey;
  openMenu: string | null;
  setActiveModule: (module: ModuleKey) => void;
  setOpenMenu: (menu: string | null) => void;
}) {
  const menus: Array<{
    icon: LucideIcon;
    key: string;
    label: string;
    module?: ModuleKey;
    items?: Array<{ icon: LucideIcon; label: string; module: ModuleKey }>;
  }> = [
    { icon: Home, key: "dashboard", label: "Dashboard", module: "home" },
    {
      icon: SquarePen,
      key: "masters",
      label: "Masters",
      items: [
        { icon: MapPin, label: "Location", module: "settings" },
        { icon: Activity, label: "Tables", module: "reports" },
        { icon: UsersRound, label: "Sales Person", module: "sales" },
        { icon: ClipboardCheck, label: "Workshop Master", module: "workshops" },
        { icon: CalendarDays, label: "Workshop Schedule", module: "workshops" },
        { icon: Gift, label: "Workshop Discount", module: "workshops" },
        { icon: UsersRound, label: "Client", module: "crm" },
        { icon: ClipboardCheck, label: "Family", module: "crm" }
      ]
    },
    { icon: SquarePen, key: "paw", label: "PAW Profile Analysis", module: "reports" },
    {
      icon: Box,
      key: "process",
      label: "Process",
      items: [
        { icon: ClipboardCheck, label: "Client Batch Transfer", module: "reports" },
        { icon: ClipboardCheck, label: "Refund", module: "reports" },
        { icon: ClipboardCheck, label: "Merge Client", module: "crm" },
        { icon: Activity, label: "Re-Check Failed Payment", module: "payments" },
        { icon: Activity, label: "Manual Client Registration", module: "funnels" },
        { icon: Activity, label: "Manual Client Part Payment", module: "payments" }
      ]
    },
    {
      icon: Box,
      key: "lead",
      label: "Lead",
      items: [
        { icon: ClipboardCheck, label: "Import Old Lead Sales Person", module: "crm" },
        { icon: ClipboardCheck, label: "Import Client Workshop Verification", module: "crm" },
        { icon: ClipboardCheck, label: "Import Direct RM Assign", module: "crm" },
        { icon: ClipboardCheck, label: "Sales Person Payment", module: "sales" },
        { icon: ClipboardCheck, label: "Transfer Lead", module: "crm" },
        { icon: ClipboardCheck, label: "Sales Person Lead Assign", module: "crm" }
      ]
    },
    {
      icon: FileSpreadsheet,
      key: "reports",
      label: "Reports",
      items: [
        { icon: Activity, label: "Workshop", module: "reports" },
        { icon: Activity, label: "Clients", module: "reports" },
        { icon: Activity, label: "Sales Person", module: "reports" }
      ]
    },
    { icon: Settings, key: "settings", label: "Settings", module: "settings" }
  ];

  return (
    <nav className="relative z-40 rounded-lg bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {menus.map((menu) => {
          const Icon = menu.icon;
          const isOpen = openMenu === menu.key;
          const isActive = menu.module === activeModule || isOpen;
          return (
            <div className="relative" key={menu.key}>
              <button
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-ink-900 transition hover:bg-gray-100",
                  isActive && "bg-gray-100"
                )}
                onClick={() => {
                  if (menu.items) {
                    setOpenMenu(isOpen ? null : menu.key);
                    return;
                  }
                  if (menu.module) {
                    setActiveModule(menu.module);
                    setOpenMenu(null);
                  }
                }}
                type="button"
              >
                <Icon className="size-4" />
                {menu.label}
                {menu.items ? <ChevronDown className={cn("size-4 text-ink-500 transition", isOpen && "rotate-180")} /> : null}
              </button>
              {menu.items && isOpen ? (
                <div className="absolute left-0 top-full mt-3 min-w-[320px] rounded-md bg-white p-3 shadow-2xl">
                  <div className="grid gap-1">
                    {menu.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <button
                          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-gray-50"
                          key={item.label}
                          onClick={() => {
                            setActiveModule(item.module);
                            setOpenMenu(null);
                          }}
                          type="button"
                        >
                          <ItemIcon className="size-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
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
  leads
}: {
  leads: Lead[];
}) {
  const chartData = [
    { month: "Jan", enrollments: 120, workshops: 10 }, { month: "Feb", enrollments: 145, workshops: 12 },
    { month: "Mar", enrollments: 170, workshops: 13 }, { month: "Apr", enrollments: 195, workshops: 15 },
    { month: "May", enrollments: 220, workshops: 17 }, { month: "Jun", enrollments: 260, workshops: 18 },
    { month: "Jul", enrollments: 275, workshops: 19 }, { month: "Aug", enrollments: 290, workshops: 20 },
    { month: "Sep", enrollments: 305, workshops: 21 }, { month: "Oct", enrollments: 330, workshops: 23 },
    { month: "Nov", enrollments: 355, workshops: 24 }, { month: "Dec", enrollments: 380, workshops: 26 }
  ];
  return (
    <div className="space-y-4 rounded-xl bg-[#F3F4F6] p-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Revenue Overview</h2>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-bold text-[#1E3A8A]">₹31,85,000</p>
            <p className="text-sm text-gray-600">+16.3% vs previous month</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Product A", "42%", "text-blue-700"],
              ["Service B", "33%", "text-emerald-600"],
              ["Program C", "25%", "text-indigo-600"]
            ].map(([label, val, tone]) => (
              <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm" key={label}>
                <p className="text-gray-500">{label}</p><p className={cn("font-semibold", tone)}>{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { title: "Total Workshops", value: "148", icon: CalendarDays },
          { title: "Upcoming Workshops", value: "22", icon: Timer },
          { title: "Total Members", value: formatNumber(leads.length), icon: UsersRound },
          { title: "Total Revenue", value: "₹1.28Cr", icon: CircleDollarSign }
        ] satisfies Array<{ title: string; value: string; icon: LucideIcon }>).map((item) => {
          const Icon = item.icon;
          return <div className="rounded-xl bg-white p-4 shadow-sm" key={item.title}><Icon className="size-5 text-[#1E3A8A]" /><p className="mt-2 text-sm text-gray-600">{item.title}</p><p className="text-2xl font-bold text-slate-900">{item.value}</p></div>;
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Event Registration Status</h3>
            <button className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">Excel Download</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-gray-100 text-left text-xs font-bold uppercase text-gray-700"><tr><th className="px-3 py-2">Event Name</th><th className="px-3 py-2">Date Range</th><th className="px-3 py-2">Latest Registrant Name</th><th className="px-3 py-2">Total Registrations</th><th className="px-3 py-2">New Registrations</th></tr></thead>
              <tbody>
                {[
                  ["Leadership Sprint", "1 Jun - 3 Jun", "Rohan Mehta", "320", "28"],
                  ["Sales Mastery", "10 Jun - 12 Jun", "Priya Nair", "275", "19"],
                  ["Mindset Reset", "18 Jun - 20 Jun", "Neha Kapoor", "241", "14"]
                ].map((row) => <tr className="border-b border-gray-100" key={row[0]}>{row.map((cell) => <td className="px-3 py-2.5" key={`${row[0]}-${cell}`}>{cell}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Upcoming Event</p>
          <div className="mt-3 rounded-lg border border-gray-200 p-3">
            <span className="rounded bg-[#1E3A8A] px-2 py-1 text-xs font-semibold text-white">24 Jun</span>
            <p className="mt-2 font-semibold">Growth Accelerator Bootcamp</p>
            <p className="text-sm text-gray-600">Location: Zoom</p>
            <button className="mt-3 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-white">Registration Link</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">User Enrollment Report</h3>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="workshops" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Line dataKey="enrollments" stroke="#1E3A8A" strokeWidth={3} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function PremiumDashboardHome({
  leads
}: {
  leads: Lead[];
}) {
  const chartData = [
    { month: "Jan", enrollments: 120, workshops: 10 }, { month: "Feb", enrollments: 145, workshops: 12 },
    { month: "Mar", enrollments: 170, workshops: 13 }, { month: "Apr", enrollments: 195, workshops: 15 },
    { month: "May", enrollments: 220, workshops: 17 }, { month: "Jun", enrollments: 260, workshops: 18 },
    { month: "Jul", enrollments: 275, workshops: 19 }, { month: "Aug", enrollments: 290, workshops: 20 },
    { month: "Sep", enrollments: 305, workshops: 21 }, { month: "Oct", enrollments: 330, workshops: 23 },
    { month: "Nov", enrollments: 355, workshops: 24 }, { month: "Dec", enrollments: 380, workshops: 26 }
  ];

  return (
    <div className="space-y-3 rounded-xl bg-[#f3f4f6] p-3">
      <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">Revenue Overview</p>
            <p className="mt-2 text-4xl font-bold text-indigo-900">INR 31,85,000</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              <ArrowUpRight className="size-3.5" />
              +16.3% vs previous month
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Product A", "42%", "bg-indigo-50 text-indigo-700 border-indigo-100"],
              ["Service B", "33%", "bg-emerald-50 text-emerald-700 border-emerald-100"],
              ["Program C", "25%", "bg-violet-50 text-violet-700 border-violet-100"]
            ].map(([label, val, tone]) => (
              <div className={cn("rounded-xl border px-3 py-2.5 text-sm", tone)} key={label}>
                <p className="font-medium">{label}</p>
                <p className="mt-1 text-xl font-bold">{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { title: "Total Workshops", value: "148", icon: CalendarDays, tone: "bg-indigo-50 text-indigo-700" },
          { title: "Upcoming Workshops", value: "22", icon: Timer, tone: "bg-cyan-50 text-cyan-700" },
          { title: "Total Members", value: formatNumber(leads.length), icon: UsersRound, tone: "bg-violet-50 text-violet-700" },
          { title: "Total Revenue", value: "INR 1.28Cr", icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-700" }
        ] satisfies Array<{ title: string; value: string; icon: LucideIcon; tone: string }>).map((item) => {
          const Icon = item.icon;
          return (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" key={item.title}>
              <div className={cn("inline-flex rounded-lg p-2", item.tone)}>
                <Icon className="size-5" />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">{item.title}</p>
              <p className="text-2xl font-bold text-slate-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Event Registration Status</h3>
            <button className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Excel Download
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold uppercase text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Event Name</th>
                  <th className="px-3 py-2.5">Date Range</th>
                  <th className="px-3 py-2.5">Latest Registrant Name</th>
                  <th className="px-3 py-2.5">Total Registrations</th>
                  <th className="px-3 py-2.5">New Registrations</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Leadership Sprint", "1 Jun - 3 Jun", "Rohan Mehta", "320", "28"],
                  ["Sales Mastery", "10 Jun - 12 Jun", "Priya Nair", "275", "19"],
                  ["Mindset Reset", "18 Jun - 20 Jun", "Neha Kapoor", "241", "14"]
                ].map((row, rowIndex) => (
                  <tr className={cn("border-b border-gray-100", rowIndex % 2 === 1 && "bg-indigo-50/30")} key={row[0]}>
                    {row.map((cell) => (
                      <td className="px-3 py-2.5" key={`${row[0]}-${cell}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Upcoming Event</p>
          <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
            <span className="rounded-md bg-indigo-700 px-2 py-1 text-xs font-semibold text-white">24 Jun</span>
            <p className="mt-2 text-xl font-semibold text-slate-900">Growth Accelerator Bootcamp</p>
            <p className="mt-1 text-sm text-gray-600">Location: Zoom</p>
            <button className="mt-3 w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
              Registration Link
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">User Enrollment Report</h3>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={chartData}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="workshops" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Line dataKey="enrollments" stroke="#4f46e5" strokeWidth={3} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
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
    <section className="rounded-lg border border-ink-900/10 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        {Icon ? <Icon className="size-4 text-ink-400" /> : null}
        <div className="ml-auto flex items-center gap-2">
          {action}
          <button
            className="flex items-center gap-1 rounded-md border border-ink-900/10 px-2 py-1 text-[11px] font-semibold text-ink-600 transition hover:bg-ink-900/[0.04] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
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
        <div className="rounded-md border border-dashed border-ink-900/20 px-3 py-4 text-center text-xs font-medium text-ink-500 dark:border-white/20 dark:text-slate-400">
          Section collapsed.
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
  actions: _actions,
  eyebrow: _eyebrow,
  icon: _Icon,
  title: _title
}: {
  actions?: React.ReactNode;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}) {
  return null;
}

function CRMView({
  assignLeadsToSalesPerson,
  addLead,
  deleteLeadsByIds,
  deleteSelectedLead,
  leads,
  moveLeadForward,
  selectedLead,
  setSelectedLeadId,
  updateSelectedLead
}: {
  assignLeadsToSalesPerson: (leadIds: string[], salesPerson: string) => void;
  addLead: (input?: Partial<Pick<Lead, "name" | "mobile" | "email" | "city" | "state" | "country" | "source">>) => void;
  deleteLeadsByIds: (leadIds: string[]) => void;
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
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
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

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredLeads.map((lead) => lead.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedLeadIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  function handleAssignSelected() {
    if (!selectedLeadIds.length) {
      emitActionNote("Select leads first for assignment.");
      return;
    }
    if (!selectedSalesPerson.trim()) {
      emitActionNote("Select sales person first.");
      return;
    }
    assignLeadsToSalesPerson(selectedLeadIds, selectedSalesPerson);
    setSelectedLeadIds([]);
  }

  function handleDeleteSelected() {
    if (!selectedLeadIds.length) {
      emitActionNote("Select leads first to delete.");
      return;
    }
    deleteLeadsByIds(selectedLeadIds);
    setSelectedLeadIds([]);
  }

  return (
    <div>
      <ModuleHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <select className="rounded-lg border border-ink-900/10 px-3 py-2 text-sm dark:border-white/10" onChange={(event) => setSelectedSalesPerson(event.target.value)} value={selectedSalesPerson}>
              <option value="">Assign to sales person</option>
              {[...new Set(teamMembers.map((member) => member.name))].map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
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
              onClick={handleAssignSelected}
              type="button"
            >
              Assign selected
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
              onClick={handleDeleteSelected}
              type="button"
            >
              Delete selected
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
            <div className="grid min-w-[760px] grid-cols-[40px_1.3fr_120px_115px_115px_88px] bg-[#f6f8f4] px-3 py-2 text-xs font-bold text-ink-500 dark:bg-white/[0.05] dark:text-slate-400">
              <span>
                <input
                  checked={filteredLeads.length > 0 && filteredLeads.every((lead) => selectedLeadIds.includes(lead.id))}
                  className="size-4 accent-indigo-600"
                  onChange={toggleSelectAllVisible}
                  type="checkbox"
                />
              </span>
              <span>Contact</span>
              <span>City</span>
              <span>Stage</span>
              <span>Owner</span>
              <span className="text-right">Score</span>
            </div>
            {filteredLeads.map((lead) => (
              <button
                className={cn(
                  "grid w-full min-w-[760px] grid-cols-[40px_1.3fr_120px_115px_115px_88px] items-center border-t border-ink-900/10 px-3 py-3 text-left text-sm transition hover:bg-mint-50/70 dark:border-white/10 dark:hover:bg-white/[0.06]",
                  selectedLead.id === lead.id && "bg-mint-50 dark:bg-mint-500/10"
                )}
                key={lead.id}
                onClick={() => {
                  setSelectedLeadId(lead.id);
                  setLeadProfileOpen(true);
                }}
                type="button"
              >
                <span onClick={(event) => event.stopPropagation()}>
                  <input
                    checked={selectedLeadIds.includes(lead.id)}
                    className="size-4 accent-indigo-600"
                    onChange={() => toggleLeadSelection(lead.id)}
                    type="checkbox"
                  />
                </span>
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
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    date: "",
    receipt: "",
    remarks: "",
    salesPerson: ""
  });
  const [paymentErrors, setPaymentErrors] = useState<{ amount?: string; date?: string; salesPerson?: string }>({});

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

  function clearPaymentForm() {
    setPaymentForm({ amount: "", date: "", receipt: "", remarks: "", salesPerson: "" });
    setPaymentErrors({});
  }

  function savePaymentForm() {
    const errors: { amount?: string; date?: string; salesPerson?: string } = {};
    if (!paymentForm.date) errors.date = "Payment date is required";
    if (!paymentForm.salesPerson) errors.salesPerson = "Sales person is required";
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) errors.amount = "Amount is required";
    setPaymentErrors(errors);
    if (Object.keys(errors).length) return;
    emitActionNote(`Sales payment saved for ${paymentForm.salesPerson}.`);
    clearPaymentForm();
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

        <div className="rounded-lg bg-gray-100 p-2">
          <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
            <button className="rounded-md border border-gray-200 p-2 text-gray-600" type="button"><Menu className="size-4" /></button>
            <p className="text-sm font-medium text-gray-700">User Name</p>
          </div>
          <div className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Manage Sales Person Payment</h3>
              <button className="rounded-md border border-indigo-500 px-3 py-2 text-sm font-medium text-indigo-600" type="button">View Data</button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block text-sm text-gray-700">Payment Date<input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" type="date" value={paymentForm.date} onChange={(event) => setPaymentForm((current) => ({ ...current, date: event.target.value }))} />{paymentErrors.date ? <span className="mt-1 block text-xs text-red-600">{paymentErrors.date}</span> : null}</label>
              <label className="block text-sm text-gray-700">Sales Person<select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={paymentForm.salesPerson} onChange={(event) => setPaymentForm((current) => ({ ...current, salesPerson: event.target.value }))}><option value="">Search and select</option>{[...new Set(teamMembers.map((member) => member.name))].map((name) => <option key={name} value={name}>{name}</option>)}</select>{paymentErrors.salesPerson ? <span className="mt-1 block text-xs text-red-600">{paymentErrors.salesPerson}</span> : null}</label>
              <label className="block text-sm text-gray-700">Amount<input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter amount" type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />{paymentErrors.amount ? <span className="mt-1 block text-xs text-red-600">{paymentErrors.amount}</span> : null}</label>
              <label className="block text-sm text-gray-700 md:col-span-3">Remarks<textarea className="mt-1 min-h-[92px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={paymentForm.remarks} onChange={(event) => setPaymentForm((current) => ({ ...current, remarks: event.target.value }))} /></label>
              <label className="block text-sm text-gray-700 md:col-span-3">Payment Acknowledgement Receipt<input className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm" type="file" onChange={(event) => setPaymentForm((current) => ({ ...current, receipt: event.target.files?.[0]?.name ?? "" }))} />{paymentForm.receipt ? <span className="mt-1 block text-xs text-gray-500">Selected: {paymentForm.receipt}</span> : null}</label>
            </div>
            <div className="mt-5 flex gap-2">
              <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={savePaymentForm} type="button">Save</button>
              <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800" onClick={clearPaymentForm} type="button">Clear</button>
            </div>
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
  addClientToWorkshop,
  deleteSelectedWorkshop,
  leads,
  registrations,
  updateSelectedWorkshop,
  selectedWorkshop,
  setSelectedWorkshopId,
  workshops
}: {
  addWorkshop: (input: { city?: string; price?: number; title: string; trainer?: string; type?: WorkshopType }) => void;
  addClientToWorkshop: (input: {
    leadId: string;
    paymentMode: "Full" | "Part";
    partAmount?: number;
    workshopId: string;
  }) => void;
  deleteSelectedWorkshop: () => void;
  leads: Lead[];
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
    feesWithGst: "",
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
  const [showWorkshopParticipants, setShowWorkshopParticipants] = useState(false);
  const [clientRegistrationForm, setClientRegistrationForm] = useState({
    leadId: "",
    partAmount: "",
    paymentMode: "Full" as "Full" | "Part",
    workshopId: ""
  });
  const bulkImportInputRef = useRef<HTMLInputElement | null>(null);
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

  const currentWorkshopForViewData =
    workshops.find((item) => item.id === selectedWorkshop?.id) ??
    workshops.find((item) => item.title === form.title.trim());
  const workshopParticipants = registrations.filter(
    (entry) => entry.workshopId === currentWorkshopForViewData?.id
  );

  function clearWorkshopMasterForm() {
    setForm({
      city: "Surat",
      isPaid: true,
      productGroup: "Leadership",
      title: "",
      trainer: "Arjun Sharma",
      type: "Hybrid"
    });
    setDefaultFields({
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
    emitActionNote("Workshop master form cleared.");
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
      feesWithGst: "",
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

  const selectableLeads = useMemo(
    () =>
      leads
        .filter((lead) => digitsOnly(lead.mobile).length >= 10)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [leads]
  );

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

  function submitClientWorkshopRegistration() {
    const workshopId = clientRegistrationForm.workshopId || selectedWorkshop?.id || "";
    if (!clientRegistrationForm.leadId || !workshopId) {
      emitActionNote("Select client and workshop first.");
      return;
    }

    addClientToWorkshop({
      leadId: clientRegistrationForm.leadId,
      paymentMode: clientRegistrationForm.paymentMode,
      partAmount: Number(clientRegistrationForm.partAmount || 0),
      workshopId
    });

    setClientRegistrationForm({
      leadId: "",
      partAmount: "",
      paymentMode: "Full",
      workshopId
    });
  }

  function downloadBulkImportSample() {
    const headers = ["mobile", "payment_mode", "part_amount"];
    const rows = [
      ["9825011843", "Full", ""],
      ["9898022314", "Part", "2500"]
    ];
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workshop-bulk-import-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    emitActionNote("Bulk import sample downloaded.");
  }

  function handleBulkImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const workshopId = clientRegistrationForm.workshopId || selectedWorkshop?.id || "";
    if (!workshopId) {
      emitActionNote("Bulk import mate workshop select karo.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const lines = raw.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        emitActionNote("CSV empty che.");
        return;
      }

      const parsedRows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
      let added = 0;
      parsedRows.forEach((cells) => {
        const mobile = digitsOnly(cells[0] || "");
        const mode = (cells[1] || "Full").toLowerCase() === "part" ? "Part" : "Full";
        const partAmount = Number(cells[2] || 0);
        if (mobile.length < 10) return;
        const lead = selectableLeads.find((item) => digitsOnly(item.mobile) === mobile);
        if (!lead) return;
        addClientToWorkshop({
          leadId: lead.id,
          paymentMode: mode,
          partAmount,
          workshopId
        });
        added += 1;
      });
      emitActionNote(`Bulk import complete: ${added} clients added.`);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

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

      <Panel defaultOpen title="Add Client From CRM To Workshop">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <button
            className="rounded-md border border-indigo-500 px-3 py-1.5 text-xs font-semibold text-indigo-600"
            onClick={downloadBulkImportSample}
            type="button"
          >
            Download Sample
          </button>
          <input
            accept=".csv"
            className="hidden"
            onChange={handleBulkImport}
            ref={bulkImportInputRef}
            type="file"
          />
          <button
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
            onClick={() => bulkImportInputRef.current?.click()}
            type="button"
          >
            Bulk Import CSV
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-sm font-semibold">Client</label>
            <select
              className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) =>
                setClientRegistrationForm((current) => ({ ...current, leadId: event.target.value }))
              }
              value={clientRegistrationForm.leadId}
            >
              <option value="">Select CRM Client</option>
              {selectableLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} | {lead.mobile}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Workshop</label>
            <select
              className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) =>
                setClientRegistrationForm((current) => ({ ...current, workshopId: event.target.value }))
              }
              value={clientRegistrationForm.workshopId || selectedWorkshop?.id || ""}
            >
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Payment Mode</label>
            <select
              className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]"
              onChange={(event) =>
                setClientRegistrationForm((current) => ({
                  ...current,
                  paymentMode: event.target.value as "Full" | "Part"
                }))
              }
              value={clientRegistrationForm.paymentMode}
            >
              <option value="Full">Full Payment</option>
              <option value="Part">Part Payment</option>
            </select>
          </div>
          {clientRegistrationForm.paymentMode === "Part" ? (
            <div>
              <label className="mb-1 block text-sm font-semibold">Part Amount</label>
              <input
                className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]"
                onChange={(event) =>
                  setClientRegistrationForm((current) => ({ ...current, partAmount: event.target.value }))
                }
                placeholder="Enter amount"
                value={clientRegistrationForm.partAmount}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            className="rounded-lg bg-mint-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={submitClientWorkshopRegistration}
            type="button"
          >
            Add Client To Workshop
          </button>
        </div>
      </Panel>

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
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="flex items-center justify-between rounded-md bg-white px-4 py-3 shadow-sm">
            <button className="rounded-md border border-gray-200 p-2 text-gray-600" type="button">
              <Menu className="size-4" />
            </button>
            <p className="text-sm font-medium text-gray-700">Welcome User</p>
          </div>
          <div className="mx-auto mt-6 max-w-6xl rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-gray-900">Manage Workshop Master</h3>
              <button
                className="rounded-md border border-indigo-500 px-3 py-2 text-sm font-medium text-indigo-600"
                onClick={() => {
                  setShowWorkshopParticipants((state) => !state);
                  if (!currentWorkshopForViewData) {
                    emitActionNote("Workshop save/select karo pachhi participants dekhase.");
                    return;
                  }
                  emitActionNote(
                    `${currentWorkshopForViewData.title} participants loaded: ${workshopParticipants.length}.`
                  );
                }}
                type="button"
              >
                {showWorkshopParticipants ? "Hide Data" : "View Data"}
              </button>
            </div>
            {showWorkshopParticipants ? (
              <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-indigo-900">
                    {currentWorkshopForViewData?.title ?? "Workshop"} Participants
                  </p>
                  <span className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white">
                    {workshopParticipants.length}
                  </span>
                </div>
                {workshopParticipants.length ? (
                  <div className="overflow-x-auto rounded-md border border-indigo-100 bg-white">
                    <table className="min-w-[680px] w-full text-sm">
                      <thead className="bg-indigo-50 text-left text-xs font-semibold uppercase text-indigo-700">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Mobile</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Payment</th>
                          <th className="px-3 py-2">Reg. Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workshopParticipants.map((entry, index) => (
                          <tr
                            className={cn("border-t border-indigo-50", index % 2 === 1 && "bg-indigo-50/30")}
                            key={entry.id}
                          >
                            <td className="px-3 py-2">{entry.fullName}</td>
                            <td className="px-3 py-2">{entry.mobile}</td>
                            <td className="px-3 py-2">{entry.email}</td>
                            <td className="px-3 py-2">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs font-semibold text-white",
                                  entry.status === "Paid" ? "bg-emerald-500" : "bg-amber-500"
                                )}
                              >
                                {entry.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">{entry.createdAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-indigo-700">Aa workshop ma haju koi participant add nathi.</p>
                )}
              </div>
            ) : null}
            <label className="block text-sm text-gray-600">
              Workshop/Product Name
              <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            </label>
            <div className="mt-4 grid grid-cols-1 items-center gap-4 md:grid-cols-4">
              <label className="block text-sm text-gray-600">Workshop Type
                <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as WorkshopType }))} value={form.type}>
                  <option value="Online">Online</option><option value="Offline">Offline</option><option value="Hybrid">Hybrid</option>
                </select>
              </label>
              <label className="block text-sm text-gray-600">Default Facilitator
                <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setForm((current) => ({ ...current, trainer: event.target.value }))} value={form.trainer} />
              </label>
              <label className="block text-sm text-gray-600">Product Group
                <select className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setForm((current) => ({ ...current, productGroup: event.target.value }))} value={form.productGroup}>
                  <option>Leadership</option><option>Sales</option><option>Coaching</option><option>Communication</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 md:pt-6">
                <input checked={form.isPaid} className="size-4 accent-indigo-600" onChange={(event) => setForm((current) => ({ ...current, isPaid: event.target.checked }))} type="checkbox" />
                Is Paid?
              </label>
            </div>
            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <p className="text-sm font-semibold text-gray-600">Default Setting For Workshop</p>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {[
                ["firstName", "First Name"], ["lastName", "Last Name"], ["mobile", "Mobile"], ["email", "Email"],
                ["country", "Country"], ["state", "State"], ["city", "City"], ["address", "Address"],
                ["age", "Age"], ["gender", "Gender"], ["occupation", "Occupation"]
              ].map(([key, label]) => (
                <label className="flex cursor-pointer items-center justify-between rounded-md border border-gray-200 p-3 hover:bg-gray-50" key={key}>
                  <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input checked={defaultFields[key as keyof typeof defaultFields]} className="size-4 accent-indigo-600" onChange={() => toggleField(key as keyof typeof defaultFields)} type="checkbox" />
                    {label}
                  </span>
                  <HelpCircle className="text-gray-400" size={16} />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!form.title.trim()} onClick={saveWorkshopForm} type="button">{formMode === "create" ? "Save" : "Update"}</button>
              <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700" onClick={clearWorkshopMasterForm} type="button">Clear</button>
            </div>
          </div>
        </div>
      ) : null}

      {isScheduleOpen ? (
        <ManageWorkshopScheduleForm
          facilitators={[...new Set(workshops.map((item) => item.trainer).filter(Boolean))]}
          onClear={clearScheduleForm}
          onSave={() => saveScheduleConfig()}
          venues={["Online Zoom", "Surat", "Ahmedabad", "Mumbai"]}
          workshops={workshops.map((item) => ({ id: item.id, title: item.title }))}
        />
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
  const [memberFilters, setMemberFilters] = useState({
    batch: "ALL",
    city: "ALL",
    country: "ALL",
    facilitator: "ALL",
    from: "",
    salesPerson: "ALL",
    state: "ALL",
    status: "ALL",
    to: "",
    workshop: "ALL"
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPageSize, setMemberPageSize] = useState(10);
  const [memberPage, setMemberPage] = useState(1);
  const [clientStatusFilter, setClientStatusFilter] = useState("All");
  const [clientSearch, setClientSearch] = useState("");
  const [clientPageSize, setClientPageSize] = useState(10);
  const [clientPage, setClientPage] = useState(1);
  const [clientDarkMode, setClientDarkMode] = useState(false);
  const [refundFilters, setRefundFilters] = useState({ from: "", status: "ALL", to: "" });
  const [refundSearch, setRefundSearch] = useState("");
  const [refundPageSize, setRefundPageSize] = useState(10);
  const [refundPage, setRefundPage] = useState(1);
  const [batchTransferForm, setBatchTransferForm] = useState({
    fromBatch: "",
    keywords: "",
    remarks: "",
    toBatch: ""
  });

  const memberRows = [
    { name: "Rohan Mehta", mobile: "+91 98250 11843", email: "rohan@example.com", regDate: "2026-04-20", workshop: "Leadership Sprint", salesPerson: "Neha Kapoor", facilitator: "Arjun Sharma", state: "Gujarat", city: "Surat", status: "Success", source: "Instagram Ads", country: "India", batch: "A1" },
    { name: "Priya Nair", mobile: "+91 98980 22314", email: "priya@example.com", regDate: "2026-04-22", workshop: "Sales Mastery", salesPerson: "Amit Verma", facilitator: "Rakesh Jain", state: "Maharashtra", city: "Mumbai", status: "Success", source: "Referral", country: "India", batch: "B2" },
    { name: "Sumeet Shah", mobile: "+91 99099 44112", email: "sumeet@example.com", regDate: "2026-04-24", workshop: "Mindset Reset", salesPerson: "Neha Kapoor", facilitator: "Arjun Sharma", state: "Gujarat", city: "Ahmedabad", status: "Failed", source: "Website", country: "India", batch: "A1" },
    { name: "GlobalSoft HR", mobile: "+91 98795 78441", email: "hr@globalsoft.com", regDate: "2026-04-26", workshop: "Corporate Influence", salesPerson: "Rohan Patel", facilitator: "Devansh Rao", state: "Karnataka", city: "Bengaluru", status: "Success", source: "WhatsApp", country: "India", batch: "C3" },
    { name: "Harsha Iyer", mobile: "+91 90012 33445", email: "harsha@example.com", regDate: "2026-04-28", workshop: "Sales Mastery", salesPerson: "Amit Verma", facilitator: "Rakesh Jain", state: "Tamil Nadu", city: "Chennai", status: "Failed", source: "Email Campaign", country: "India", batch: "B2" }
  ];
  const clientRows = [
    { clientId: "CFL001", name: "Rohan Mehta", mobile: "+91 98250 11843", email: "rohan@demo.com", dob: "1991-07-21", gender: "Male", occupation: "Entrepreneur", country: "India", state: "Gujarat", city: "Surat", status: "Active" },
    { clientId: "CFL002", name: "Priya Nair", mobile: "+91 98980 22314", email: "priya@demo.com", dob: "1994-12-08", gender: "Female", occupation: "Coach", country: "India", state: "Maharashtra", city: "Mumbai", status: "Inactive" },
    { clientId: "CFL003", name: "Sumeet Shah", mobile: "+91 99099 44112", email: "sumeet@demo.com", dob: "1989-03-14", gender: "Male", occupation: "Consultant", country: "India", state: "Gujarat", city: "Ahmedabad", status: "Inactive" },
    { clientId: "CFL004", name: "Neha Kapoor", mobile: "+91 98795 78441", email: "neha@demo.com", dob: "1996-10-04", gender: "Female", occupation: "Trainer", country: "India", state: "Delhi", city: "Delhi", status: "Active" }
  ];
  const refundRows = [
    { status: "Success", regDate: "2026-04-10", name: "Rohan Mehta", mobile: "+91 98250 11843", amount: 9900, workshop: "Leadership Sprint", batch: "A1", paymentId: "pay_RH001", orderId: "order_RH001" },
    { status: "Refund", regDate: "2026-04-12", name: "Priya Nair", mobile: "+91 98980 22314", amount: 14900, workshop: "Sales Mastery", batch: "B2", paymentId: "pay_PR002", orderId: "order_PR002" },
    { status: "Success", regDate: "2026-04-15", name: "Sumeet Shah", mobile: "+91 99099 44112", amount: 7900, workshop: "Mindset Reset", batch: "C1", paymentId: "pay_SU003", orderId: "order_SU003" },
    { status: "Refund", regDate: "2026-04-18", name: "Neha Kapoor", mobile: "+91 98795 78441", amount: 19900, workshop: "Corporate Influence", batch: "D4", paymentId: "pay_NE004", orderId: "order_NE004" }
  ];

  const filteredMemberRows = useMemo(() => {
    return memberRows.filter((row) => {
      if (memberFilters.workshop !== "ALL" && row.workshop !== memberFilters.workshop) return false;
      if (memberFilters.batch !== "ALL" && row.batch !== memberFilters.batch) return false;
      if (memberFilters.salesPerson !== "ALL" && row.salesPerson !== memberFilters.salesPerson) return false;
      if (memberFilters.facilitator !== "ALL" && row.facilitator !== memberFilters.facilitator) return false;
      if (memberFilters.status !== "ALL" && row.status !== memberFilters.status) return false;
      if (memberFilters.country !== "ALL" && row.country !== memberFilters.country) return false;
      if (memberFilters.state !== "ALL" && row.state !== memberFilters.state) return false;
      if (memberFilters.city !== "ALL" && row.city !== memberFilters.city) return false;
      if (memberFilters.from && row.regDate < memberFilters.from) return false;
      if (memberFilters.to && row.regDate > memberFilters.to) return false;
      const haystack = normalizeSearch(`${row.name} ${row.mobile} ${row.email} ${row.source}`);
      if (memberSearch.trim() && !haystack.includes(normalizeSearch(memberSearch))) return false;
      return true;
    });
  }, [memberFilters, memberSearch]);
  const filteredClientRows = useMemo(() => {
    return clientRows.filter((row) => {
      if (clientStatusFilter !== "All" && row.status !== clientStatusFilter) return false;
      if (!clientSearch.trim()) return true;
      return normalizeSearch(`${row.name} ${row.mobile} ${row.email} ${row.clientId} ${row.city}`).includes(normalizeSearch(clientSearch));
    });
  }, [clientSearch, clientStatusFilter]);
  const clientStatusSummary = useMemo(() => {
    const active = clientRows.filter((row) => row.status === "Active").length;
    const inactive = clientRows.length - active;
    return {
      active,
      all: clientRows.length,
      inactive
    };
  }, [clientRows]);
  const filteredRefundRows = useMemo(() => {
    return refundRows.filter((row) => {
      if (refundFilters.status !== "ALL" && row.status !== refundFilters.status) return false;
      if (refundFilters.from && row.regDate < refundFilters.from) return false;
      if (refundFilters.to && row.regDate > refundFilters.to) return false;
      if (!refundSearch.trim()) return true;
      return normalizeSearch(`${row.name} ${row.mobile} ${row.workshop} ${row.paymentId} ${row.orderId}`).includes(normalizeSearch(refundSearch));
    });
  }, [refundFilters, refundSearch]);
  const refundPageCount = Math.max(1, Math.ceil(filteredRefundRows.length / refundPageSize));
  const safeRefundPage = Math.min(refundPage, refundPageCount);
  const refundStart = (safeRefundPage - 1) * refundPageSize;
  const pagedRefundRows = filteredRefundRows.slice(refundStart, refundStart + refundPageSize);
  const clientPageCount = Math.max(1, Math.ceil(filteredClientRows.length / clientPageSize));
  const safeClientPage = Math.min(clientPage, clientPageCount);
  const clientStart = (safeClientPage - 1) * clientPageSize;
  const pagedClientRows = filteredClientRows.slice(clientStart, clientStart + clientPageSize);

  const totalMemberRows = filteredMemberRows.length;
  const memberPageCount = Math.max(1, Math.ceil(totalMemberRows / memberPageSize));
  const safeMemberPage = Math.min(memberPage, memberPageCount);
  const memberStartIndex = (safeMemberPage - 1) * memberPageSize;
  const pagedMemberRows = filteredMemberRows.slice(memberStartIndex, memberStartIndex + memberPageSize);

  function exportMemberCsv() {
    const headers = ["name", "mobile", "email", "reg_date", "workshop", "sales_person", "facilitator", "state", "city", "status", "source"];
    const rows = filteredMemberRows.map((row) =>
      [row.name, row.mobile, row.email, row.regDate, row.workshop, row.salesPerson, row.facilitator, row.state, row.city, row.status, row.source]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "member-management-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function exportClientCsv() {
    const headers = ["client_id", "name", "mobile", "email", "dob", "gender", "occupation", "country", "state", "city", "status"];
    const rows = filteredClientRows.map((row) =>
      [row.clientId, row.name, row.mobile, row.email, row.dob, row.gender, row.occupation, row.country, row.state, row.city, row.status]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "manage-client.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function submitBatchTransfer() {
    // Mock submit flow for UI testing.
    console.log("Client Batch Transfer Submit", batchTransferForm);
    emitActionNote("Client batch transfer request saved.");
  }

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
          {selectedReport === "Client Milestone" && (
            <div className={cn("rounded-lg bg-gray-50 p-2", clientDarkMode && "bg-slate-900")}>
              <div className="flex items-center justify-between rounded-xl border border-white/70 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                <button className="rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-600" type="button">
                  <Menu className="size-4" />
                </button>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-700"
                    onClick={() => setClientDarkMode((state) => !state)}
                    type="button"
                  >
                    {clientDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  </button>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Client Ops</p>
                    <p className="text-sm font-semibold text-gray-900">Welcome User</p>
                  </div>
                </div>
              </div>

              <div className="m-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900">Manage Client</h3>
                    <p className="mt-1 text-sm text-gray-500">Fast filters, compact controls, and real-time search.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">All</p>
                      <p className="text-lg font-bold text-indigo-900">{clientStatusSummary.all}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Active</p>
                      <p className="text-lg font-bold text-emerald-900">{clientStatusSummary.active}</p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Inactive</p>
                      <p className="text-lg font-bold text-amber-900">{clientStatusSummary.inactive}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4 max-w-sm">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Search By Status</label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    onChange={(event) => {
                      setClientPage(1);
                      setClientStatusFilter(event.target.value);
                    }}
                    value={clientStatusFilter}
                  >
                    <option>All</option>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-white px-2 py-1.5 shadow-sm">
                    <span className="text-sm text-gray-700">Show</span>
                    <select
                      className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      onChange={(event) => {
                        setClientPage(1);
                        setClientPageSize(Number(event.target.value));
                      }}
                      value={String(clientPageSize)}
                    >
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                    </select>
                    <span className="text-sm text-gray-700">entries</span>
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
                      onClick={exportClientCsv}
                      type="button"
                    >
                      <Download className="size-4" />
                      Export
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 shadow-sm">
                    <Search className="size-4 text-violet-500" />
                    <input
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      onChange={(event) => {
                        setClientPage(1);
                        setClientSearch(event.target.value);
                      }}
                      placeholder="Search client..."
                      value={clientSearch}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-[1400px] w-full text-sm">
                    <thead className="bg-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-700">
                      <tr>
                        {[
                          "Action",
                          "Status",
                          "Client ID",
                          "Name",
                          "Mobile",
                          "Email",
                          "D.O.B",
                          "Gender",
                          "Occupation",
                          "Country",
                          "State",
                          "City"
                        ].map((head) => (
                          <th className="whitespace-nowrap border-b border-gray-200 px-3 py-3" key={head}>
                            <span className="inline-flex items-center gap-1">
                              {head}
                              <ChevronUp className="size-3 text-violet-400" />
                              <ChevronDown className="size-3 text-violet-400" />
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {pagedClientRows.map((row, index) => (
                        <tr className={cn("border-b border-gray-100", index % 2 === 1 && "bg-violet-50/30")} key={row.clientId}>
                          <td className="px-3 py-2.5">
                            <button className="rounded-md bg-violet-600 p-2 text-white shadow-sm hover:bg-violet-700" type="button">
                              <SquarePen className="size-4" />
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-semibold text-white",
                                row.status === "Active" ? "bg-emerald-500" : "bg-amber-500"
                              )}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.clientId}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.name}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.mobile}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.email}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.dob}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.gender}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.occupation}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.country}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.state}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">{row.city}</td>
                        </tr>
                      ))}
                      {!pagedClientRows.length ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-sm text-gray-500" colSpan={12}>
                            No records found
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                  <p>
                    Showing {filteredClientRows.length ? clientStart + 1 : 0} to{" "}
                    {Math.min(clientStart + clientPageSize, filteredClientRows.length)} of {filteredClientRows.length}{" "}
                    entries
                  </p>
                  <div className="inline-flex items-center overflow-hidden rounded-md border border-gray-300">
                    <button
                      className="border-r border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      disabled={safeClientPage === 1}
                      onClick={() => setClientPage((page) => Math.max(1, page - 1))}
                      type="button"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(clientPageCount, 3) }).map((_, index) => {
                      const pageNumber = index + 1;
                      return (
                        <button
                          className={cn(
                            "border-r border-gray-300 px-3 py-1.5 hover:bg-gray-50",
                            safeClientPage === pageNumber && "bg-violet-600 text-white hover:bg-violet-700"
                          )}
                          key={pageNumber}
                          onClick={() => setClientPage(pageNumber)}
                          type="button"
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    {clientPageCount > 3 ? <span className="border-r border-gray-300 px-2 py-1.5">...</span> : null}
                    <button
                      className="px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      disabled={safeClientPage === clientPageCount}
                      onClick={() => setClientPage((page) => Math.min(clientPageCount, page + 1))}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {selectedReport === "Member Details" && (
            <div className="rounded-lg bg-gray-50 p-2 font-sans">
              <div className="flex items-center justify-between rounded-md bg-white px-4 py-3 shadow-sm">
                <button className="rounded-md border border-gray-200 p-2 text-gray-600" type="button"><Menu className="size-4" /></button>
                <p className="text-sm font-medium text-gray-700">Welcome User</p>
              </div>
              <div className="m-4 overflow-hidden rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-2xl font-semibold text-gray-900">Member Management</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {([
                    { label: "Workshop", key: "workshop", values: [...new Set(memberRows.map((row) => row.workshop))] },
                    { label: "Batch", key: "batch", values: [...new Set(memberRows.map((row) => row.batch))] },
                    { label: "Sales Person", key: "salesPerson", values: [...new Set(memberRows.map((row) => row.salesPerson))] },
                    { label: "Facilitators", key: "facilitator", values: [...new Set(memberRows.map((row) => row.facilitator))] },
                    { label: "Status", key: "status", values: ["Success", "Failed"] },
                    { label: "Country", key: "country", values: [...new Set(memberRows.map((row) => row.country))] },
                    { label: "State", key: "state", values: [...new Set(memberRows.map((row) => row.state))] },
                    { label: "City", key: "city", values: [...new Set(memberRows.map((row) => row.city))] }
                  ] satisfies Array<{ label: string; key: keyof typeof memberFilters; values: string[] }>).map(({ label, key, values }) => (
                    <label className="block text-sm text-gray-700" key={String(key)}>
                      {label}
                      <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#333]" value={memberFilters[key as keyof typeof memberFilters]} onChange={(event) => { setMemberPage(1); setMemberFilters((current) => ({ ...current, [key]: event.target.value })); }}>
                        <option value="ALL">ALL</option>
                        {(values as string[]).map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                  ))}
                  <label className="block text-sm text-gray-700">From<input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#333]" type="date" value={memberFilters.from} onChange={(event) => { setMemberPage(1); setMemberFilters((current) => ({ ...current, from: event.target.value })); }} /></label>
                  <label className="block text-sm text-gray-700">To<input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#333]" type="date" value={memberFilters.to} onChange={(event) => { setMemberPage(1); setMemberFilters((current) => ({ ...current, to: event.target.value })); }} /></label>
                </div>

                <div className="my-4 flex flex-wrap items-center justify-between gap-3">
                  <button className="rounded-md bg-[#333] px-4 py-2 text-sm font-semibold text-white hover:bg-black" onClick={exportMemberCsv} type="button">All Data Excel Download</button>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span>Show entries</span>
                      <select className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" value={String(memberPageSize)} onChange={(event) => { setMemberPage(1); setMemberPageSize(Number(event.target.value)); }}>
                        {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span>Search</span>
                      <input className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#333]" value={memberSearch} onChange={(event) => { setMemberPage(1); setMemberSearch(event.target.value); }} />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-[1300px] w-full text-sm">
                    <thead className="bg-gray-100 text-left text-xs font-bold uppercase text-gray-700">
                      <tr>
                        {["Name", "Mobile", "Email", "Reg. Date", "Workshop", "Sales Person", "Facilitator", "State", "City", "Status", "Source"].map((head) => (
                          <th className="px-3 py-3" key={head}>
                            <span className="inline-flex items-center gap-1">{head}<ChevronUp className="size-3" /><ChevronDown className="size-3" /></span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedMemberRows.map((row) => (
                        <tr className="border-t border-gray-100" key={`${row.mobile}-${row.regDate}`}>
                          <td className="px-3 py-2.5">{row.name}</td>
                          <td className="px-3 py-2.5">{row.mobile}</td>
                          <td className="px-3 py-2.5">{row.email}</td>
                          <td className="px-3 py-2.5">{row.regDate}</td>
                          <td className="px-3 py-2.5">{row.workshop}</td>
                          <td className="px-3 py-2.5">{row.salesPerson}</td>
                          <td className="px-3 py-2.5">{row.facilitator}</td>
                          <td className="px-3 py-2.5">{row.state}</td>
                          <td className="px-3 py-2.5">{row.city}</td>
                          <td className="px-3 py-2.5"><span className={cn("rounded px-2 py-1 text-xs font-semibold text-white", row.status === "Success" ? "bg-green-500" : "bg-red-500")}>{row.status}</span></td>
                          <td className="px-3 py-2.5">{row.source}</td>
                        </tr>
                      ))}
                      {!pagedMemberRows.length ? <tr><td className="px-3 py-6 text-center text-sm text-gray-500" colSpan={11}>No records found</td></tr> : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                  <p>Showing {totalMemberRows ? memberStartIndex + 1 : 0} to {Math.min(memberStartIndex + memberPageSize, totalMemberRows)} of {totalMemberRows} entries</p>
                  <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                    <button className="border-r border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50" disabled={safeMemberPage === 1} onClick={() => setMemberPage((current) => Math.max(1, current - 1))} type="button">Previous</button>
                    {Array.from({ length: memberPageCount }).slice(0, 5).map((_, index) => {
                      const pageNumber = index + 1;
                      return <button className={cn("border-r border-gray-300 px-3 py-1.5 hover:bg-gray-50", safeMemberPage === pageNumber && "bg-[#333] text-white")} key={pageNumber} onClick={() => setMemberPage(pageNumber)} type="button">{pageNumber}</button>;
                    })}
                    <button className="px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50" disabled={safeMemberPage === memberPageCount} onClick={() => setMemberPage((current) => Math.min(memberPageCount, current + 1))} type="button">Next</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {selectedReport === "Client Batch Transfer" && (
            <div className="rounded-lg bg-[#f3f4f6] p-2">
              <div className="rounded-md bg-white px-4 py-3 shadow-sm">
                <nav className="flex flex-wrap items-center gap-2 text-sm">
                  {["Dashboard", "Masters", "Process", "Lead", "Reports", "Settings"].map((item) => (
                    <button className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600" key={item} type="button">{item}</button>
                  ))}
                </nav>
              </div>
              <div className="mx-auto my-4 w-full max-w-5xl rounded-md bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-2xl font-semibold text-gray-900">Client Batch Transfer</h3>
                  <button className="rounded-md bg-[#333] px-3 py-2 text-sm font-semibold text-white hover:bg-black" type="button">
                    View Batch Transfer Report
                  </button>
                </div>
                <label className="block text-sm text-gray-700">
                  Search Client By Name or Mobile No
                  <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setBatchTransferForm((current) => ({ ...current, keywords: event.target.value }))} placeholder="Search by Keyword" value={batchTransferForm.keywords} />
                </label>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm text-gray-700">
                    Select Workshop Batch
                    <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setBatchTransferForm((current) => ({ ...current, fromBatch: event.target.value }))} value={batchTransferForm.fromBatch}>
                      <option value="">Select batch</option>
                      <option value="Leadership-A1">Leadership-A1</option>
                      <option value="Sales-B2">Sales-B2</option>
                      <option value="Mindset-C3">Mindset-C3</option>
                    </select>
                  </label>
                  <label className="block text-sm text-gray-700">
                    Transfer to Batch
                    <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setBatchTransferForm((current) => ({ ...current, toBatch: event.target.value }))} value={batchTransferForm.toBatch}>
                      <option value="">Select target batch</option>
                      <option value="Leadership-A2">Leadership-A2</option>
                      <option value="Sales-B3">Sales-B3</option>
                      <option value="Mindset-C4">Mindset-C4</option>
                    </select>
                  </label>
                </div>
                <label className="mt-4 block text-sm text-gray-700">
                  Remarks
                  <textarea className="mt-1 min-h-[120px] w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setBatchTransferForm((current) => ({ ...current, remarks: event.target.value }))} value={batchTransferForm.remarks} />
                </label>
                <div className="mt-5 flex justify-start">
                  <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" onClick={submitBatchTransfer} type="button">
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
          {selectedReport === "Failed Payment" && (
            <div className="rounded-lg bg-[#f3f4f6] p-2 font-sans">
              <div className="rounded-md bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <nav className="flex flex-wrap items-center gap-2 text-sm">
                    {["Dashboard", "Masters", "Process", "Lead", "Reports", "Settings"].map((item) => (
                      <button className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600" key={item} type="button">{item}</button>
                    ))}
                  </nav>
                  <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700">
                    <UsersRound className="size-4" />
                    User Profile
                  </div>
                </div>
              </div>
              <div className="m-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-2xl font-semibold text-gray-900">Manage User Refund</h3>
                <div className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 p-3 md:grid-cols-4">
                  <label className="block text-sm text-gray-700">From Date<input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-600" onChange={(event) => { setRefundPage(1); setRefundFilters((current) => ({ ...current, from: event.target.value })); }} type="date" value={refundFilters.from} /></label>
                  <label className="block text-sm text-gray-700">To Date<input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-600" onChange={(event) => { setRefundPage(1); setRefundFilters((current) => ({ ...current, to: event.target.value })); }} type="date" value={refundFilters.to} /></label>
                  <label className="block text-sm text-gray-700">Status<select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-600" onChange={(event) => { setRefundPage(1); setRefundFilters((current) => ({ ...current, status: event.target.value })); }} value={refundFilters.status}><option>ALL</option><option>Success</option><option>Refund</option></select></label>
                  <div className="flex items-end"><button className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" type="button">Search</button></div>
                </div>

                <div className="my-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>Show</span>
                    <select className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" onChange={(event) => { setRefundPage(1); setRefundPageSize(Number(event.target.value)); }} value={String(refundPageSize)}>
                      {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                    <span>entries</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>Search</span>
                    <input className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-600" onChange={(event) => { setRefundPage(1); setRefundSearch(event.target.value); }} value={refundSearch} />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-[1400px] w-full text-sm">
                    <thead className="bg-gray-100 text-left text-xs font-bold uppercase text-gray-700">
                      <tr>
                        {["Status", "Reg. Date", "Name", "Mobile No", "Amount", "Workshop", "Batch", "Razorpay Payment ID", "Razorpay Order ID"].map((head) => (
                          <th className="whitespace-nowrap px-3 py-3" key={head}><span className="inline-flex items-center gap-1">{head}<ChevronUp className="size-3" /><ChevronDown className="size-3" /></span></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRefundRows.map((row) => (
                        <tr className="border-t border-gray-100" key={`${row.paymentId}-${row.orderId}`}>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col items-start gap-2">
                              <span className={cn("rounded-full px-2 py-1 text-xs font-semibold text-white", row.status === "Success" ? "bg-green-500" : "bg-purple-500")}>{row.status}</span>
                              <button className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700" type="button">Issue Refund</button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">{row.regDate}</td>
                          <td className="px-3 py-2.5">{row.name}</td>
                          <td className="px-3 py-2.5">{row.mobile}</td>
                          <td className="px-3 py-2.5">{formatCurrency(row.amount)}</td>
                          <td className="px-3 py-2.5">{row.workshop}</td>
                          <td className="px-3 py-2.5">{row.batch}</td>
                          <td className="px-3 py-2.5">{row.paymentId}</td>
                          <td className="px-3 py-2.5">{row.orderId}</td>
                        </tr>
                      ))}
                      {!pagedRefundRows.length ? <tr><td className="px-3 py-6 text-center text-sm text-gray-500" colSpan={9}>No records found</td></tr> : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                  <p>Showing {filteredRefundRows.length ? refundStart + 1 : 0} to {Math.min(refundStart + refundPageSize, filteredRefundRows.length)} of {filteredRefundRows.length} entries</p>
                  <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                    <button className="border-r border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50" disabled={safeRefundPage === 1} onClick={() => setRefundPage((p) => Math.max(1, p - 1))} type="button">Previous</button>
                    {Array.from({ length: refundPageCount }).slice(0, 5).map((_, index) => {
                      const pageNumber = index + 1;
                      return <button className={cn("border-r border-gray-300 px-3 py-1.5 hover:bg-gray-50", safeRefundPage === pageNumber && "bg-indigo-600 text-white")} key={pageNumber} onClick={() => setRefundPage(pageNumber)} type="button">{pageNumber}</button>;
                    })}
                    <button className="px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50" disabled={safeRefundPage === refundPageCount} onClick={() => setRefundPage((p) => Math.min(refundPageCount, p + 1))} type="button">Next</button>
                  </div>
                </div>
              </div>
            </div>
          )}
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

          {selectedReport !== "Daily Report" && selectedReport !== "Client Milestone" && selectedReport !== "Member Details" && selectedReport !== "Client Batch Transfer" && selectedReport !== "Failed Payment" && (
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
