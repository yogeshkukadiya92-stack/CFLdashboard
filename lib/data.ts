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

export const leadsSeed: Lead[] = [
  {
    id: "lead-1001",
    name: "Rohan Mehta",
    mobile: "+91 98250 11843",
    email: "rohan@mehtacorp.in",
    city: "Surat",
    state: "Gujarat",
    country: "India",
    source: "Instagram Ads",
    stage: "New Leads",
    assignedTo: "Neha Kapoor",
    score: 88,
    revenuePotential: 120000,
    notes: ["Asked for corporate batch", "Budget approved by HR"],
    callHistory: ["Connected 12 Apr, 8m 12s", "Missed 18 Apr"],
    whatsappHistory: ["Brochure sent", "Demo reminder delivered"],
    workshopsAttended: [],
    paymentHistory: ["Quote CFL-Q-1109"],
    certificates: [],
    familyAccounts: ["Maya Mehta"],
    tags: ["Corporate", "Hot", "Surat"],
    createdAt: "2026-04-22",
    nextFollowUp: "Today 4:30 PM",
    bestTime: "4 PM - 6 PM"
  },
  {
    id: "lead-1002",
    name: "Priya Nair",
    mobile: "+91 98980 22314",
    email: "priya.nair@example.com",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    source: "Referral",
    stage: "Contacted",
    assignedTo: "Amit Verma",
    score: 76,
    revenuePotential: 70000,
    notes: ["Interested in public speaking", "Needs weekend batch"],
    callHistory: ["Connected 20 Apr, 5m 40s"],
    whatsappHistory: ["Payment link sent", "FAQ shared"],
    workshopsAttended: ["Communication Skills"],
    paymentHistory: ["INV-2024-1582 due"],
    certificates: ["Communication Skills Level 1"],
    familyAccounts: [],
    tags: ["Weekend", "Referral"],
    createdAt: "2026-04-18",
    nextFollowUp: "Tomorrow 11:00 AM",
    bestTime: "10 AM - 12 PM"
  },
  {
    id: "lead-1003",
    name: "Sumeet Shah",
    mobile: "+91 99099 44112",
    email: "sumeet@shahbiz.com",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    source: "Webinar",
    stage: "Qualified",
    assignedTo: "Rohan Mehta",
    score: 82,
    revenuePotential: 110000,
    notes: ["Business coaching lead", "Asked for GST invoice"],
    callHistory: ["Connected 19 Apr, 13m 02s"],
    whatsappHistory: ["Trainer profile sent"],
    workshopsAttended: ["Mindset Mastery"],
    paymentHistory: ["Part payment received"],
    certificates: ["Mindset Mastery"],
    familyAccounts: ["Nidhi Shah"],
    tags: ["Business", "GST"],
    createdAt: "2026-04-15",
    nextFollowUp: "Today 6:00 PM",
    bestTime: "5 PM - 7 PM"
  },
  {
    id: "lead-1004",
    name: "GlobalSoft HR",
    mobile: "+91 98795 78441",
    email: "learning@globalsoft.com",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    source: "LinkedIn",
    stage: "Proposal",
    assignedTo: "Neha Kapoor",
    score: 91,
    revenuePotential: 210000,
    notes: ["Leadership program for 40 managers", "Decision Friday"],
    callHistory: ["Connected 21 Apr, 22m 30s"],
    whatsappHistory: ["Proposal PDF delivered"],
    workshopsAttended: [],
    paymentHistory: ["INV-2024-1579 pending"],
    certificates: [],
    familyAccounts: [],
    tags: ["Enterprise", "Corporate", "Bengaluru"],
    createdAt: "2026-04-12",
    nextFollowUp: "Today 2:15 PM",
    bestTime: "2 PM - 3 PM"
  },
  {
    id: "lead-1005",
    name: "Acme Corp.",
    mobile: "+91 98111 44389",
    email: "training@acme.example",
    city: "Delhi",
    state: "Delhi",
    country: "India",
    source: "Google Search",
    stage: "Won",
    assignedTo: "Harshita Singh",
    score: 94,
    revenuePotential: 320000,
    notes: ["Advanced leadership confirmed", "Upsell to quarterly retainer"],
    callHistory: ["Connected 10 Apr, 16m 18s"],
    whatsappHistory: ["Welcome sequence active"],
    workshopsAttended: ["Advanced Leadership"],
    paymentHistory: ["INV-2024-1562 paid"],
    certificates: ["Advanced Leadership"],
    familyAccounts: [],
    tags: ["Won", "Upsell"],
    createdAt: "2026-04-04",
    nextFollowUp: "26 Apr 10:00 AM",
    bestTime: "9 AM - 11 AM"
  },
  {
    id: "lead-1006",
    name: "Kavya Rao",
    mobile: "+91 99877 45001",
    email: "kavya.rao@example.com",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    source: "YouTube",
    stage: "Qualified",
    assignedTo: "Priya Nair",
    score: 71,
    revenuePotential: 60000,
    notes: ["Career workshop", "Needs EMI option"],
    callHistory: ["Connected 18 Apr, 4m 02s"],
    whatsappHistory: ["EMI details sent"],
    workshopsAttended: ["Career Acceleration"],
    paymentHistory: ["Installment 1 received"],
    certificates: [],
    familyAccounts: [],
    tags: ["EMI", "Career"],
    createdAt: "2026-04-17",
    nextFollowUp: "27 Apr 3:00 PM",
    bestTime: "3 PM - 5 PM"
  },
  {
    id: "lead-1007",
    name: "TechNova Solutions",
    mobile: "+91 94088 22110",
    email: "hr@technova.example",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    source: "Partner",
    stage: "New Leads",
    assignedTo: "Amit Verma",
    score: 69,
    revenuePotential: 240000,
    notes: ["Team coaching inquiry", "Asked for offline trainer"],
    callHistory: ["Missed 22 Apr"],
    whatsappHistory: ["Intro message delivered"],
    workshopsAttended: [],
    paymentHistory: ["INV-2024-1587 due"],
    certificates: [],
    familyAccounts: [],
    tags: ["Corporate", "Offline"],
    createdAt: "2026-04-22",
    nextFollowUp: "Today 5:15 PM",
    bestTime: "5 PM - 6 PM"
  },
  {
    id: "lead-1008",
    name: "DesignHub",
    mobile: "+91 91555 77890",
    email: "ops@designhub.example",
    city: "Jaipur",
    state: "Rajasthan",
    country: "India",
    source: "Cold Outreach",
    stage: "Proposal",
    assignedTo: "Rohan Mehta",
    score: 65,
    revenuePotential: 93000,
    notes: ["Workshop series pricing requested"],
    callHistory: ["Connected 22 Apr, 9m 19s"],
    whatsappHistory: ["Case study sent"],
    workshopsAttended: [],
    paymentHistory: ["INV-2024-1565 due"],
    certificates: [],
    familyAccounts: [],
    tags: ["Design", "Series"],
    createdAt: "2026-04-20",
    nextFollowUp: "29 Apr 1:00 PM",
    bestTime: "12 PM - 2 PM"
  }
];

export const workshops: Workshop[] = [
  {
    id: "workshop-1",
    title: "Advanced Leadership",
    slug: "advanced-leadership",
    type: "Hybrid",
    price: 12000,
    trainer: "Arjun Sharma",
    status: "Live",
    city: "Delhi",
    startDate: "2026-05-21",
    capacity: 30,
    registrations: 24,
    waitlist: 6,
    revenue: 288000,
    feedbackScore: 4.8
  },
  {
    id: "workshop-2",
    title: "Communication Skills",
    slug: "communication-skills",
    type: "Offline",
    price: 8500,
    trainer: "Meera Iyer",
    status: "Live",
    city: "Pune",
    startDate: "2026-05-22",
    capacity: 25,
    registrations: 18,
    waitlist: 3,
    revenue: 153000,
    feedbackScore: 4.6
  },
  {
    id: "workshop-3",
    title: "Mindset Mastery",
    slug: "mindset-mastery",
    type: "Online",
    price: 7000,
    trainer: "Harshita Singh",
    status: "Live",
    city: "Online",
    startDate: "2026-05-24",
    capacity: 40,
    registrations: 31,
    waitlist: 9,
    revenue: 217000,
    feedbackScore: 4.7
  },
  {
    id: "workshop-4",
    title: "Sales Acceleration",
    slug: "sales-acceleration",
    type: "Offline",
    price: 15000,
    trainer: "Amit Verma",
    status: "Draft",
    city: "Bengaluru",
    startDate: "2026-05-29",
    capacity: 35,
    registrations: 28,
    waitlist: 2,
    revenue: 420000,
    feedbackScore: 4.5
  }
];

export const batches: Batch[] = [
  {
    id: "batch-1",
    workshopId: "workshop-1",
    name: "May Prime",
    startDate: "2026-05-21",
    endDate: "2026-05-23",
    capacity: 30,
    attendanceRate: 92
  },
  {
    id: "batch-2",
    workshopId: "workshop-2",
    name: "Weekend Pune",
    startDate: "2026-05-22",
    endDate: "2026-05-23",
    capacity: 25,
    attendanceRate: 86
  },
  {
    id: "batch-3",
    workshopId: "workshop-3",
    name: "Online Growth",
    startDate: "2026-05-24",
    endDate: "2026-05-24",
    capacity: 40,
    attendanceRate: 78
  }
];

export const payments: Payment[] = [
  {
    id: "INV-2024-1587",
    clientName: "TechNova Solutions",
    mobile: "+91 94088 22110",
    workshop: "Team Coaching",
    amount: 125000,
    status: "Due",
    method: "Razorpay Link",
    dueInDays: 5
  },
  {
    id: "INV-2024-1582",
    clientName: "BrightWave Ltd.",
    mobile: "+91 98244 71091",
    workshop: "Leadership Program",
    amount: 85000,
    status: "Overdue",
    method: "UPI",
    dueInDays: -7
  },
  {
    id: "INV-2024-1579",
    clientName: "GlobalSoft HR",
    mobile: "+91 98795 78441",
    workshop: "Consulting Program",
    amount: 45000,
    status: "Due",
    method: "Card",
    dueInDays: 3
  },
  {
    id: "INV-2024-1570",
    clientName: "Rohan Mehta",
    mobile: "+91 98250 11843",
    workshop: "Corporate Training",
    amount: 210000,
    status: "Overdue",
    method: "Bank Transfer",
    dueInDays: -3
  },
  {
    id: "INV-2024-1562",
    clientName: "Acme Corp.",
    mobile: "+91 98111 44389",
    workshop: "Advanced Leadership",
    amount: 320000,
    status: "Paid",
    method: "Razorpay",
    dueInDays: 0,
    paidAt: "2026-04-18"
  }
];

export const campaigns: Campaign[] = [
  {
    id: "campaign-1",
    name: "Welcome Email to New Leads",
    type: "Email",
    audience: "New leads, last 7 days",
    status: "Active",
    sent: 1824,
    conversion: 12.8,
    revenue: 458000
  },
  {
    id: "campaign-2",
    name: "Workshop Follow-up",
    type: "WhatsApp",
    audience: "Attended, no next purchase",
    status: "Active",
    sent: 940,
    conversion: 18.4,
    revenue: 685000
  },
  {
    id: "campaign-3",
    name: "Payment Reminder Due",
    type: "SMS",
    audience: "Due and overdue invoices",
    status: "Active",
    sent: 417,
    conversion: 22.1,
    revenue: 248900
  },
  {
    id: "campaign-4",
    name: "Festival Offer",
    type: "WhatsApp",
    audience: "Gujarat repeat clients",
    status: "Scheduled",
    sent: 0,
    conversion: 0,
    revenue: 0
  }
];

export const teamMembers: TeamMember[] = [
  {
    id: "team-1",
    name: "Neha Kapoor",
    role: "Senior Sales",
    city: "Delhi",
    target: 700000,
    achieved: 685000,
    conversions: 23,
    calls: 148,
    incentives: 42000,
    attendance: 98
  },
  {
    id: "team-2",
    name: "Amit Verma",
    role: "Sales Coach",
    city: "Mumbai",
    target: 550000,
    achieved: 492000,
    conversions: 18,
    calls: 132,
    incentives: 28500,
    attendance: 94
  },
  {
    id: "team-3",
    name: "Rohan Mehta",
    role: "Inside Sales",
    city: "Ahmedabad",
    target: 500000,
    achieved: 425000,
    conversions: 16,
    calls: 121,
    incentives: 21000,
    attendance: 91
  },
  {
    id: "team-4",
    name: "Priya Nair",
    role: "Client Success",
    city: "Pune",
    target: 420000,
    achieved: 375000,
    conversions: 14,
    calls: 98,
    incentives: 16500,
    attendance: 96
  },
  {
    id: "team-5",
    name: "Kavya Rao",
    role: "Admissions",
    city: "Bengaluru",
    target: 350000,
    achieved: 298000,
    conversions: 11,
    calls: 87,
    incentives: 9900,
    attendance: 89
  }
];

export const tickets: Ticket[] = [
  {
    id: "TCK-1049",
    client: "BrightWave Ltd.",
    subject: "GST invoice company name correction",
    priority: "High",
    status: "In Progress",
    owner: "Priya Nair",
    satisfaction: 4.2
  },
  {
    id: "TCK-1048",
    client: "Maya Mehta",
    subject: "Certificate spelling update",
    priority: "Medium",
    status: "Open",
    owner: "Kavya Rao",
    satisfaction: 4.8
  },
  {
    id: "TCK-1047",
    client: "Acme Corp.",
    subject: "Refund request for unused seat",
    priority: "Urgent",
    status: "Open",
    owner: "Neha Kapoor",
    satisfaction: 3.7
  }
];

export const activityLogs: ActivityLog[] = [
  {
    id: "log-1",
    actor: "Neha Kapoor",
    action: "moved lead to Proposal",
    meta: "GlobalSoft HR, expected value INR 2.10L",
    createdAt: "Today 11:42 AM"
  },
  {
    id: "log-2",
    actor: "Automation",
    action: "sent payment recovery message",
    meta: "47 due invoices via WhatsApp",
    createdAt: "Today 10:15 AM"
  },
  {
    id: "log-3",
    actor: "Arjun Sharma",
    action: "created workshop batch",
    meta: "Advanced Leadership May Prime",
    createdAt: "Yesterday 6:10 PM"
  }
];

export const revenuePoints: RevenuePoint[] = [
  { day: "1 May", revenue: 820000 },
  { day: "4 May", revenue: 1380000 },
  { day: "7 May", revenue: 1650000 },
  { day: "10 May", revenue: 2240000 },
  { day: "13 May", revenue: 1980000 },
  { day: "16 May", revenue: 2360000 },
  { day: "19 May", revenue: 2050000 },
  { day: "22 May", revenue: 2218600 },
  { day: "25 May", revenue: 2640000 },
  { day: "28 May", revenue: 2790000 },
  { day: "31 May", revenue: 3185000 }
];

export const dashboardKpis: Kpi[] = [
  {
    label: "Revenue Today",
    value: "₹8,42,700",
    delta: "+18.4%",
    helper: "vs yesterday ₹7,12,590",
    tone: "mint"
  },
  {
    label: "Leads",
    value: "342",
    delta: "+12.6%",
    helper: "118 hot, 72 new today",
    tone: "ai"
  },
  {
    label: "Registrations",
    value: "128",
    delta: "+8.3%",
    helper: "31 returning clients",
    tone: "mint"
  },
  {
    label: "Pending Payments",
    value: "₹6,21,400",
    delta: "47 invoices",
    helper: "recovery due today",
    tone: "saffron"
  }
];
