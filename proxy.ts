import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const publicPrefixes = [
  "/login",
  "/register",
  "/lp",
  "/attendance",
  "/attendance-team",
  "/response-view",
  "/api/auth",
  "/api/otp",
  "/api/public-registration-state",
  "/api/attendance-state",
  "/api/attendance-team",
  "/api/response-view",
  "/api/form-analytics",
  "/api/razorpay/order",
  "/api/webhooks/razorpay",
  "/_next",
  "/favicon.ico"
];

function isPublicPath(pathname: string) {
  return publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
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
