import type { Pool, PoolClient, QueryResultRow } from "pg";
import { getDbPool } from "../db.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireTenantId(value: string) {
  if (!UUID_PATTERN.test(value)) throw new Error("A valid tenant id is required.");
  return value.toLowerCase();
}

export function requirePlatformPool(): Pool {
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  return pool;
}

export async function withTenantTransaction<T>(tenantId: string, operation: (client: PoolClient) => Promise<T>) {
  const normalizedTenantId = requireTenantId(tenantId);
  const client = await requirePlatformPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('callflow.tenant_id', $1, true)", [normalizedTenantId]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function queryTenantRows<Row extends QueryResultRow>(tenantId: string, sql: string, values: unknown[] = []) {
  return withTenantTransaction(tenantId, (client) => client.query<Row>(sql, values));
}
