import { NextRequest, NextResponse } from "next/server";
import { getAppState, saveAppState } from "@/lib/db";
import { verifySalesPassword } from "@/lib/sales-auth";
import { createCallFlowToken } from "@/lib/callflow-auth";
import type { SalesTeamUser } from "@/lib/types";
import { usesSupabaseAuth, supabasePasswordLogin } from "@/lib/supabase-auth";
import { createPersonalWorkspace } from "@/lib/callflow-signup";
import { requirePlatformPool } from "@/lib/platform/database";
import { centralAccountSchemaAvailable, loginCentralAccount } from "@/lib/callflow-central-session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { identity?: string; password?: string; installId?: string; deviceName?: string; appVersion?: string };
    const identity = String(body.identity || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!identity || !password) return NextResponse.json({ error: "Email/mobile number and password are required." }, { status: 400 });
    if (await centralAccountSchemaAvailable()) {
      let verifiedSupabaseId: string | undefined;
      if (usesSupabaseAuth() && identity.includes("@")) {
        const account = await requirePlatformPool().query("SELECT supabase_user_id FROM callflow_users WHERE email_normalized=$1", [identity]);
        const legacy = !account.rowCount ? await getAppState() : null;
        const legacyExists = (legacy?.salesTeamUsers || []).some((value: unknown) => (value as { email?: string }).email?.trim().toLowerCase() === identity);
        if (account.rows[0]?.supabase_user_id || (!account.rowCount && !legacyExists)) {
          const user = await supabasePasswordLogin(identity, password);
          await createPersonalWorkspace({ name: user.user_metadata?.name, workspaceName: user.user_metadata?.workspaceName, email: user.email, password }, user.id);
          verifiedSupabaseId = user.id;
        }
      }
      const central = await loginCentralAccount(identity, password, {
        installId: String(body.installId || ""), deviceName: body.deviceName, appVersion: body.appVersion,
      }, verifiedSupabaseId);
      if (central) return NextResponse.json(central);
    }
    const mobile = identity.replace(/\D/g, "").slice(-10);
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "CRM database is unavailable." }, { status: 503 });
    const users = (Array.isArray(state.salesTeamUsers) ? state.salesTeamUsers : []) as SalesTeamUser[];
    const user = users.find((item) => item.email.trim().toLowerCase() === identity || (mobile.length === 10 && item.mobile.replace(/\D/g, "").slice(-10) === mobile));
    if (!user || !user.active || !verifySalesPassword(password, user)) return NextResponse.json({ error: "Invalid email/mobile number or password." }, { status: 401 });
    const tokenIdentity = { userId: user.id, salesPersonId: user.salesPersonId, name: user.name };
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const updated = { ...user, lastLoginAt: new Date().toISOString(), loginCount: user.loginCount + 1 };
    await saveAppState({ salesTeamUsers: [updated, ...users.filter((item) => item.id !== user.id)] });
    return NextResponse.json({ accessToken: createCallFlowToken(tokenIdentity, "access", 3600), refreshToken: createCallFlowToken(tokenIdentity, "refresh", 60 * 60 * 24 * 30), expiresAt, employeeName: user.name, mobile: user.mobile });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_NOT_CONFIRMED") return NextResponse.json({ error: "Confirm your email before signing in." }, { status: 403 });
    if (error instanceof Error && error.message === "AUTH_RATE_LIMITED") return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    if (error instanceof Error && error.message === "AUTH_UNAVAILABLE") return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
    if (error instanceof Error && (error.message === "INVALID_CREDENTIALS" || error.message.includes("installation id"))) {
      return NextResponse.json({ error: error.message === "INVALID_CREDENTIALS" ? "Invalid email/mobile number or password." : error.message }, { status: error.message === "INVALID_CREDENTIALS" ? 401 : 400 });
    }
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
