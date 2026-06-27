import type {
  ActivityLog,
  Batch,
  Campaign,
  Kpi,
  Lead,
  LeadStage,
  Payment,
  RevenuePoint,
  TeamMember,
  Ticket,
  Workshop
} from "@/lib/types";

export const pipelineStages: LeadStage[] = [
  "New Leads",
  "Contacted",
  "Qualified",
  "Proposal",
  "Won"
];

export const leadsSeed: Lead[] = [];

export const workshops: Workshop[] = [];

export const batches: Batch[] = [];

export const payments: Payment[] = [];

export const campaigns: Campaign[] = [];

export const teamMembers: TeamMember[] = [];

export const tickets: Ticket[] = [];

export const activityLogs: ActivityLog[] = [];

export const revenuePoints: RevenuePoint[] = [
  { day: "1", revenue: 0 },
  { day: "2", revenue: 0 },
  { day: "3", revenue: 0 },
  { day: "4", revenue: 0 },
  { day: "5", revenue: 0 },
  { day: "6", revenue: 0 }
];

export const dashboardKpis: Kpi[] = [
  {
    label: "Revenue Today",
    value: "₹0",
    delta: "0%",
    helper: "No revenue added yet",
    tone: "mint"
  },
  {
    label: "Leads",
    value: "0",
    delta: "0%",
    helper: "Add or import leads",
    tone: "ai"
  },
  {
    label: "Registrations",
    value: "0",
    delta: "0%",
    helper: "No registrations yet",
    tone: "mint"
  },
  {
    label: "Pending Payments",
    value: "₹0",
    delta: "0 invoices",
    helper: "No pending payments",
    tone: "saffron"
  }
];
