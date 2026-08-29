import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { listMfwWorkshops } from "@/lib/mfw-registration";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ workshops: await listMfwWorkshops() });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not load MFW workshops."
    }, { status: 502 });
  }
}
