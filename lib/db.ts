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
      clients JSONB NOT NULL DEFAULT '[]'::jsonb,
      leads JSONB NOT NULL DEFAULT '[]'::jsonb,
      workshops JSONB NOT NULL DEFAULT '[]'::jsonb,
      integrations JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    ALTER TABLE app_state
    ADD COLUMN IF NOT EXISTS clients JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  await client.query(`
    ALTER TABLE app_state
    ADD COLUMN IF NOT EXISTS integrations JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);
  await client.query(`
    INSERT INTO app_state (id, clients, leads, workshops, integrations)
    VALUES (1, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);
  return true;
}

export async function getAppState() {
  const client = getPool();
  if (!client) return null;
  await ensurePersistenceTable();
  const result = await client.query("SELECT clients, leads, workshops, integrations FROM app_state WHERE id = 1 LIMIT 1");
  if (!result.rows[0]) return { clients: [], leads: [], workshops: [], integrations: {} };
  return result.rows[0];
}

export async function saveAppState(input: { clients?: unknown[]; integrations?: Record<string, unknown>; leads?: unknown[]; workshops?: unknown[] }) {
  const client = getPool();
  if (!client) return false;
  await ensurePersistenceTable();
  const current = await getAppState();
  await client.query(
    `UPDATE app_state SET clients = $1::jsonb, leads = $2::jsonb, workshops = $3::jsonb, integrations = $4::jsonb, updated_at = NOW() WHERE id = 1`,
    [
      JSON.stringify(input.clients ?? current?.clients ?? []),
      JSON.stringify(input.leads ?? current?.leads ?? []),
      JSON.stringify(input.workshops ?? current?.workshops ?? []),
      JSON.stringify(input.integrations ?? current?.integrations ?? {})
    ]
  );
  return true;
}
