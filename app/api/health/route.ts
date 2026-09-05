import { getDbPool } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = getDbPool();
    if (!db) throw new Error("Database unavailable");
    const ready = await db.query("SELECT 1 FROM cfl_registration_migrations WHERE version=1");
    if (!ready.rowCount) throw new Error("Registration storage is not ready");
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
