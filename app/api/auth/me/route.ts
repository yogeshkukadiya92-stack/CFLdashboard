import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAdminEmail, getAdminMobile, getAdminName, verifyAuthToken } from "@/lib/auth";
import { getAppState } from "@/lib/db";
import { readSalesSession, SALES_SESSION_COOKIE } from "@/lib/sales-session";
import type { SalesTeamUser } from "@/lib/types";

export async function GET(request: NextRequest) {
  if (await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)) return NextResponse.json({ role: "admin", name: getAdminName(), email: getAdminEmail(), mobile: getAdminMobile() });
  const sales = await readSalesSession(request.cookies.get(SALES_SESSION_COOKIE)?.value);
  if (sales) {
    const state = await getAppState().catch(() => null);
    const users = Array.isArray(state?.salesTeamUsers) ? state.salesTeamUsers as SalesTeamUser[] : [];
    const user = users.find((item) => item.id === sales.userId);
    return NextResponse.json({ role: "sales", name: sales.name, email: user?.email || "", mobile: user?.mobile || "", roles: sales.roles, permissions: sales.permissions });
  }
  return NextResponse.json({ role: "none" }, { status: 401 });
}
