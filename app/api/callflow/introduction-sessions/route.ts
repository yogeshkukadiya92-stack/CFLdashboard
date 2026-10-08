import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { introductionStatuses } from "@/lib/introduction-statuses";
import { introductionInvitations } from "@/lib/introduction-invitations";
import { getAppState, getDbPool } from "@/lib/db";
import type { Lead, RegistrationEntry, RegistrationConfirmationStatus } from "@/lib/types";

const phone = (value: string) => value.replace(/\D/g, "").slice(-10);

async function context(request: NextRequest) {
  const identity = await readCallFlowBearer(request);
  if (!identity) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  // The CFL workshop records belong to the original dashboard, not arbitrary company tenants.
  if ("sessionId" in identity && identity.sessionId) return { error: NextResponse.json({ error: "Introduction sessions are not connected for this company workspace." }, { status: 409 }) };
  const state = await getAppState();
  if (!state) return { error: NextResponse.json({ error: "Database unavailable" }, { status: 503 }) };
  const user = (state.salesTeamUsers as Array<{ id: string; active: boolean }>).find(user => user.id === identity.userId && user.active);
  if (!user) return { error: NextResponse.json({ error: "Account inactive" }, { status: 401 }) };
  const person = (state.salesPeople as Array<{ id: string; name: string }>).find(person => person.id === identity.salesPersonId);
  const leads = (state.leads as Lead[]).filter(lead => lead.assignedSalesPersonId === identity.salesPersonId || lead.assignedTo === (person?.name || identity.name));
  return { identity, state, leads };
}


export async function GET(request: NextRequest) {
  const ctx = await context(request);
  if (ctx.error) return ctx.error;
  return NextResponse.json({ invitations: introductionInvitations(ctx.state!, ctx.leads!), statusOptions: introductionStatuses(ctx.state!.integrations) });
}

export async function POST(request: NextRequest) {
  const ctx = await context(request);
  if (ctx.error) return ctx.error;
  const body = await request.json().catch(() => null);
  if (!body || !introductionStatuses(ctx.state!.integrations).some(status => status.id === body.status)) return NextResponse.json({ error: "Invalid confirmation status" }, { status: 400 });
  const allowed = introductionInvitations(ctx.state!, ctx.leads!).some(invite => invite.leadId === body.leadId && invite.registrationId === body.registrationId);
  if (!allowed) return NextResponse.json({ error: "Invitation not found for your assigned leads" }, { status: 404 });
  const pool = getDbPool();
  if (!pool) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ payload: RegistrationEntry }>("SELECT payload FROM cfl_registration_records WHERE external_id=$1 FOR UPDATE", [body.registrationId]);
    const current = result.rows[0]?.payload;
    const lead = ctx.leads!.find(lead => lead.id === body.leadId)!;
    if (!current || phone(current.mobile) !== phone(lead.mobile) || !current.introductionSessionId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Invitation changed; refresh and try again" }, { status: 409 });
    }
    if (!introductionStatuses(ctx.state!.integrations).some(option => option.id === body.status && option.active) && current.confirmationStatus !== body.status) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Status is inactive" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const updated: RegistrationEntry = { ...current, confirmationStatus: body.status as RegistrationConfirmationStatus, confirmationUpdatedAt: now, confirmationUpdatedBy: ctx.identity!.name,
      confirmationHistory: [{ id: crypto.randomUUID(), action: "status" as const, status: body.status, actorGrantId: ctx.identity!.userId, actorName: ctx.identity!.name, createdAt: now }, ...(current.confirmationHistory || [])].slice(0, 200) };
    await client.query("UPDATE cfl_registration_records SET payload=$2::jsonb, updated_at=NOW() WHERE external_id=$1", [current.id, JSON.stringify(updated)]);
    await client.query("COMMIT");
    ctx.state!.registrations = (ctx.state!.registrations as RegistrationEntry[]).map(reg => reg.id === current.id ? updated : reg);
    return NextResponse.json({ invitations: introductionInvitations(ctx.state!, ctx.leads!), statusOptions: introductionStatuses(ctx.state!.integrations) });
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Could not save confirmation" }, { status: 500 });
  } finally { client.release(); }
}
