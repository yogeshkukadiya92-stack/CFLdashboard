import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { applyCrmSlaAutomation, getCrmAutomationOverview } from "@/lib/crm-automation";
import { getAppState, saveAppState } from "@/lib/db";
import type { Lead } from "@/lib/types";

export async function POST(request: NextRequest) {
  if (!(await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    const current = (Array.isArray(state.leads) ? state.leads : []) as Lead[];
    if (current.length > 50_000) return NextResponse.json({ error: "Lead volume exceeds the safe processing limit." }, { status: 422 });
    const result = applyCrmSlaAutomation(current);
    if (result.created.length) await saveAppState({ leads: result.leads });
    return NextResponse.json({ ok: true, created: result.created.length, overview: getCrmAutomationOverview(result.leads) });
  } catch {
    return NextResponse.json({ error: "Could not process CRM automation." }, { status: 500 });
  }
}
