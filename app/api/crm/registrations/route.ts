import { listCrmRegistrations, upsertLiveRegistration } from "@/lib/crm-db";
import { isDbEnabled } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false });
  const params = new URL(request.url).searchParams;
  try {
    const result = await listCrmRegistrations({
      cursor: params.get("cursor"),
      limit: Number(params.get("limit") || 25),
      query: params.get("query") ?? "",
      status: params.get("status") ?? "",
      workshopId: params.get("workshopId") ?? ""
    });
    return NextResponse.json({ dbEnabled: true, ...result });
  } catch {
    return NextResponse.json({ dbEnabled: true, error: "Failed to load registrations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid registration." }, { status: 400 });
  }
  try {
    await upsertLiveRegistration(body as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save registration." }, { status: 500 });
  }
}
