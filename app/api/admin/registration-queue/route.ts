import { getDbPool } from "@/lib/db";
import { ensureRegistrationJobs } from "@/lib/registration-jobs";
import { NextResponse } from "next/server";

// /api/admin is protected by the existing admin session middleware.
export async function GET() {
  const db = getDbPool();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  await ensureRegistrationJobs();
  const result = await db.query(`SELECT
    count(*) FILTER (WHERE completed_at IS NULL) AS pending,
    count(*) FILTER (WHERE completed_at IS NULL AND attempts > 0) AS retrying,
    count(*) FILTER (WHERE completed_at IS NOT NULL) AS completed,
    min(created_at) FILTER (WHERE completed_at IS NULL) AS oldest_pending_at
    FROM cfl_registration_jobs`);
  return NextResponse.json(result.rows[0], { headers: { "Cache-Control": "no-store" } });
}
