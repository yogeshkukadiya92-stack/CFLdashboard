import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDbPool } from "./db";
let ready: Promise<void> | undefined;
export function ensureRegistrationHotPath() {
  ready ??= migrate().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function migrate() {
  const db = getDbPool();
  if (!db) throw new Error("Database not configured");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(73184, 2)");
    await client.query("CREATE TABLE IF NOT EXISTS cfl_registration_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const applied = await client.query("SELECT 1 FROM cfl_registration_migrations WHERE version=1");
    if (!applied.rowCount) {
      await client.query(await readFile(join(process.cwd(), "database/registration_hot_path.sql"), "utf8"));
      await client.query("INSERT INTO cfl_registration_migrations(version) VALUES(1)");
    }
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK").catch(()=>undefined); throw error; }
  finally { client.release(); }
}
