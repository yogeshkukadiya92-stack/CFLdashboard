import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { readSalesSession, SALES_SESSION_COOKIE } from "@/lib/sales-session";
import { permissionForPath } from "@/lib/sales-permissions";
import { NextRequest, NextResponse } from "next/server";

const publicPrefixes = [
  "/login",
  "/sales-login",
  "/register",
  "/lp",
  "/attendance",
  "/attendance-team",
  "/response-view",
  "/api/auth",
  "/api/sales-auth",
  "/api/otp",
  "/api/public-registration-state",
  "/api/public-profile-lookup",
  "/api/attendance-state",
  "/api/attendance-team",
  "/api/response-view",
  "/api/form-analytics",
  "/api/razorpay/order",
  "/api/webhooks/razorpay",
  "/api/v1",
  "/_next",
  "/favicon.ico"
];

function isPublicPath(pathname: string) {
  return publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const salesSession = await readSalesSession(request.cookies.get(SALES_SESSION_COOKIE)?.value);

  if (pathname === "/login" && request.nextUrl.searchParams.get("next") === "/sales-login") {
    return NextResponse.redirect(new URL("/sales-login", request.url));
  }

  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const salesHome = salesSession?.permissions.includes("crm_today") ? "/crm/today" : salesSession?.permissions.includes("follow_ups") ? "/crm/follow-ups" : salesSession?.permissions.includes("sales_sessions") ? "/crm/sessions" : salesSession?.permissions.includes("crm_analytics") ? "/crm/analytics" : null;

  if (pathname === "/sales-login" && salesSession && salesHome) {
    return NextResponse.redirect(new URL(salesHome, request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (salesSession) {
    const permission = permissionForPath(pathname);
    const allowed = pathname === "/api/state" || Boolean(permission && salesSession.permissions.includes(permission));
    if (allowed) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const fallback = salesHome || "/sales-login?access=none";
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  if (!signedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
