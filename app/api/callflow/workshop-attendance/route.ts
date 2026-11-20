import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { readSalesSession, SALES_SESSION_COOKIE } from "@/lib/sales-session";
import { ensurePersistenceTable, ensureRegistrationRecordsTable, getAppState, getDbPool, upsertRegistrationRecord } from "@/lib/db";
import { assignAttendanceLead, attendanceStatuses, ownsAttendanceLead, registerAttendanceLead, updateWorkshopAttendance, workshopAttendanceRows, type AttendanceState, type AttendanceStatus } from "@/lib/callflow-attendance";
import type { RegistrationEntry, SalesTeamUser } from "@/lib/types";

type Access = { admin: boolean; userId: string; salesPersonId: string; name: string };
async function access(request: NextRequest): Promise<Access | null> {
  if (await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)) return { admin: true, userId: "admin", salesPersonId: "", name: "Dashboard admin" };
  const identity = await readCallFlowBearer(request);
  // Company tenants cannot read the original CFL workshop database.
  if (identity?.sessionId || identity?.tenantId) return null;
  if (identity) return { ...identity, admin: false };
  const sales = await readSalesSession(request.cookies.get(SALES_SESSION_COOKIE)?.value);
  return sales && (sales.permissions.includes("sales_sessions") || sales.permissions.includes("lead_details")) ? { ...sales, admin: false } : null;
}
function active(access: Access, users: SalesTeamUser[]) {
  return access.admin || users.some(user => user.id === access.userId && user.salesPersonId === access.salesPersonId && user.active);
}
function response(state: AttendanceState, auth: Access) {
  const person = state.salesPeople.find(person => person.id === auth.salesPersonId);
  const leads = state.leads.filter(lead => auth.admin || ownsAttendanceLead(lead, auth.salesPersonId, person?.name || auth.name));
  return { records: workshopAttendanceRows(state, leads), sessions: state.attendanceSessions.filter(session => session.published).map(session => ({ id: session.id, title: session.title, workshopTitle: session.workshopName, sessionDate: session.sessionDate, introduction: Boolean(session.introductionSessionId) })), salesPeople: state.salesPeople.filter(person => person.isActive !== false).map(person => ({ id: person.id, name: person.name })), leads: leads.map(lead => ({ id: lead.id, name: lead.name, mobile: lead.mobile })) };
}
export async function GET(request: NextRequest) {
  const auth = await access(request);
  if (!auth) return NextResponse.json({ error: "Sign in to your CFL account." }, { status: 401 });
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  if (!active(auth, state.salesTeamUsers as SalesTeamUser[])) return NextResponse.json({ error: "Account inactive." }, { status: 403 });
  return NextResponse.json(response(state as AttendanceState, auth), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  const auth = await access(request);
  if (!auth) return NextResponse.json({ error: "Sign in to your CFL account." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !["register", "attendance", "assign"].includes(body.action) || typeof body.leadId !== "string" || typeof body.sessionId !== "string") return NextResponse.json({ error: "Choose a participant and workshop session." }, { status: 400 });
  if (body.action === "attendance" && !attendanceStatuses.includes(body.status)) return NextResponse.json({ error: "Invalid attendance status." }, { status: 400 });
  await ensurePersistenceTable(); await ensureRegistrationRecordsTable();
  const pool = getDbPool();
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query("SELECT leads, attendance_sessions, attendance_entries, sales_people, sales_team_users FROM app_state WHERE id=1 FOR UPDATE");
    const row = selected.rows[0];
    if (!row || !active(auth, row.sales_team_users || [])) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Account inactive." }, { status: 403 }); }
    const registrations = await client.query<{ payload: RegistrationEntry }>("SELECT payload FROM cfl_registration_records ORDER BY external_id FOR UPDATE");
    const state: AttendanceState = { leads: row.leads || [], attendanceSessions: row.attendance_sessions || [], attendanceEntries: row.attendance_entries || [], salesPeople: row.sales_people || [], registrations: registrations.rows.map(row => row.payload) };
    const person = state.salesPeople.find(person => person.id === auth.salesPersonId);
    const lead = state.leads.find(lead => lead.id === body.leadId && (auth.admin || ownsAttendanceLead(lead, auth.salesPersonId, person?.name || auth.name)));
    const session = state.attendanceSessions.find(session => session.id === body.sessionId);
    if (!lead || !session) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Participant or session is no longer available. Refresh and retry." }, { status: 404 }); }
    const existing = workshopAttendanceRows(state, [lead]).some(record => record.sessionId === session.id);
    if (!session.published && !existing) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This session is not open for registration." }, { status: 409 }); }
    const before = new Map(state.registrations.map(reg => [reg.id, reg]));
    const now = new Date().toISOString(); const id = crypto.randomUUID();
    if (body.action === "register") registerAttendanceLead(state, lead, session, now, `registration-${id}`);
    if (body.action === "attendance") updateWorkshopAttendance(state, lead, session, body.status as AttendanceStatus, auth.name, now, id);
    if (body.action === "assign") {
      if (!existing) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Register the participant first." }, { status: 409 }); }
      assignAttendanceLead(state, lead, String(body.salesPersonId || ""), auth.name, now, id);
    }
    for (const registration of state.registrations) if (before.get(registration.id) !== registration) await upsertRegistrationRecord(client, registration as unknown as Record<string, unknown>);
    await client.query("UPDATE app_state SET leads=$1::jsonb, attendance_entries=$2::jsonb, updated_at=NOW() WHERE id=1", [JSON.stringify(state.leads), JSON.stringify(state.attendanceEntries)]);
    await client.query("COMMIT");
    return NextResponse.json(response(state, auth));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && ["Lead needs a valid mobile number.", "Select an active salesperson."].includes(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Changes were not saved. Please retry." }, { status: 500 });
  } finally { client.release(); }
}
