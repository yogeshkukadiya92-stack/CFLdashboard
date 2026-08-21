import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { getAppState, saveAppState } from "@/lib/db";

export async function POST(request: NextRequest) {
  const identity = readCallFlowBearer(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const installId = String(body.installId || "").trim();
  if (!installId) return NextResponse.json({ error: "installId is required." }, { status: 400 });
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "CRM database is unavailable." }, { status: 503 });
  const integrations = { ...(state.integrations || {}) } as Record<string, unknown>;
  const connector = (integrations.callflow && typeof integrations.callflow === "object" ? integrations.callflow : {}) as Record<string, unknown>;
  const devices = Array.isArray(connector.devices) ? connector.devices as Record<string, unknown>[] : [];
  const deviceId = `cf-${identity.userId}-${installId}`;
  const registered = { ...body, deviceId, userId: identity.userId, status: "ACTIVE", registeredAt: new Date().toISOString() };
  integrations.callflow = { ...connector, devices: [registered, ...devices.filter((item) => item.deviceId !== deviceId)].slice(0, 500) };
  await saveAppState({ integrations });
  return NextResponse.json({ deviceId, status: "ACTIVE" });
}
