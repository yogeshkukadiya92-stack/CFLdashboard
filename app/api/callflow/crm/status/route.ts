import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { isDbEnabled } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!readCallFlowBearer(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const connected = await isDbEnabled();
  return NextResponse.json({ connectorId: "cfl-dashboard", dashboardName: "Coach For Life CRM", status: connected ? "CONNECTED" : "OFFLINE", syncDirection: "BIDIRECTIONAL", lastSuccessfulSyncAt: null, capabilities: ["leads", "calls", "notes", "follow-ups", "dispositions"] });
}
