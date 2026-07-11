import { ensureCrmSchema } from "@/lib/crm-db";
import { getDbPool, isDbEnabled } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TENANT_ID = "cfl";

export async function GET(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false });
  await ensureCrmSchema();
  const pool = getDbPool();
  if (!pool) return NextResponse.json({ dbEnabled: false });

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") || 25)));
  const offset = (page - 1) * pageSize;
  const query = params.get("query")?.trim().toLowerCase() ?? "";
  const workshop = params.get("workshop")?.trim() ?? "";
  const fromDate = params.get("fromDate")?.trim() ?? "";
  const toDate = params.get("toDate")?.trim() ?? "";

  const values: unknown[] = [TENANT_ID];
  const conditions = ["registration.tenant_id = $1"];

  if (workshop && workshop !== "All Workshops") {
    values.push(workshop);
    conditions.push(`workshop.name = $${values.length}`);
  }
  if (fromDate) {
    values.push(fromDate);
    conditions.push(`registration.registered_at >= $${values.length}::date`);
  }
  if (toDate) {
    values.push(toDate);
    conditions.push(`registration.registered_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  if (query) {
    values.push(`%${query}%`);
    conditions.push(`(
      LOWER(client.name) LIKE $${values.length}
      OR client.mobile_normalized LIKE $${values.length}
      OR LOWER(COALESCE(client.city, '')) LIKE $${values.length}
    )`);
  }

  const whereClause = conditions.join(" AND ");
  values.push(pageSize, offset);
  const pageSizeParam = values.length - 1;
  const offsetParam = values.length;

  const [reportResult, workshopResult] = await Promise.all([
    pool.query<{
      city: string;
      client: string;
      last_registration: string;
      mobile: string;
      total: string;
      total_paid: string;
      workshops_attended: string;
    }>(`
      WITH client_milestones AS (
        SELECT
          client.id,
          client.name AS client,
          client.mobile,
          COALESCE(client.city, '') AS city,
          COUNT(registration.id)::INTEGER AS workshops_attended,
          COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS total_paid,
          MAX(registration.registered_at) AS last_registration
        FROM crm_registrations AS registration
        JOIN crm_clients AS client ON client.id = registration.client_id
        JOIN crm_workshop_masters AS workshop ON workshop.id = registration.workshop_id
        WHERE ${whereClause}
        GROUP BY client.id, client.name, client.mobile, client.city
      )
      SELECT
        client,
        mobile,
        city,
        workshops_attended,
        total_paid,
        last_registration,
        COUNT(*) OVER()::INTEGER AS total
      FROM client_milestones
      ORDER BY workshops_attended DESC, last_registration DESC, client ASC
      LIMIT $${pageSizeParam} OFFSET $${offsetParam}
    `, values),
    pool.query<{ name: string }>(`
      SELECT DISTINCT workshop.name
      FROM crm_registrations AS registration
      JOIN crm_workshop_masters AS workshop ON workshop.id = registration.workshop_id
      WHERE registration.tenant_id = $1
      ORDER BY workshop.name ASC
    `, [TENANT_ID])
  ]);

  return NextResponse.json({
    dbEnabled: true,
    rows: reportResult.rows.map((row) => ({
      client: row.client,
      mobile: row.mobile,
      city: row.city,
      workshopsAttended: Number(row.workshops_attended),
      totalPaid: Number(row.total_paid),
      lastRegistration: row.last_registration
        ? new Date(row.last_registration).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : ""
    })),
    total: Number(reportResult.rows[0]?.total ?? 0),
    workshopOptions: workshopResult.rows.map((row) => row.name)
  });
}
