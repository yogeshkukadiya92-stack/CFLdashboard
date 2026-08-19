import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { readSalesSession, SALES_SESSION_COOKIE } from "@/lib/sales-session";

export async function GET(request: NextRequest) {
  if (await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)) return NextResponse.json({ role: "admin", name: "Admin User" });
  const sales = await readSalesSession(request.cookies.get(SALES_SESSION_COOKIE)?.value);
  if (sales) return NextResponse.json({ role: "sales", name: sales.name, roles: sales.roles, permissions: sales.permissions });
  return NextResponse.json({ role: "none" }, { status: 401 });
}
