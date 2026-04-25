export type ModuleKey =
  | "home"
  | "crm"
  | "sales"
  | "workshops"
  | "funnels"
  | "payments"
  | "marketing"
  | "reports"
  | "support"
  | "team"
  | "ai"
  | "settings";

export type LeadStage =
  | "New Leads"
  | "Contacted"
  | "Qualified"
  | "Proposal"
  | "Won"
  | "Lost";

export type PaymentStatus = "Paid" | "Due" | "Overdue" | "Failed" | "Refunded";

export type Channel = "WhatsApp" | "Email" | "SMS" | "Call" | "Landing Page";

export interface Lead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  country: string;
  source: string;
  stage: LeadStage;
  assignedTo: string;
  score: number;
  revenuePotential: number;
  notes: string[];
  callHistory: string[];
  whatsappHistory: string[];
  workshopsAttended: string[];
  paymentHistory: string[];
  certificates: string[];
  familyAccounts: string[];
  tags: string[];
  createdAt: string;
  nextFollowUp: string;
  bestTime: string;
}

export interface Workshop {
  id: string;
  title: string;
  slug: string;
  type: "Online" | "Offline" | "Hybrid";
  price: number;
  trainer: string;
  status: "Draft" | "Live" | "Completed";
  city: string;
  startDate: string;
  capacity: number;
  registrations: number;
  waitlist: number;
  revenue: number;
  feedbackScore: number;
}

export interface Batch {
  id: string;
  workshopId: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  attendanceRate: number;
}

export interface Payment {
  id: string;
  clientName: string;
  mobile: string;
  workshop: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  dueInDays: number;
  paidAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: Channel;
  audience: string;
  status: "Draft" | "Active" | "Scheduled" | "Paused";
  sent: number;
  conversion: number;
  revenue: number;
}

export interface Ticket {
  id: string;
  client: string;
  subject: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Open" | "In Progress" | "Resolved";
  owner: string;
  satisfaction: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  city: string;
  target: number;
  achieved: number;
  conversions: number;
  calls: number;
  incentives: number;
  attendance: number;
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  meta: string;
  createdAt: string;
}

export interface RevenuePoint {
  day: string;
  revenue: number;
}

export interface Kpi {
  label: string;
  value: string;
  delta: string;
  helper: string;
  tone: "mint" | "ai" | "saffron" | "slate";
}
