import { ensureCrmSchema } from "@/lib/crm-db";
import { getDbPool, isDbEnabled } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TENANT_ID = "cfl";
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(value: string | Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(value: string | Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function rowConditions(params: URLSearchParams) {
  const values: unknown[] = [TENANT_ID];
  const conditions = ["registration.tenant_id = $1"];
  const workshop = params.get("workshop")?.trim() ?? "";
  const fromDate = params.get("fromDate")?.trim() ?? "";
  const toDate = params.get("toDate")?.trim() ?? "";
  const query = params.get("query")?.trim().toLowerCase() ?? "";

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
      OR LOWER(COALESCE(client.email, '')) LIKE $${values.length}
      OR LOWER(COALESCE(client.city, '')) LIKE $${values.length}
      OR LOWER(workshop.name) LIKE $${values.length}
      OR LOWER(batch.source_workshop_name) LIKE $${values.length}
      OR LOWER(facilitator.name) LIKE $${values.length}
    )`);
  }

  return { conditions, values };
}

function addPagination(values: unknown[], params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") || 25)));
  values.push(pageSize, (page - 1) * pageSize);
  return { limitParam: values.length - 1, offsetParam: values.length };
}

async function workshopOptions(pool: NonNullable<ReturnType<typeof getDbPool>>) {
  const result = await pool.query<{ name: string }>(`
    SELECT DISTINCT workshop.name
    FROM crm_registrations AS registration
    JOIN crm_workshop_masters AS workshop ON workshop.id = registration.workshop_id
    WHERE registration.tenant_id = $1
    ORDER BY workshop.name ASC
  `, [TENANT_ID]);
  return result.rows.map((row) => row.name);
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false });
  await ensureCrmSchema();
  const pool = getDbPool();
  if (!pool) return NextResponse.json({ dbEnabled: false });

  const { slug } = await context.params;
  const params = new URL(request.url).searchParams;
  const optionsPromise = workshopOptions(pool);

  const baseFrom = `
    FROM crm_registrations AS registration
    JOIN crm_clients AS client ON client.id = registration.client_id
    JOIN crm_workshop_masters AS workshop ON workshop.id = registration.workshop_id
    JOIN crm_workshop_batches AS batch ON batch.id = registration.workshop_batch_id
    JOIN crm_facilitators AS facilitator ON facilitator.id = batch.facilitator_id
  `;
  const { conditions, values } = rowConditions(params);
  const whereClause = conditions.join(" AND ");
  const { limitParam, offsetParam } = addPagination(values, params);

  try {
    if (slug === "daily-report") {
      if (!params.get("fromDate")) {
        conditions.push(`registration.registered_at >= CURRENT_DATE`);
      }
      const result = await pool.query(`
        SELECT
          ROW_NUMBER() OVER (ORDER BY registration.registered_at DESC)::INTEGER AS sr,
          client.name AS client,
          client.mobile,
          workshop.name AS workshop,
          batch.source_workshop_name AS batch,
          COALESCE(registration.payment_mode, registration.status) AS payment,
          registration.amount_paid AS amount,
          registration.registered_at AS time,
          COUNT(*) OVER()::INTEGER AS total
        ${baseFrom}
        WHERE ${conditions.join(" AND ")}
        ORDER BY registration.registered_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, values);
      return NextResponse.json({
        dbEnabled: true,
        rows: result.rows.map((row) => ({ ...row, amount: toNumber(row.amount), time: fmtTime(row.time) })),
        total: Number(result.rows[0]?.total ?? 0),
        workshopOptions: await optionsPromise
      });
    }

    if (slug === "workshop-url-status") {
      const result = await pool.query(`
        SELECT
          workshop.name AS workshop,
          'Workshop' AS type,
          COALESCE(facilitator.name, '-') AS facilitator,
          CASE WHEN COALESCE(SUM(registration.amount_paid), 0) > 0 THEN 'Paid' ELSE 'Free' END AS "paidFree",
          COUNT(registration.id)::INTEGER AS "regCount",
          CASE WHEN COUNT(registration.id) > 0 THEN 'Active' ELSE 'Inactive' END AS status,
          COUNT(*) OVER()::INTEGER AS total
        ${baseFrom}
        WHERE ${whereClause}
        GROUP BY workshop.name, facilitator.name
        ORDER BY COUNT(registration.id) DESC, workshop.name ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, values);
      return NextResponse.json({ dbEnabled: true, rows: result.rows, total: Number(result.rows[0]?.total ?? 0), workshopOptions: await optionsPromise });
    }

    if (slug === "yearly-public-session") {
      const year = params.get("fromDate") ? new Date(params.get("fromDate") || "").getFullYear() : new Date().getFullYear();
      const result = await pool.query<{ month_index: number; workshop_count: string; total_regs: string; total_revenue: string }>(`
        SELECT
          EXTRACT(MONTH FROM registration.registered_at)::INTEGER - 1 AS month_index,
          COUNT(DISTINCT workshop.id)::INTEGER AS workshop_count,
          COUNT(registration.id)::INTEGER AS total_regs,
          COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS total_revenue
        ${baseFrom}
        WHERE registration.tenant_id = $1 AND EXTRACT(YEAR FROM registration.registered_at)::INTEGER = $2
        GROUP BY month_index
      `, [TENANT_ID, year]);
      const byMonth = new Map(result.rows.map((row) => [row.month_index, row]));
      const rows = Array.from({ length: 12 }, (_, month) => {
        const row = byMonth.get(month);
        const workshopCount = Number(row?.workshop_count ?? 0);
        const totalRegs = Number(row?.total_regs ?? 0);
        return {
          month: `${MONTH_NAMES[month]} ${year}`,
          workshopCount,
          totalRegs,
          totalRevenue: toNumber(row?.total_revenue),
          avgPerWorkshop: workshopCount ? Math.round(totalRegs / workshopCount) : 0
        };
      });
      return NextResponse.json({ dbEnabled: true, rows, total: rows.length, workshopOptions: await optionsPromise });
    }

    if (slug === "yearly-workshop") {
      const year = params.get("fromDate") ? new Date(params.get("fromDate") || "").getFullYear() : new Date().getFullYear();
      const result = await pool.query(`
        SELECT
          EXTRACT(MONTH FROM registration.registered_at)::INTEGER - 1 AS month_index,
          workshop.name AS workshop,
          facilitator.name AS facilitator,
          COUNT(registration.id)::INTEGER AS registrations,
          COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS revenue,
          'Active' AS status,
          COUNT(*) OVER()::INTEGER AS total
        ${baseFrom}
        WHERE registration.tenant_id = $1 AND EXTRACT(YEAR FROM registration.registered_at)::INTEGER = $2
        GROUP BY month_index, workshop.name, facilitator.name
        ORDER BY month_index DESC, registrations DESC
        LIMIT $3 OFFSET $4
      `, [TENANT_ID, year, values[limitParam - 1], values[offsetParam - 1]]);
      return NextResponse.json({
        dbEnabled: true,
        rows: result.rows.map((row) => ({ ...row, month: `${MONTH_NAMES[row.month_index]} ${year}`, revenue: toNumber(row.revenue) })),
        total: Number(result.rows[0]?.total ?? 0),
        workshopOptions: await optionsPromise
      });
    }

    if (slug === "facilitators-performance") {
      const result = await pool.query(`
        SELECT
          facilitator.name AS facilitator,
          COUNT(DISTINCT workshop.id)::INTEGER AS workshops,
          COUNT(registration.id)::INTEGER AS "totalRegs",
          COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS revenue,
          CASE WHEN COUNT(DISTINCT workshop.id) > 0 THEN ROUND(COUNT(registration.id)::NUMERIC / COUNT(DISTINCT workshop.id))::INTEGER ELSE 0 END AS "avgPerWorkshop",
          COUNT(*) OVER()::INTEGER AS total
        ${baseFrom}
        WHERE ${whereClause}
        GROUP BY facilitator.name
        ORDER BY COUNT(registration.id) DESC, facilitator.name ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, values);
      return NextResponse.json({
        dbEnabled: true,
        rows: result.rows.map((row) => ({ ...row, revenue: toNumber(row.revenue) })),
        total: Number(result.rows[0]?.total ?? 0),
        workshopOptions: await optionsPromise
      });
    }

    if (slug === "workshop-summary") {
      const result = await pool.query(`
        SELECT
          workshop.name AS workshop,
          facilitator.name AS facilitator,
          'Workshop' AS type,
          COUNT(registration.id)::INTEGER AS registrations,
          COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS paid,
          COALESCE(SUM(registration.amount_due), 0)::NUMERIC(12, 2) AS due,
          COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS revenue,
          COUNT(*) FILTER (WHERE registration.payment_mode = 'Part' OR (registration.amount_paid > 0 AND registration.amount_due > 0))::INTEGER AS "partCount",
          COUNT(*) OVER()::INTEGER AS total
        ${baseFrom}
        WHERE ${whereClause}
        GROUP BY workshop.name, facilitator.name
        ORDER BY COUNT(registration.id) DESC, workshop.name ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, values);
      return NextResponse.json({
        dbEnabled: true,
        rows: result.rows.map((row) => ({ ...row, paid: toNumber(row.paid), due: toNumber(row.due), revenue: toNumber(row.revenue) })),
        total: Number(result.rows[0]?.total ?? 0),
        workshopOptions: await optionsPromise
      });
    }

    if (slug === "batch-wise-workshop-summary") {
      const result = await pool.query(`
        SELECT
          workshop.name AS workshop,
          batch.source_workshop_name AS batch,
          COUNT(registration.id)::INTEGER AS registrations,
          COUNT(*) FILTER (WHERE registration.status IN ('Success', 'Paid'))::INTEGER AS "paidCount",
          COUNT(*) FILTER (WHERE registration.status IN ('Failed', 'Due'))::INTEGER AS "dueCount",
          COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS revenue,
          COUNT(*) OVER()::INTEGER AS total
        ${baseFrom}
        WHERE ${whereClause}
        GROUP BY workshop.name, batch.source_workshop_name
        ORDER BY COUNT(registration.id) DESC, workshop.name ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, values);
      return NextResponse.json({
        dbEnabled: true,
        rows: result.rows.map((row) => ({ ...row, revenue: toNumber(row.revenue) })),
        total: Number(result.rows[0]?.total ?? 0),
        workshopOptions: await optionsPromise
      });
    }

    if (slug === "client-milestone") {
      const result = await pool.query(`
        WITH client_milestones AS (
          SELECT
            client.id,
            client.name AS client,
            client.mobile,
            COALESCE(client.city, '') AS city,
            COUNT(registration.id)::INTEGER AS "workshopsAttended",
            COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS "totalPaid",
            MAX(registration.registered_at) AS "lastRegistrationRaw"
          ${baseFrom}
          WHERE ${whereClause}
          GROUP BY client.id, client.name, client.mobile, client.city
        )
        SELECT *, COUNT(*) OVER()::INTEGER AS total
        FROM client_milestones
        ORDER BY "workshopsAttended" DESC, "lastRegistrationRaw" DESC, client ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, values);
      return NextResponse.json({
        dbEnabled: true,
        rows: result.rows.map((row) => ({ ...row, totalPaid: toNumber(row.totalPaid), lastRegistration: fmtDate(row.lastRegistrationRaw) })),
        total: Number(result.rows[0]?.total ?? 0),
        workshopOptions: await optionsPromise
      });
    }

    if (slug === "member-attend-more-workshop") {
      const result = await pool.query(`
        WITH attended AS (
          SELECT
            client.id,
            client.name AS client,
            client.mobile,
            COUNT(DISTINCT workshop.id)::INTEGER AS "workshopCount",
            STRING_AGG(DISTINCT workshop.name, ', ' ORDER BY workshop.name) AS "workshopsList",
            COALESCE(SUM(registration.amount_paid), 0)::NUMERIC(12, 2) AS "totalPaid"
          ${baseFrom}
          WHERE ${whereClause}
          GROUP BY client.id, client.name, client.mobile
          HAVING COUNT(DISTINCT workshop.id) >= 2
        )
        SELECT *, COUNT(*) OVER()::INTEGER AS total
        FROM attended
        ORDER BY "workshopCount" DESC, client ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, values);
      return NextResponse.json({
        dbEnabled: true,
        rows: result.rows.map((row) => ({ ...row, totalPaid: toNumber(row.totalPaid) })),
        total: Number(result.rows[0]?.total ?? 0),
        workshopOptions: await optionsPromise
      });
    }

    const listFilters: Record<string, string> = {
      "failed-payment": `AND (registration.status IN ('Failed', 'Due') OR registration.amount_due > 0)`,
      "part-payment": `AND (registration.payment_mode = 'Part' OR (registration.amount_paid > 0 AND registration.amount_due > 0))`,
      "member-details-part-payment": `AND (registration.payment_mode = 'Part' OR (registration.amount_paid > 0 AND registration.amount_due > 0))`
    };
    if (["failed-payment", "part-payment", "workshop-wise-member", "member-details", "member-details-part-payment"].includes(slug)) {
      const result = await pool.query(`
        SELECT
          (ROW_NUMBER() OVER (ORDER BY registration.registered_at DESC) + $${offsetParam})::INTEGER AS sr,
          client.name AS client,
          client.mobile,
          COALESCE(client.email, '') AS email,
          COALESCE(client.city, '') AS city,
          workshop.name AS workshop,
          batch.source_workshop_name AS batch,
          COALESCE(registration.payment_mode, registration.status, '-') AS "paymentMode",
          registration.status,
          registration.amount_paid AS paid,
          registration.amount_paid AS amount,
          registration.amount_due AS due,
          registration.amount_due AS "amountDue",
          registration.registered_at AS date,
          COUNT(*) OVER()::INTEGER AS total
        ${baseFrom}
        WHERE ${whereClause} ${listFilters[slug] ?? ""}
        ORDER BY registration.registered_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      `, values);
      const rows = result.rows.map((row) => {
        const paid = toNumber(row.paid);
        const due = toNumber(row.due);
        const total = paid + due;
        return {
          ...row,
          paid,
          due,
          amount: toNumber(row.amount),
          amountDue: toNumber(row.amountDue),
          balancePct: total > 0 ? `${Math.round((due / total) * 100)}%` : "0%",
          date: fmtDate(row.date)
        };
      });
      return NextResponse.json({ dbEnabled: true, rows, total: Number(result.rows[0]?.total ?? 0), workshopOptions: await optionsPromise });
    }

    return NextResponse.json({ dbEnabled: true, rows: [], total: 0, workshopOptions: await optionsPromise });
  } catch (error) {
    return NextResponse.json({ dbEnabled: true, error: "Failed to load report data." }, { status: 500 });
  }
}
