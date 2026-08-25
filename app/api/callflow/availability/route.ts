import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { getAppState, saveAppState } from "@/lib/db";
import type { SalesTeamUser } from "@/lib/types";

type SalesPersonAvailability = {
  id?: string;
  acceptingLeads?: boolean;
  assignmentPausedAt?: string;
  assignmentAvailabilityUpdatedAt?: string;
  [key: string]: unknown;
};

async function authenticatedState(request: NextRequest) {
  const identity = readCallFlowBearer(request);
  if (!identity) return null;
  const state = await getAppState();
  if (!state) return null;
  const users = (Array.isArray(state.salesTeamUsers) ? state.salesTeamUsers : []) as SalesTeamUser[];
  const user = users.find((item) => item.id === identity.userId && item.salesPersonId === identity.salesPersonId && item.active);
  if (!user) return null;
  return { identity, state };
}

export async function GET(request: NextRequest) {
  const result = await authenticatedState(request);
  if (!result) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const people = (Array.isArray(result.state.salesPeople) ? result.state.salesPeople : []) as SalesPersonAvailability[];
  const person = people.find((item) => item.id === result.identity.salesPersonId);
  if (!person) return NextResponse.json({ error: "Salesperson profile not found." }, { status: 404 });
  return NextResponse.json({
    acceptingLeads: person.acceptingLeads !== false,
    changedAt: person.assignmentAvailabilityUpdatedAt ?? null
  });
}

export async function POST(request: NextRequest) {
  const result = await authenticatedState(request);
  if (!result) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { acceptingLeads?: unknown; latitude?: unknown; longitude?: unknown; accuracyMeters?: unknown; capturedAt?: unknown } | null;
  if (typeof body?.acceptingLeads !== "boolean") {
    return NextResponse.json({ error: "acceptingLeads must be a boolean." }, { status: 400 });
  }
  const people = (Array.isArray(result.state.salesPeople) ? result.state.salesPeople : []) as SalesPersonAvailability[];
  const index = people.findIndex((item) => item.id === result.identity.salesPersonId);
  if (index < 0) return NextResponse.json({ error: "Salesperson profile not found." }, { status: 404 });
  const changedAt = new Date().toISOString();
  const updated = [...people];
  const previousAccepting = updated[index].acceptingLeads !== false;
  const latitude=Number(body.latitude);const longitude=Number(body.longitude);const accuracyMeters=Number(body.accuracyMeters);const hasLocation=Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180;
  if(!hasLocation)return NextResponse.json({error:"A valid shift location is required."},{status:400});
  const location={latitude,longitude,accuracyMeters:Number.isFinite(accuracyMeters)?accuracyMeters:null,capturedAt:String(body.capturedAt||changedAt)};
  updated[index] = {
    ...updated[index],
    acceptingLeads: body.acceptingLeads,
    assignmentPausedAt: body.acceptingLeads ? undefined : changedAt,
    assignmentAvailabilityUpdatedAt: changedAt
  };
  const integrations = { ...(result.state.integrations || {}) } as Record<string, unknown>;
  const connector = (integrations.callflow && typeof integrations.callflow === "object" ? integrations.callflow : {}) as Record<string, unknown>;
  const shiftEvents = Array.isArray(connector.shiftEvents) ? connector.shiftEvents as Array<Record<string, unknown>> : [];
  const nextEvents = previousAccepting === body.acceptingLeads ? shiftEvents : [{ id: `shift-${result.identity.salesPersonId}-${Date.now()}`, salespersonId: result.identity.salesPersonId, salespersonName: result.identity.name, type: body.acceptingLeads ? "START" : "END", at: changedAt, location }, ...shiftEvents].slice(0, 10000);
  integrations.callflow = { ...connector, shiftEvents: nextEvents };
  await saveAppState({ salesPeople: updated, integrations });
  return NextResponse.json({ acceptingLeads: body.acceptingLeads, changedAt });
}
