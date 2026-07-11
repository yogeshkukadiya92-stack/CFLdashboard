import { getCrmSummary } from "@/lib/crm-db";
import { isDbEnabled } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false });
  try {
    return NextResponse.json({ dbEnabled: true, summary: await getCrmSummary() });
  } catch {
    return NextResponse.json({ dbEnabled: true, error: "Failed to load CRM summary." }, { status: 500 });
  }
}
