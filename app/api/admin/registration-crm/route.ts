import { NextResponse } from "next/server";
import { ensureRegistrationRecordsTable, getDbPool } from "@/lib/db";
import { recoverMissingCrmAssignments } from "@/lib/registration-crm-recovery";

export const runtime = "nodejs";

// Master admin authentication is enforced by proxy.ts.
export async function GET() {
  const db = getDbPool();
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  await ensureRegistrationRecordsTable();
  const result = await db.query(`SELECT r.external_id AS id,r.workshop_id,
    r.payload->>'fullName' AS name,r.payload->>'crmAssignmentStatus' AS status,
    r.payload->>'crmAssignmentReason' AS reason,
    r.payload->>'crmAssignmentCheckedAt' AS checked_at, count(*) OVER() AS total
    FROM cfl_registration_records r WHERE COALESCE(r.payload->>'crmAssignmentStatus','') <> 'assigned'
    AND EXISTS (SELECT 1 FROM app_state s,LATERAL jsonb_array_elements(s.workshops) w
      WHERE s.id=1 AND w->>'id'=r.workshop_id AND w->>'transferLeadToCrm'='true')
    ORDER BY r.created_at DESC LIMIT 100`);
  return NextResponse.json({ total: Number(result.rows[0]?.total || 0), alerts: result.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { workshopId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body.workshopId !== "string" || !body.workshopId.trim()) {
    return NextResponse.json({ error: "Select a workshop to recover" }, { status: 400 });
  }
  try {
    const summary = await recoverMissingCrmAssignments({ force: true, workshopId: body.workshopId });
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "CRM recovery failed; registrations remain available for retry." }, { status: 503 });
  }
}
