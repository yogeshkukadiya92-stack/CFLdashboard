import { Pool } from "pg";

let pool: Pool | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensurePersistenceTable() {
  const client = getPool();
  if (!client) return false;
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      leads JSONB NOT NULL DEFAULT '[]'::jsonb,
      workshops JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    INSERT INTO app_state (id, leads, workshops)
    VALUES (1, '[]'::jsonb, '[]'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);
  return true;
}

export async function getAppState() {
  const client = getPool();
  if (!client) return null;
  await ensurePersistenceTable();
  const result = await client.query("SELECT leads, workshops FROM app_state WHERE id = 1 LIMIT 1");
  if (!result.rows[0]) return { leads: [], workshops: [] };
  return result.rows[0];
}

export async function saveAppState(input: { leads: unknown[]; workshops: unknown[] }) {
  const client = getPool();
  if (!client) return false;
  await ensurePersistenceTable();
  await client.query(
    `UPDATE app_state SET leads = $1::jsonb, workshops = $2::jsonb, updated_at = NOW() WHERE id = 1`,
    [JSON.stringify(input.leads), JSON.stringify(input.workshops)]
  );
  return true;
}

