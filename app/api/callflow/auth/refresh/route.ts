import { NextRequest, NextResponse } from "next/server";
import { createCallFlowToken, readCallFlowToken } from "@/lib/callflow-auth";
import { getAppState } from "@/lib/db";
import type { SalesTeamUser } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { refreshToken?: string };
    const identity = readCallFlowToken(body.refreshToken, "refresh");
    if (!identity) return NextResponse.json({ error: "Invalid or expired refresh token." }, { status: 401 });
    const state = await getAppState();
    const active = (state?.salesTeamUsers as SalesTeamUser[] | undefined)?.some((item) => item.id === identity.userId && item.active);
    if (!active) return NextResponse.json({ error: "Account is inactive." }, { status: 401 });
    return NextResponse.json({ accessToken: createCallFlowToken(identity, "access", 3600), refreshToken: createCallFlowToken(identity, "refresh", 60 * 60 * 24 * 30), expiresAt: new Date(Date.now() + 3600_000).toISOString() });
  } catch { return NextResponse.json({ error: "Could not refresh session." }, { status: 400 }); }
}
