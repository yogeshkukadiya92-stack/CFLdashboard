import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const directory = path.join(process.cwd(), "database", "migrations");
const files = (await readdir(directory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
  application_name: "callflow-migrations"
});

const client = await pool.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS callflow_schema_migrations (
    filename text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query("SELECT pg_advisory_lock(hashtext('callflow_schema_migrations'))");
  for (const filename of files) {
    const sql = await readFile(path.join(directory, filename), "utf8");
    const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sql));
    const checksumHex = Buffer.from(checksum).toString("hex");
    const existing = await client.query("SELECT checksum FROM callflow_schema_migrations WHERE filename = $1", [filename]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksumHex) throw new Error(`Applied migration changed: ${filename}`);
      console.log(`already applied ${filename}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO callflow_schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksumHex]);
      await client.query("COMMIT");
      console.log(`applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtext('callflow_schema_migrations'))").catch(() => undefined);
  client.release();
  await pool.end();
}
