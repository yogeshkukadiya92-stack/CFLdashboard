import { Pool } from "pg";
import { z } from "zod/v4";

const recordColumns = ["id", "name", "mobile", "email", "city", "workshop_id", "workshop_name", "batch", "status", "recorded_at"] as const;
export const mcpDatasets = {
  workshops: { view: "cfl_mcp.workshops", columns: ["id", "name", "workshop_type", "product_group", "archived"], description: "CRM workshop catalogue." },
  summary: { view: "cfl_mcp.summary", columns: ["id", "client_count", "workshop_count", "registration_count"], description: "CRM aggregate counts; live registration totals are separate." },
  registrations: { view: "cfl_mcp.registrations", columns: [...recordColumns, "registration_number", "payment_mode", "amount_paid", "amount_due", "confirmation_status", "waiting_reason", "attendance_matched", "source"], description: "Live registrations, contact details, waiting/confirmation and payment balances. All pages are available." },
  crm_registrations: { view: "cfl_mcp.crm_registrations", columns: [...recordColumns, "external_id", "client_id", "payment_mode", "amount_paid", "amount_due", "salesperson", "is_legacy"], description: "Normalized CRM registrations including imported history. May overlap live registrations; do not sum both." },
  attendance: { view: "cfl_mcp.attendance", columns: [...recordColumns, "session_id", "session_title", "session_date", "check_in_at", "joined_zoom_at", "left_zoom_at", "duration_minutes", "source"], description: "All attendance entries, contacts, session details and duration." },
  payments: { view: "cfl_mcp.payments", columns: ["id", "name", "mobile", "email", "workshop_id", "workshop_name", "registration_id", "payment_id", "event_name", "status", "amount", "currency", "method", "applied_at", "recorded_at"], description: "All gateway payment events. Multiple events may refer to one payment; do not sum events as receipts. Manual payments and balances are in registrations and crm_registrations." }
} as const;

export const mcpBrowseSchema = z.object({
  dataset: z.enum(["workshops", "summary", "registrations", "crm_registrations", "attendance", "payments"]),
  after_id: z.string().max(300).default(""),
  limit: z.number().int().min(1).max(50).default(25),
  query: z.string().trim().max(100).default(""),
  workshop_id: z.string().trim().max(200).optional(),
  status: z.string().trim().max(80).optional(),
  date_from: z.iso.date().optional(),
  date_to: z.iso.date().optional()
}).strict();

export function buildMcpQuery(input: unknown) {
  const args = mcpBrowseSchema.parse(input);
  const dataset = mcpDatasets[args.dataset];
  const numericId = ["workshops", "summary", "crm_registrations"].includes(args.dataset);
  if (numericId && args.after_id && !/^\d{1,18}$/.test(args.after_id)) throw new Error("Invalid numeric cursor");
  if (args.date_from && args.date_to && args.date_from > args.date_to) throw new Error("Invalid date range");
  const values: unknown[] = [args.after_id || (numericId ? "0" : "")];
  let filter = numericId ? "id > $1::bigint" : 'id COLLATE "C" > $1::text COLLATE "C"';
  const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (args.query) {
    if (args.dataset === "summary") throw new Error("Summary does not support search");
    const term = bind(`%${args.query.replace(/[\\%_]/g, "\\$&")}%`);
    const columns = args.dataset === "workshops" ? ["name"] : ["name", "mobile", "email", "workshop_name", "id::text"];
    filter += ` AND (${columns.map(column => `${column} ILIKE ${term}`).join(" OR ")})`;
  }
  const detailed = !["workshops", "summary"].includes(args.dataset);
  for (const [key, value] of [["workshop_id", args.workshop_id], ["status", args.status]] as const) {
    if (value !== undefined) {
      if (!detailed) throw new Error("Filter is unavailable for this dataset");
      filter += ` AND ${key}::text = ${bind(value)}`;
    }
  }
  for (const [value, operator] of [[args.date_from, ">="], [args.date_to, "<="]] as const) {
    if (value !== undefined) {
      if (!detailed) throw new Error("Date filter is unavailable for this dataset");
      filter += ` AND LEFT(recorded_at, 10) ${operator} ${bind(value)}`;
    }
  }
  const order = numericId ? "id ASC" : 'id COLLATE "C" ASC';
  const rowLimit = bind(args.limit + 1);
  return { sql: `SELECT ${dataset.columns.join(", ")} FROM ${dataset.view} WHERE ${filter} ORDER BY ${order} LIMIT ${rowLimit}`, values, limit: args.limit };
}

let pool: Pool | undefined;
export async function browseMcpData(input: unknown) {
  const query = buildMcpQuery(input);
  // Deliberately never fall back to the application's privileged DATABASE_URL.
  if (!process.env.MCP_DATABASE_URL) throw new Error("MCP database is not configured");
  if (!pool) {
    pool = new Pool({ connectionString: process.env.MCP_DATABASE_URL, max: 1,
      connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, query_timeout: 6000,
      application_name: "cfl-mcp-readonly" });
    pool.on("error", () => console.error("MCP idle database connection failed"));
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    const role = await client.query("SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls AS privileged FROM pg_roles WHERE rolname = current_user");
    if (role.rows.length !== 1 || role.rows[0].privileged) throw new Error("A least-privilege role is required");
    const result = await client.query(query.sql, query.values);
    await client.query("COMMIT");
    const rows = result.rows.slice(0, query.limit);
    const hasMore = result.rows.length > query.limit;
    return { rows, has_more: hasMore, next_cursor: hasMore ? String(rows.at(-1)?.id) : null };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
