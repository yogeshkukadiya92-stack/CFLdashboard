import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import { readSalesSession, SALES_SESSION_COOKIE } from "@/lib/sales-session";
import type { Lead, SalesTeamUser } from "@/lib/types";

const arrayFields = [
  "attendanceEntries",
  "attendanceSessions",
  "clients",
  "facilitators",
  "formAnalytics",
  "forms",
  "leads",
  "landingPages",
  "registrations",
  "salesPeople",
  "schedules",
  "workshopTypes",
  "workshops"
] as const;

const objectFields = ["integrations", "registrationLinks"] as const;

async function getRequestRole(request: NextRequest) {
  if (await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)) return { role: "admin" as const };
  const session = await readSalesSession(request.cookies.get(SALES_SESSION_COOKIE)?.value);
  return session ? { role: "sales" as const, session } : { role: "none" as const };
}

function salespersonName(state: Awaited<ReturnType<typeof getAppState>>, salesPersonId: string) {
  const people = Array.isArray(state?.salesPeople) ? state.salesPeople : [];
  const person = people.find((item: unknown) => String((item as { id?: unknown })?.id) === salesPersonId) as { name?: unknown } | undefined;
  return String(person?.name || "");
}

export async function GET(request: NextRequest) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false });
  }
  try {
    const state = await getAppState();
    if (!state) return NextResponse.json({ dbEnabled: true });
    const access = await getRequestRole(request);
    if (access.role === "none") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (access.role === "sales") {
      const users = state.salesTeamUsers as SalesTeamUser[];
      const user = users.find((item) => item.id === access.session.userId && item.active);
      if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      const name = salespersonName(state, access.session.salesPersonId) || user.name;
      const leads = (state.leads as Lead[]).filter((lead) => lead.assignedTo === name);
      const salesPeople = state.salesPeople.filter((item: unknown) => String((item as { id?: unknown })?.id) === user.salesPersonId);
      return NextResponse.json({ dbEnabled: true, leads, salesPeople });
    }
    const {
      attendanceTeamUsers: _privateAttendanceTeamUsers,
      responseAccessGrants: _privateResponseAccessGrants,
      salesTeamUsers: _privateSalesTeamUsers,
      ...publicState
    } = state;
    return NextResponse.json({ dbEnabled: true, ...publicState });
  } catch (error) {
    return NextResponse.json({ dbEnabled: true, error: "Failed to read DB state" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false }, { status: 400 });
  }
  try {
    const access = await getRequestRole(request);
    if (access.role === "none") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    if (access.role === "sales") {
      const state = await getAppState();
      if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
      const users = state.salesTeamUsers as SalesTeamUser[];
      const user = users.find((item) => item.id === access.session.userId && item.active);
      if (!user || !Array.isArray(body?.leads)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      const name = salespersonName(state, access.session.salesPersonId) || user.name;
      const incoming = new Map((body.leads as Lead[]).map((lead) => [lead.id, lead]));
      const merged = (state.leads as Lead[]).map((lead) => {
        if (lead.assignedTo !== name) return lead;
        const update = incoming.get(lead.id);
        return update && update.assignedTo === name ? update : lead;
      });
      await saveAppState({ leads: merged });
      return NextResponse.json({ ok: true, dbEnabled: true });
    }
    const patch: Record<string, unknown> = {};
    arrayFields.forEach((field) => {
      if (Array.isArray(body?.[field])) patch[field] = body[field];
    });
    objectFields.forEach((field) => {
      if (body?.[field] && typeof body[field] === "object" && !Array.isArray(body[field])) {
        patch[field] = body[field];
      }
    });
    await saveAppState(patch);
    return NextResponse.json({ ok: true, dbEnabled: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save DB state" }, { status: 500 });
  }
}
