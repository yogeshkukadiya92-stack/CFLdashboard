import { Pool } from "pg";
import { z } from "zod/v4";

export const mcpDatasets = {
  workshops: { view: "cfl_mcp.workshops", columns: ["id", "name", "workshop_type", "product_group", "archived"], description: "CRM workshop catalogue; no client, health or payment records." },
  summary: { view: "cfl_mcp.summary", columns: ["id", "client_count", "workshop_count", "registration_count"], description: "Aggregate counts only; no personally identifying records." }
} as const;

export const mcpBrowseSchema = z.object({
  dataset: z.enum(["workshops", "summary"]),
  after_id: z.string().regex(/^\d{1,18}$/).default("0"),
  limit: z.number().int().min(1).max(50).default(25),
  query: z.string().trim().max(100).default("")
}).strict();

export function buildMcpQuery(input: unknown) {
  const args = mcpBrowseSchema.parse(input);
  const dataset = mcpDatasets[args.dataset];
  const values: unknown[] = [args.after_id];
  let filter = "id > $1::bigint";
  if (args.query) {
    if (args.dataset !== "workshops") throw new Error("Search is supported only for workshops");
    values.push(`%${args.query.replace(/[\\%_]/g, "\\$&")}%`);
    filter += " AND name ILIKE $2";
  }
  values.push(args.limit + 1);
  return { sql: `SELECT ${dataset.columns.join(", ")} FROM ${dataset.view} WHERE ${filter} ORDER BY id ASC LIMIT $${values.length}`, values, limit: args.limit };
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
