import { NextRequest, NextResponse } from "next/server";
import { readCallFlowToken } from "@/lib/callflow-auth";
import { revokeCentralSession } from "@/lib/callflow-central-session";

export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const identity = readCallFlowToken(header.match(/^Bearer\s+(.+)$/i)?.[1], "access");
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (identity.sessionId) await revokeCentralSession(identity);
  return NextResponse.json({ ok: true });
}
