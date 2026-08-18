import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { readSalesSession, SALES_SESSION_COOKIE } from "@/lib/sales-session";
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

  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/sales-login" && salesSession) {
    return NextResponse.redirect(new URL("/crm/today", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (salesSession) {
    const allowed = pathname === "/crm/today" || pathname === "/crm/follow-ups" || pathname.startsWith("/crm/leads/") || pathname === "/crm/sessions" || pathname === "/api/state" || pathname.startsWith("/api/crm/sales-sessions");
    if (allowed) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.redirect(new URL("/crm/today", request.url));
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
