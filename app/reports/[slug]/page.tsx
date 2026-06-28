"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Title map                                                          */
/* ------------------------------------------------------------------ */

const titles = new Map<string, string>([
  ["daily-report", "Daily Report"],
  ["workshop-url-status", "Workshop URL & Status"],
  ["yearly-public-session", "Yearly Public Session"],
  ["yearly-workshop", "Yearly Workshop"],
  ["facilitators-performance", "Facilitators Performance"],
  ["workshop-summary", "Workshop Summary"],
  ["batch-wise-workshop-summary", "Batch Wise Workshop Summary"],
  ["client-milestone", "Client Milestone"],
  ["failed-payment", "Failed Payment"],
  ["part-payment", "Part Payment"],
  ["workshop-wise-member", "Workshop Wise Member"],
  ["member-attend-more-workshop", "Member Attend More Workshop"],
  ["member-details", "Member Details"],
  ["member-details-part-payment", "Member Details (Part Payment)"],
  ["session-conversation", "Session Conversation"],
  ["client-batch-transfer", "Client Batch Transfer"],
  ["sales-person-milestone", "Sales Person Milestone"],
  ["sales-person-payment", "Sales Person Payment"],
  ["sales-person-lead-assign", "Sales Person Lead Assign"],
]);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Registration = {
  id: string;
  workshopId?: string;
  workshopSlug?: string;
  workshopTitle: string;
  fullName: string;
  mobile: string;
  email?: string;
  city?: string;
  paymentMode?: string;
  amountPaid: number;
  amountDue: number;
  status: string;
  createdAt: string;
  batch?: string;
  answers?: Record<string, string>;
};

type Workshop = {
  id: string;
  name: string;
  type?: string;
  facilitator?: string;
  productGroup?: string;
  isPaid?: boolean;
  activeFields?: string[];
};

type Client = {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  dob?: string;
  gender?: string;
  occupation?: string;
  country?: string;
  state?: string;
  city?: string;
  status?: string;
};

type SalesPerson = {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  password?: string;
  group?: string;
  isActive?: boolean;
  canViewOther?: boolean;
  commissions?: { id: string; workshop: string; leadPercent: number; directPercent: number }[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function loadJson<T>(key: string): T[] {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fmtDate(d: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function fmtTime(d: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------------------------------------------ */
/*  Report definitions                                                 */
/* ------------------------------------------------------------------ */

type Column = { label: string; key: string; align?: "right" | "center" };
type ReportRow = Record<string, string | number>;

interface ReportResult {
  columns: Column[];
  rows: ReportRow[];
  csvHeaders: string[];
  csvRow: (r: ReportRow) => string[];
  placeholder?: React.ReactNode;
}

function buildReport(
  slug: string,
  registrations: Registration[],
  workshops: Workshop[],
  _clients: Client[],
  salesPeople: SalesPerson[],
  workshopFilter: string,
  fromDate: string,
  toDate: string,
  query: string
): ReportResult {
  const q = query.trim().toLowerCase();

  // Shared filter helpers
  const filterByDate = (list: Registration[]) =>
    list
      .filter((r) => !fromDate || r.createdAt >= fromDate)
      .filter((r) => !toDate || r.createdAt <= toDate + "T23:59:59");

  const filterByWorkshop = (list: Registration[]) =>
    workshopFilter === "All Workshops" ? list : list.filter((r) => r.workshopTitle === workshopFilter);

  const filterByQuery = (list: ReportRow[], fields: string[]) => {
    if (!q) return list;
    return list.filter((r) => fields.some((f) => String(r[f] ?? "").toLowerCase().includes(q)));
  };

  const baseRegs = filterByDate(filterByWorkshop(registrations));

  switch (slug) {
    /* ============================================================== */
    /*  1. DAILY REPORT                                                */
    /* ============================================================== */
    case "daily-report": {
      const today = todayStr();
      const dayRegs = baseRegs.filter((r) => r.createdAt?.startsWith(fromDate || today));
      const rows: ReportRow[] = dayRegs.map((r, i) => ({
        sr: i + 1,
        client: r.fullName,
        mobile: r.mobile || "",
        workshop: r.workshopTitle,
        batch: r.batch || "Main",
        payment: r.paymentMode || r.status,
        amount: r.amountPaid,
        time: fmtTime(r.createdAt),
      }));
      return {
        columns: [
          { label: "Sr", key: "sr" },
          { label: "Client", key: "client" },
          { label: "Mobile", key: "mobile" },
          { label: "Workshop", key: "workshop" },
          { label: "Batch", key: "batch" },
          { label: "Payment", key: "payment" },
          { label: "Amount", key: "amount", align: "right" },
          { label: "Time", key: "time" },
        ],
        rows: filterByQuery(rows, ["client", "mobile", "workshop"]),
        csvHeaders: ["Sr", "Client", "Mobile", "Workshop", "Batch", "Payment", "Amount", "Time"],
        csvRow: (r) => [String(r.sr), String(r.client), String(r.mobile), String(r.workshop), String(r.batch), String(r.payment), String(r.amount), String(r.time)],
      };
    }

    /* ============================================================== */
    /*  2. WORKSHOP URL STATUS                                         */
    /* ============================================================== */
    case "workshop-url-status": {
      const rows: ReportRow[] = workshops.map((w) => {
        const count = registrations.filter((r) => r.workshopId === w.id || r.workshopTitle === w.name).length;
        return {
          workshop: w.name,
          type: w.type || "-",
          facilitator: w.facilitator || "-",
          paidFree: w.isPaid ? "Paid" : "Free",
          regCount: count,
          status: count > 0 ? "Active" : "Inactive",
        };
      });
      return {
        columns: [
          { label: "Workshop", key: "workshop" },
          { label: "Type", key: "type" },
          { label: "Facilitator", key: "facilitator" },
          { label: "Paid/Free", key: "paidFree" },
          { label: "Registrations", key: "regCount", align: "right" },
          { label: "Status", key: "status" },
        ],
        rows: filterByQuery(rows, ["workshop", "facilitator", "type"]),
        csvHeaders: ["Workshop", "Type", "Facilitator", "Paid/Free", "Registrations", "Status"],
        csvRow: (r) => [String(r.workshop), String(r.type), String(r.facilitator), String(r.paidFree), String(r.regCount), String(r.status)],
      };
    }

    /* ============================================================== */
    /*  3. YEARLY PUBLIC SESSION                                       */
    /* ============================================================== */
    case "yearly-public-session": {
      const year = fromDate ? new Date(fromDate).getFullYear() : new Date().getFullYear();
      const monthMap = new Map<number, { workshops: Set<string>; regs: number; revenue: number }>();
      for (let m = 0; m < 12; m++) monthMap.set(m, { workshops: new Set(), regs: 0, revenue: 0 });

      registrations.forEach((r) => {
        const d = new Date(r.createdAt);
        if (d.getFullYear() !== year) return;
        const m = d.getMonth();
        const entry = monthMap.get(m)!;
        entry.workshops.add(r.workshopTitle);
        entry.regs++;
        entry.revenue += r.amountPaid || 0;
      });

      const rows: ReportRow[] = Array.from(monthMap.entries()).map(([m, data]) => ({
        month: `${MONTH_NAMES[m]} ${year}`,
        workshopCount: data.workshops.size,
        totalRegs: data.regs,
        totalRevenue: data.revenue,
        avgPerWorkshop: data.workshops.size ? Math.round(data.regs / data.workshops.size) : 0,
      }));
      return {
        columns: [
          { label: "Month", key: "month" },
          { label: "Workshop Count", key: "workshopCount", align: "right" },
          { label: "Total Registrations", key: "totalRegs", align: "right" },
          { label: "Total Revenue", key: "totalRevenue", align: "right" },
          { label: "Avg per Workshop", key: "avgPerWorkshop", align: "right" },
        ],
        rows,
        csvHeaders: ["Month", "Workshop Count", "Total Registrations", "Total Revenue", "Avg per Workshop"],
        csvRow: (r) => [String(r.month), String(r.workshopCount), String(r.totalRegs), String(r.totalRevenue), String(r.avgPerWorkshop)],
      };
    }

    /* ============================================================== */
    /*  4. YEARLY WORKSHOP                                             */
    /* ============================================================== */
    case "yearly-workshop": {
      const year = fromDate ? new Date(fromDate).getFullYear() : new Date().getFullYear();
      const grouped = new Map<string, { month: string; workshop: string; facilitator: string; regs: number; revenue: number }>();

      registrations.forEach((r) => {
        const d = new Date(r.createdAt);
        if (d.getFullYear() !== year) return;
        const mKey = `${d.getMonth()}-${r.workshopTitle}`;
        const ws = workshops.find((w) => w.name === r.workshopTitle || w.id === r.workshopId);
        if (!grouped.has(mKey)) {
          grouped.set(mKey, {
            month: `${MONTH_NAMES[d.getMonth()]} ${year}`,
            workshop: r.workshopTitle,
            facilitator: ws?.facilitator || "-",
            regs: 0,
            revenue: 0,
          });
        }
        const entry = grouped.get(mKey)!;
        entry.regs++;
        entry.revenue += r.amountPaid || 0;
      });

      const rows: ReportRow[] = Array.from(grouped.values()).map((g) => ({
        month: g.month,
        workshop: g.workshop,
        facilitator: g.facilitator,
        registrations: g.regs,
        revenue: g.revenue,
        status: g.regs > 0 ? "Active" : "-",
      }));
      return {
        columns: [
          { label: "Month", key: "month" },
          { label: "Workshop Name", key: "workshop" },
          { label: "Facilitator", key: "facilitator" },
          { label: "Registrations", key: "registrations", align: "right" },
          { label: "Revenue", key: "revenue", align: "right" },
          { label: "Status", key: "status" },
        ],
        rows: filterByQuery(rows, ["workshop", "facilitator", "month"]),
        csvHeaders: ["Month", "Workshop Name", "Facilitator", "Registrations", "Revenue", "Status"],
        csvRow: (r) => [String(r.month), String(r.workshop), String(r.facilitator), String(r.registrations), String(r.revenue), String(r.status)],
      };
    }

    /* ============================================================== */
    /*  5. FACILITATORS PERFORMANCE                                    */
    /* ============================================================== */
    case "facilitators-performance": {
      const facMap = new Map<string, { workshops: Set<string>; regs: number; revenue: number }>();

      baseRegs.forEach((r) => {
        const ws = workshops.find((w) => w.name === r.workshopTitle || w.id === r.workshopId);
        const fac = ws?.facilitator || "Unknown";
        if (!facMap.has(fac)) facMap.set(fac, { workshops: new Set(), regs: 0, revenue: 0 });
        const entry = facMap.get(fac)!;
        entry.workshops.add(r.workshopTitle);
        entry.regs++;
        entry.revenue += r.amountPaid || 0;
      });

      const rows: ReportRow[] = Array.from(facMap.entries())
        .map(([fac, data]) => ({
          facilitator: fac,
          workshops: data.workshops.size,
          totalRegs: data.regs,
          revenue: data.revenue,
          avgPerWorkshop: data.workshops.size ? Math.round(data.regs / data.workshops.size) : 0,
        }))
        .sort((a, b) => (b.revenue as number) - (a.revenue as number));

      return {
        columns: [
          { label: "Facilitator", key: "facilitator" },
          { label: "Workshops", key: "workshops", align: "right" },
          { label: "Total Registrations", key: "totalRegs", align: "right" },
          { label: "Revenue", key: "revenue", align: "right" },
          { label: "Avg per Workshop", key: "avgPerWorkshop", align: "right" },
        ],
        rows: filterByQuery(rows, ["facilitator"]),
        csvHeaders: ["Facilitator", "Workshops", "Total Registrations", "Revenue", "Avg per Workshop"],
        csvRow: (r) => [String(r.facilitator), String(r.workshops), String(r.totalRegs), String(r.revenue), String(r.avgPerWorkshop)],
      };
    }

    /* ============================================================== */
    /*  6. WORKSHOP SUMMARY                                            */
    /* ============================================================== */
    case "workshop-summary": {
      const wsMap = new Map<string, { facilitator: string; type: string; regs: number; paid: number; due: number; revenue: number; partCount: number }>();

      baseRegs.forEach((r) => {
        const ws = workshops.find((w) => w.name === r.workshopTitle || w.id === r.workshopId);
        if (!wsMap.has(r.workshopTitle)) {
          wsMap.set(r.workshopTitle, {
            facilitator: ws?.facilitator || "-",
            type: ws?.type || "-",
            regs: 0,
            paid: 0,
            due: 0,
            revenue: 0,
            partCount: 0,
          });
        }
        const entry = wsMap.get(r.workshopTitle)!;
        entry.regs++;
        entry.paid += r.amountPaid || 0;
        entry.due += r.amountDue || 0;
        entry.revenue += r.amountPaid || 0;
        if (r.paymentMode === "Part" || (r.amountPaid > 0 && r.amountDue > 0)) entry.partCount++;
      });

      const rows: ReportRow[] = Array.from(wsMap.entries()).map(([name, d]) => ({
        workshop: name,
        facilitator: d.facilitator,
        type: d.type,
        registrations: d.regs,
        paid: d.paid,
        due: d.due,
        revenue: d.revenue,
        partCount: d.partCount,
      }));

      return {
        columns: [
          { label: "Workshop", key: "workshop" },
          { label: "Facilitator", key: "facilitator" },
          { label: "Type", key: "type" },
          { label: "Registrations", key: "registrations", align: "right" },
          { label: "Paid", key: "paid", align: "right" },
          { label: "Due", key: "due", align: "right" },
          { label: "Revenue", key: "revenue", align: "right" },
          { label: "Part Payment", key: "partCount", align: "right" },
        ],
        rows: filterByQuery(rows, ["workshop", "facilitator", "type"]),
        csvHeaders: ["Workshop", "Facilitator", "Type", "Registrations", "Paid", "Due", "Revenue", "Part Payment Count"],
        csvRow: (r) => [String(r.workshop), String(r.facilitator), String(r.type), String(r.registrations), String(r.paid), String(r.due), String(r.revenue), String(r.partCount)],
      };
    }

    /* ============================================================== */
    /*  7. BATCH WISE WORKSHOP SUMMARY                                 */
    /* ============================================================== */
    case "batch-wise-workshop-summary": {
      const batchMap = new Map<string, { workshop: string; batch: string; regs: number; paidCount: number; dueCount: number; revenue: number }>();

      baseRegs.forEach((r) => {
        const batch = r.batch || "Main";
        const key = `${r.workshopTitle}||${batch}`;
        if (!batchMap.has(key)) {
          batchMap.set(key, { workshop: r.workshopTitle, batch, regs: 0, paidCount: 0, dueCount: 0, revenue: 0 });
        }
        const entry = batchMap.get(key)!;
        entry.regs++;
        if (r.status === "Paid") entry.paidCount++;
        else entry.dueCount++;
        entry.revenue += r.amountPaid || 0;
      });

      const rows: ReportRow[] = Array.from(batchMap.values()).map((d) => ({
        workshop: d.workshop,
        batch: d.batch,
        registrations: d.regs,
        paidCount: d.paidCount,
        dueCount: d.dueCount,
        revenue: d.revenue,
      }));

      return {
        columns: [
          { label: "Workshop", key: "workshop" },
          { label: "Batch", key: "batch" },
          { label: "Registrations", key: "registrations", align: "right" },
          { label: "Paid Count", key: "paidCount", align: "right" },
          { label: "Due Count", key: "dueCount", align: "right" },
          { label: "Revenue", key: "revenue", align: "right" },
        ],
        rows: filterByQuery(rows, ["workshop", "batch"]),
        csvHeaders: ["Workshop", "Batch", "Registrations", "Paid Count", "Due Count", "Revenue"],
        csvRow: (r) => [String(r.workshop), String(r.batch), String(r.registrations), String(r.paidCount), String(r.dueCount), String(r.revenue)],
      };
    }

    /* ============================================================== */
    /*  8. CLIENT MILESTONE                                            */
    /* ============================================================== */
    case "client-milestone": {
      const clientMap = new Map<string, { name: string; mobile: string; city: string; count: number; totalPaid: number; lastDate: string }>();

      baseRegs.forEach((r) => {
        const key = r.mobile || r.fullName;
        if (!clientMap.has(key)) {
          clientMap.set(key, { name: r.fullName, mobile: r.mobile || "", city: r.city || "", count: 0, totalPaid: 0, lastDate: "" });
        }
        const entry = clientMap.get(key)!;
        entry.count++;
        entry.totalPaid += r.amountPaid || 0;
        if (r.createdAt > entry.lastDate) entry.lastDate = r.createdAt;
      });

      const rows: ReportRow[] = Array.from(clientMap.values())
        .sort((a, b) => b.count - a.count)
        .map((d) => ({
          client: d.name,
          mobile: d.mobile,
          city: d.city,
          workshopsAttended: d.count,
          totalPaid: d.totalPaid,
          lastRegistration: fmtDate(d.lastDate),
        }));

      return {
        columns: [
          { label: "Client", key: "client" },
          { label: "Mobile", key: "mobile" },
          { label: "City", key: "city" },
          { label: "Workshops Attended", key: "workshopsAttended", align: "right" },
          { label: "Total Paid", key: "totalPaid", align: "right" },
          { label: "Last Registration", key: "lastRegistration" },
        ],
        rows: filterByQuery(rows, ["client", "mobile", "city"]),
        csvHeaders: ["Client", "Mobile", "City", "Workshops Attended", "Total Paid", "Last Registration"],
        csvRow: (r) => [String(r.client), String(r.mobile), String(r.city), String(r.workshopsAttended), String(r.totalPaid), String(r.lastRegistration)],
      };
    }

    /* ============================================================== */
    /*  9. FAILED PAYMENT                                              */
    /* ============================================================== */
    case "failed-payment": {
      const rows: ReportRow[] = baseRegs
        .filter((r) => r.status === "Due" || r.amountDue > 0)
        .map((r, i) => ({
          sr: i + 1,
          client: r.fullName,
          mobile: r.mobile || "",
          workshop: r.workshopTitle,
          amountDue: r.amountDue || 0,
          date: fmtDate(r.createdAt),
        }));

      return {
        columns: [
          { label: "Sr", key: "sr" },
          { label: "Client", key: "client" },
          { label: "Mobile", key: "mobile" },
          { label: "Workshop", key: "workshop" },
          { label: "Amount Due", key: "amountDue", align: "right" },
          { label: "Registration Date", key: "date" },
        ],
        rows: filterByQuery(rows, ["client", "mobile", "workshop"]),
        csvHeaders: ["Sr", "Client", "Mobile", "Workshop", "Amount Due", "Registration Date"],
        csvRow: (r) => [String(r.sr), String(r.client), String(r.mobile), String(r.workshop), String(r.amountDue), String(r.date)],
      };
    }

    /* ============================================================== */
    /*  10. PART PAYMENT                                               */
    /* ============================================================== */
    case "part-payment": {
      const rows: ReportRow[] = baseRegs
        .filter((r) => r.paymentMode === "Part" || (r.amountPaid > 0 && r.amountDue > 0))
        .map((r, i) => ({
          sr: i + 1,
          client: r.fullName,
          mobile: r.mobile || "",
          workshop: r.workshopTitle,
          paid: r.amountPaid,
          due: r.amountDue,
          status: r.status,
          date: fmtDate(r.createdAt),
        }));

      return {
        columns: [
          { label: "Sr", key: "sr" },
          { label: "Client", key: "client" },
          { label: "Mobile", key: "mobile" },
          { label: "Workshop", key: "workshop" },
          { label: "Paid", key: "paid", align: "right" },
          { label: "Due", key: "due", align: "right" },
          { label: "Status", key: "status" },
          { label: "Date", key: "date" },
        ],
        rows: filterByQuery(rows, ["client", "mobile", "workshop"]),
        csvHeaders: ["Sr", "Client", "Mobile", "Workshop", "Paid", "Due", "Status", "Date"],
        csvRow: (r) => [String(r.sr), String(r.client), String(r.mobile), String(r.workshop), String(r.paid), String(r.due), String(r.status), String(r.date)],
      };
    }

    /* ============================================================== */
    /*  11. WORKSHOP WISE MEMBER                                       */
    /* ============================================================== */
    case "workshop-wise-member": {
      const rows: ReportRow[] = baseRegs.map((r, i) => ({
        sr: i + 1,
        client: r.fullName,
        mobile: r.mobile || "",
        email: r.email || "",
        city: r.city || "",
        batch: r.batch || "Main",
        status: r.status,
        amount: r.amountPaid,
      }));

      return {
        columns: [
          { label: "Sr", key: "sr" },
          { label: "Client", key: "client" },
          { label: "Mobile", key: "mobile" },
          { label: "Email", key: "email" },
          { label: "City", key: "city" },
          { label: "Batch", key: "batch" },
          { label: "Status", key: "status" },
          { label: "Amount", key: "amount", align: "right" },
        ],
        rows: filterByQuery(rows, ["client", "mobile", "email", "city"]),
        csvHeaders: ["Sr", "Client", "Mobile", "Email", "City", "Batch", "Status", "Amount"],
        csvRow: (r) => [String(r.sr), String(r.client), String(r.mobile), String(r.email), String(r.city), String(r.batch), String(r.status), String(r.amount)],
      };
    }

    /* ============================================================== */
    /*  12. MEMBER ATTEND MORE WORKSHOP                                */
    /* ============================================================== */
    case "member-attend-more-workshop": {
      const clientMap = new Map<string, { name: string; mobile: string; workshops: string[]; totalPaid: number }>();

      baseRegs.forEach((r) => {
        const key = r.mobile || r.fullName;
        if (!clientMap.has(key)) {
          clientMap.set(key, { name: r.fullName, mobile: r.mobile || "", workshops: [], totalPaid: 0 });
        }
        const entry = clientMap.get(key)!;
        if (!entry.workshops.includes(r.workshopTitle)) entry.workshops.push(r.workshopTitle);
        entry.totalPaid += r.amountPaid || 0;
      });

      const rows: ReportRow[] = Array.from(clientMap.values())
        .filter((d) => d.workshops.length >= 2)
        .sort((a, b) => b.workshops.length - a.workshops.length)
        .map((d) => ({
          client: d.name,
          mobile: d.mobile,
          workshopCount: d.workshops.length,
          workshopsList: d.workshops.join(", "),
          totalPaid: d.totalPaid,
        }));

      return {
        columns: [
          { label: "Client", key: "client" },
          { label: "Mobile", key: "mobile" },
          { label: "Workshop Count", key: "workshopCount", align: "right" },
          { label: "Workshops", key: "workshopsList" },
          { label: "Total Paid", key: "totalPaid", align: "right" },
        ],
        rows: filterByQuery(rows, ["client", "mobile", "workshopsList"]),
        csvHeaders: ["Client", "Mobile", "Workshop Count", "Workshops", "Total Paid"],
        csvRow: (r) => [String(r.client), String(r.mobile), String(r.workshopCount), String(r.workshopsList), String(r.totalPaid)],
      };
    }

    /* ============================================================== */
    /*  13. MEMBER DETAILS                                             */
    /* ============================================================== */
    case "member-details": {
      const rows: ReportRow[] = baseRegs.map((r) => ({
        client: r.fullName,
        mobile: r.mobile || "",
        email: r.email || "",
        city: r.city || "",
        workshop: r.workshopTitle,
        batch: r.batch || "Main",
        paymentMode: r.paymentMode || "-",
        paid: r.amountPaid,
        due: r.amountDue,
        date: fmtDate(r.createdAt),
      }));

      return {
        columns: [
          { label: "Client", key: "client" },
          { label: "Mobile", key: "mobile" },
          { label: "Email", key: "email" },
          { label: "City", key: "city" },
          { label: "Workshop", key: "workshop" },
          { label: "Batch", key: "batch" },
          { label: "Payment Mode", key: "paymentMode" },
          { label: "Paid", key: "paid", align: "right" },
          { label: "Due", key: "due", align: "right" },
          { label: "Date", key: "date" },
        ],
        rows: filterByQuery(rows, ["client", "mobile", "email", "city", "workshop"]),
        csvHeaders: ["Client", "Mobile", "Email", "City", "Workshop", "Batch", "Payment Mode", "Paid", "Due", "Date"],
        csvRow: (r) => [String(r.client), String(r.mobile), String(r.email), String(r.city), String(r.workshop), String(r.batch), String(r.paymentMode), String(r.paid), String(r.due), String(r.date)],
      };
    }

    /* ============================================================== */
    /*  14. MEMBER DETAILS PART PAYMENT                                */
    /* ============================================================== */
    case "member-details-part-payment": {
      const rows: ReportRow[] = baseRegs
        .filter((r) => r.paymentMode === "Part" || (r.amountPaid > 0 && r.amountDue > 0))
        .map((r) => {
          const total = (r.amountPaid || 0) + (r.amountDue || 0);
          return {
            client: r.fullName,
            mobile: r.mobile || "",
            workshop: r.workshopTitle,
            batch: r.batch || "Main",
            paid: r.amountPaid,
            due: r.amountDue,
            balancePct: total > 0 ? `${Math.round(((r.amountDue || 0) / total) * 100)}%` : "0%",
            date: fmtDate(r.createdAt),
          };
        });

      return {
        columns: [
          { label: "Client", key: "client" },
          { label: "Mobile", key: "mobile" },
          { label: "Workshop", key: "workshop" },
          { label: "Batch", key: "batch" },
          { label: "Paid", key: "paid", align: "right" },
          { label: "Due", key: "due", align: "right" },
          { label: "Balance %", key: "balancePct", align: "right" },
          { label: "Date", key: "date" },
        ],
        rows: filterByQuery(rows, ["client", "mobile", "workshop"]),
        csvHeaders: ["Client", "Mobile", "Workshop", "Batch", "Paid", "Due", "Balance %", "Date"],
        csvRow: (r) => [String(r.client), String(r.mobile), String(r.workshop), String(r.batch), String(r.paid), String(r.due), String(r.balancePct), String(r.date)],
      };
    }

    /* ============================================================== */
    /*  15. SESSION CONVERSATION — Placeholder                         */
    /* ============================================================== */
    case "session-conversation": {
      return {
        columns: [],
        rows: [],
        csvHeaders: [],
        csvRow: () => [],
        placeholder: (
          <div className="px-4 py-16 text-center">
            <p className="text-lg font-bold text-slate-600">Coming Soon</p>
            <p className="mt-2 text-sm text-slate-400">Session conversation tracking requires a backend integration and will be available in a future update.</p>
          </div>
        ),
      };
    }

    /* ============================================================== */
    /*  16. CLIENT BATCH TRANSFER — Placeholder                        */
    /* ============================================================== */
    case "client-batch-transfer": {
      return {
        columns: [],
        rows: [],
        csvHeaders: [],
        csvRow: () => [],
        placeholder: (
          <div className="px-4 py-16 text-center">
            <p className="text-lg font-bold text-slate-600">Batch Transfer</p>
            <p className="mt-2 text-sm text-slate-400">
              To transfer clients between batches, go to{" "}
              <a className="font-bold text-indigo-600 underline" href="/process/batch-transfer">
                Process &rarr; Batch Transfer
              </a>
            </p>
          </div>
        ),
      };
    }

    /* ============================================================== */
    /*  17. SALES PERSON MILESTONE                                     */
    /* ============================================================== */
    case "sales-person-milestone": {
      const rows: ReportRow[] = salesPeople.map((sp) => {
        const comms = sp.commissions || [];
        const avgLead = comms.length ? Math.round(comms.reduce((s, c) => s + (c.leadPercent || 0), 0) / comms.length) : 0;
        const avgDirect = comms.length ? Math.round(comms.reduce((s, c) => s + (c.directPercent || 0), 0) / comms.length) : 0;
        return {
          name: sp.name,
          mobile: sp.mobile || "",
          group: sp.group || "-",
          active: sp.isActive ? "Yes" : "No",
          workshopsAssigned: comms.length,
          leadPct: `${avgLead}%`,
          directPct: `${avgDirect}%`,
        };
      });

      return {
        columns: [
          { label: "Sales Person", key: "name" },
          { label: "Mobile", key: "mobile" },
          { label: "Group", key: "group" },
          { label: "Active", key: "active", align: "center" },
          { label: "Workshops Assigned", key: "workshopsAssigned", align: "right" },
          { label: "Lead %", key: "leadPct", align: "right" },
          { label: "Direct %", key: "directPct", align: "right" },
        ],
        rows: filterByQuery(rows, ["name", "mobile", "group"]),
        csvHeaders: ["Sales Person", "Mobile", "Group", "Active", "Workshops Assigned", "Lead %", "Direct %"],
        csvRow: (r) => [String(r.name), String(r.mobile), String(r.group), String(r.active), String(r.workshopsAssigned), String(r.leadPct), String(r.directPct)],
      };
    }

    /* ============================================================== */
    /*  18. SALES PERSON PAYMENT — Commission summary                  */
    /* ============================================================== */
    case "sales-person-payment": {
      const rows: ReportRow[] = salesPeople.map((sp) => {
        const comms = sp.commissions || [];
        const workshopNames = comms.map((c) => {
          const ws = workshops.find((w) => w.id === c.workshop);
          return ws?.name || c.workshop;
        });
        return {
          name: sp.name,
          mobile: sp.mobile || "",
          group: sp.group || "-",
          workshopCount: comms.length,
          workshopsList: workshopNames.join(", ") || "-",
          commissionSummary: comms.map((c) => `L:${c.leadPercent}% D:${c.directPercent}%`).join(", ") || "-",
        };
      });

      return {
        columns: [
          { label: "Sales Person", key: "name" },
          { label: "Mobile", key: "mobile" },
          { label: "Group", key: "group" },
          { label: "Workshops", key: "workshopCount", align: "right" },
          { label: "Workshop Names", key: "workshopsList" },
          { label: "Commission (Lead/Direct)", key: "commissionSummary" },
        ],
        rows: filterByQuery(rows, ["name", "mobile"]),
        csvHeaders: ["Sales Person", "Mobile", "Group", "Workshops", "Workshop Names", "Commission Summary"],
        csvRow: (r) => [String(r.name), String(r.mobile), String(r.group), String(r.workshopCount), String(r.workshopsList), String(r.commissionSummary)],
      };
    }

    /* ============================================================== */
    /*  19. SALES PERSON LEAD ASSIGN — Placeholder                     */
    /* ============================================================== */
    case "sales-person-lead-assign": {
      return {
        columns: [],
        rows: [],
        csvHeaders: [],
        csvRow: () => [],
        placeholder: (
          <div className="px-4 py-16 text-center">
            <p className="text-lg font-bold text-slate-600">Coming Soon</p>
            <p className="mt-2 text-sm text-slate-400">Lead assignment tracking will be available in a future update.</p>
          </div>
        ),
      };
    }

    /* ============================================================== */
    /*  DEFAULT fallback                                                */
    /* ============================================================== */
    default: {
      return {
        columns: [{ label: "Info", key: "info" }],
        rows: [{ info: "Unknown report." }],
        csvHeaders: ["Info"],
        csvRow: (r) => [String(r.info)],
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Cell renderer                                                      */
/* ------------------------------------------------------------------ */

function renderCell(col: Column, row: ReportRow) {
  const val = row[col.key];
  if (val === undefined || val === null) return "-";

  // Currency columns
  const currencyKeys = ["amount", "paid", "due", "revenue", "totalPaid", "totalRevenue", "amountDue"];
  if (currencyKeys.includes(col.key) && typeof val === "number") {
    return formatCurrency(val);
  }

  // Status badge
  if (col.key === "status") {
    const s = String(val);
    const color =
      s === "Paid" || s === "Active" || s === "Yes"
        ? "bg-emerald-50 text-emerald-700"
        : s === "Due" || s === "Inactive" || s === "No"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-600";
    return <span className={`rounded-full px-3 py-1 text-xs font-black ${color}`}>{s}</span>;
  }

  if (col.key === "active") {
    const s = String(val);
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-black ${s === "Yes" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        {s}
      </span>
    );
  }

  return String(val);
}

/* ------------------------------------------------------------------ */
/*  Page sizes for pagination                                          */
/* ------------------------------------------------------------------ */

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ReportPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const title = titles.get(slug) ?? "Report";

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);

  const [workshop, setWorkshop] = useState("All Workshops");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setRegistrations(loadJson<Registration>("cfl_registrations_v1"));
    setWorkshops(loadJson<Workshop>("cfl_workshop_master_records_v1"));
    setClients(loadJson<Client>("cfl_clients_v1"));
    setSalesPeople(loadJson<SalesPerson>("cfl_sales_people_v1"));
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [workshop, fromDate, toDate, query, pageSize]);

  const workshopOptions = Array.from(new Set(registrations.map((e) => e.workshopTitle).filter(Boolean)));

  const report = useMemo(
    () => buildReport(slug, registrations, workshops, clients, salesPeople, workshop, fromDate, toDate, query),
    [slug, registrations, workshops, clients, salesPeople, workshop, fromDate, toDate, query]
  );

  const totalRows = report.rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginatedRows = report.placeholder ? [] : report.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function exportRows() {
    if (report.csvHeaders.length === 0) return;
    downloadCsv(`${slug}.csv`, [report.csvHeaders, ...report.rows.map(report.csvRow)]);
    setMessage(`Exported ${report.rows.length} rows.`);
  }

  // Determine which filters are relevant for this report
  const showWorkshopFilter = ![
    "workshop-url-status",
    "yearly-public-session",
    "sales-person-milestone",
    "sales-person-payment",
    "sales-person-lead-assign",
    "session-conversation",
    "client-batch-transfer",
  ].includes(slug);

  const showDateFilter = ![
    "workshop-url-status",
    "sales-person-milestone",
    "sales-person-payment",
    "sales-person-lead-assign",
    "session-conversation",
    "client-batch-transfer",
  ].includes(slug);

  return (
    <AdminPlatformShell
      activeLabel={title}
      description="Search, filter and export report data from the same compact admin platform."
      title={title}
    >
      <section className="rounded-2xl border border-slate-200 bg-white shadow-soft">
        {/* Filter bar */}
        {!report.placeholder && (
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-5 md:p-6">
            {showWorkshopFilter && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">Workshop</span>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  onChange={(e) => setWorkshop(e.target.value)}
                  value={workshop}
                >
                  <option>All Workshops</option>
                  {workshopOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            )}
            {showDateFilter && (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">From</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    onChange={(e) => setFromDate(e.target.value)}
                    type="date"
                    value={fromDate}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">To</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    onChange={(e) => setToDate(e.target.value)}
                    type="date"
                    value={toDate}
                  />
                </label>
              </>
            )}
            <button
              className="mt-auto rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700"
              onClick={() => setMessage(`Found ${report.rows.length} rows.`)}
              type="button"
            >
              Search
            </button>
          </div>
        )}

        {/* Export + Search bar */}
        {!report.placeholder && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 md:p-6">
            <div className="flex items-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                onClick={exportRows}
                type="button"
              >
                <Download className="size-4" />
                Export
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Show
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none"
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  value={pageSize}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                rows
              </label>
            </div>
            <label className="relative block w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search report..."
                value={query}
              />
            </label>
          </div>
        )}

        {message && !report.placeholder ? (
          <p className="mx-4 mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 md:mx-6">{message}</p>
        ) : null}

        {/* Placeholder content for non-table reports */}
        {report.placeholder ? (
          report.placeholder
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {report.columns.map((col) => (
                      <th className={`px-4 py-4 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`} key={col.key}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.length ? (
                    paginatedRows.map((row, index) => (
                      <tr className="hover:bg-emerald-50/40" key={index}>
                        {report.columns.map((col) => (
                          <td
                            className={`px-4 py-4 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.key === "workshop" || col.key === "client" || col.key === "name" ? "font-bold text-slate-950" : ""}`}
                            key={col.key}
                          >
                            {renderCell(col, row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-12 text-center text-slate-500" colSpan={report.columns.length || 1}>
                        No report data yet. Register clients into workshops to populate this report.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalRows > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 md:px-6">
                <p className="text-sm text-slate-500">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalRows)} of {totalRows} rows
                </p>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    type="button"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        className={`min-w-[36px] rounded-lg border px-3 py-2 text-sm font-bold ${page === currentPage ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        type="button"
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    type="button"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </AdminPlatformShell>
  );
}
