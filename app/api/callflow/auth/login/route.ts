import { NextRequest, NextResponse } from "next/server";
import { getAppState, saveAppState } from "@/lib/db";
import { verifySalesPassword } from "@/lib/sales-auth";
import { createCallFlowToken } from "@/lib/callflow-auth";
import type { SalesTeamUser } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { identity?: string; password?: string };
    const identity = String(body.identity || "").trim().toLowerCase();
    const mobile = identity.replace(/\D/g, "").slice(-10);
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "CRM database is unavailable." }, { status: 503 });
    const users = (Array.isArray(state.salesTeamUsers) ? state.salesTeamUsers : []) as SalesTeamUser[];
    const user = users.find((item) => item.email.trim().toLowerCase() === identity || (mobile.length === 10 && item.mobile.replace(/\D/g, "").slice(-10) === mobile));
    if (!user || !user.active || !verifySalesPassword(String(body.password || ""), user)) return NextResponse.json({ error: "Invalid email/mobile number or password." }, { status: 401 });
    const tokenIdentity = { userId: user.id, salesPersonId: user.salesPersonId, name: user.name };
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const updated = { ...user, lastLoginAt: new Date().toISOString(), loginCount: user.loginCount + 1 };
    await saveAppState({ salesTeamUsers: [updated, ...users.filter((item) => item.id !== user.id)] });
    return NextResponse.json({ accessToken: createCallFlowToken(tokenIdentity, "access", 3600), refreshToken: createCallFlowToken(tokenIdentity, "refresh", 60 * 60 * 24 * 30), expiresAt, employeeName: user.name, mobile: user.mobile });
  } catch { return NextResponse.json({ error: "Could not sign in." }, { status: 500 }); }
}
