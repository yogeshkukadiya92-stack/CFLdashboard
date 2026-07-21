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

export type LeadPriority = "Hot" | "Warm" | "Cold";

export type LeadActivityType = "created" | "note" | "call" | "whatsapp" | "assignment" | "stage" | "follow_up" | "conversion";

export interface LeadActivity {
  id: string;
  type: LeadActivityType;
  message: string;
  createdAt: string;
  createdBy?: string;
}

export interface LeadFollowUp {
  id: string;
  dueAt: string;
  type: "Call" | "WhatsApp" | "Meeting";
  note: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

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
  priority?: LeadPriority;
  interest?: string;
  lostReason?: string;
  updatedAt?: string;
  lastActivityAt?: string;
  sourceDetails?: string[];
  activities?: LeadActivity[];
  followUps?: LeadFollowUp[];
  convertedClientId?: string;
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

export interface RegistrationEntry {
  id: string;
  workshopId: string;
  workshopSlug: string;
  workshopTitle: string;
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  facilitator?: string;
  paymentMode: "Full" | "Part";
  amountPaid: number;
  amountDue: number;
  status: "Paid" | "Due";
  whatsappVerificationStatus?: "verified" | "not_verified" | "not_required";
  source?: "registration_link" | "landing_page" | "manual";
  landingPageSlug?: string;
  createdAt: string;
  batch?: string;
  answers?: Record<string, string>;
}

export interface ResponseAccessPermissions {
  exportCsv: boolean;
  revealContact: boolean;
  viewAnswers: boolean;
}

export interface ResponseAccessGrant {
  id: string;
  token: string;
  recipientName: string;
  recipientContact?: string;
  workshopIds: string[];
  workshopNames: string[];
  permissions: ResponseAccessPermissions;
  active: boolean;
  expiresAt?: string;
  pinHash: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  accessCount: number;
}

export type ResponseAccessGrantSummary = Omit<ResponseAccessGrant, "pinHash"> & {
  hasAccessCode: boolean;
};

export type LandingPageTemplate = "wellness" | "event" | "executive";

export interface LandingPageFaq {
  id: string;
  question: string;
  answer: string;
}

export interface LandingPageRecord {
  id: string;
  workshopId: string;
  workshopName: string;
  workshopSlug: string;
  slug: string;
  headline: string;
  subheadline: string;
  description: string;
  heroImageUrl?: string;
  logoUrl?: string;
  ctaLabel: string;
  highlights: string[];
  schedule?: string;
  venue?: string;
  facilitator?: string;
  testimonialQuote?: string;
  testimonialAuthor?: string;
  faqs: LandingPageFaq[];
  template: LandingPageTemplate;
  accentColor: string;
  backgroundColor: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BuilderFieldType =
  | "short_text"
  | "paragraph"
  | "email"
  | "mobile"
  | "number"
  | "date"
  | "time"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "yes_no"
  | "rating"
  | "consent"
  | "heading"
  | "divider";

export type BuilderFormMode = "classic" | "steps" | "guided";

export type BuilderVisibilityOperator = "equals" | "not_equals" | "contains" | "answered" | "not_answered";

export interface BuilderFieldVisibility {
  fieldId: string;
  operator: BuilderVisibilityOperator;
  value?: string;
}

export interface BuilderField {
  id: string;
  type: BuilderFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  allowOther?: boolean;
  visibility?: BuilderFieldVisibility;
  helpText?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  width?: "full" | "half";
  /** Maps a field to a core registration column so reports keep working. */
  role?: "name" | "mobile" | "email" | "city";
}

export interface BuilderTheme {
  fontFamily: string;
  fontSize: number;
  accent: string;
  titleBold: boolean;
  titleItalic: boolean;
  align: "left" | "center";
  backgroundColor?: string;
  surfaceColor?: string;
  fieldRadius?: "soft" | "rounded" | "square";
  bannerUrl?: string;
  logoUrl?: string;
  logoAlign?: "left" | "center" | "right";
  logoSize?: number;
}

export interface FormAnalyticsRecord {
  completions: number;
  dropOffByField: Record<string, number>;
  formId: string;
  starts: number;
  updatedAt: string;
  views: number;
  workshopId: string;
  workshopSlug: string;
}

export interface PaymentTier {
  id: string;
  label: string;
  fee: number;
}

export interface BuilderForm {
  id: string;
  workshopId: string;
  workshopName: string;
  workshopSlug: string;
  batch: string;
  title: string;
  tagline?: string;
  description: string;
  mode?: BuilderFormMode;
  theme: BuilderTheme;
  paid: boolean;
  fee: number;
  partPayment: boolean;
  otpRequired?: boolean;
  tiers?: PaymentTier[];
  highlights?: string[];
  whatsappGroupUrl?: string;
  fields: BuilderField[];
  updatedAt: string;
}

export interface AttendanceSession {
  id: string;
  workshopId: string;
  workshopName: string;
  workshopSlug: string;
  slug: string;
  title: string;
  description: string;
  sessionDate: string;
  startTime?: string;
  endTime?: string;
  batch?: string;
  facilitator?: string;
  venue?: string;
  zoomJoinUrl?: string;
  openMinutesBefore?: number;
  lateAfterMinutes?: number;
  closeMinutesAfter?: number;
  redirectDelaySeconds?: number;
  allowDuplicate?: boolean;
  successMessage?: string;
  submitButtonText?: string;
  formMode?: BuilderFormMode;
  theme?: BuilderTheme;
  minimumDurationMinutes?: number;
  published: boolean;
  fields: BuilderField[];
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceEntry {
  id: string;
  sessionId: string;
  sessionSlug: string;
  workshopId: string;
  workshopName: string;
  attendeeName: string;
  mobile: string;
  email?: string;
  city?: string;
  answers?: Record<string, string>;
  submittedAt: string;
  status?: "checked_in" | "late" | "joined_zoom" | "completed";
  checkInAt?: string;
  joinedZoomAt?: string;
  leftZoomAt?: string;
  durationMinutes?: number;
  batch?: string;
  source?: "attendance_form" | "manual" | "zoom_webhook";
}

export interface AttendanceTeamPermissions {
  revealContact: boolean;
  exportCsv: boolean;
  viewAnswers: boolean;
  editAttendance: boolean;
  deleteResponses: boolean;
}

export interface AttendanceTeamUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  sessionIds: string[];
  permissions: AttendanceTeamPermissions;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  loginCount: number;
}

export type AttendanceTeamUserSummary = Omit<AttendanceTeamUser, "passwordHash"> & {
  hasPassword: boolean;
};
