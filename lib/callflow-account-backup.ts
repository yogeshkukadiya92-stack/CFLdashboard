import "server-only";
import { getDbPool } from "./db.ts";
import type { CallFlowIdentity } from "./callflow-auth.ts";
import { validateBackupRecords } from "./callflow-backup-records.ts";

type BackupIdentity = CallFlowIdentity & { tenantId?: string };

let schemaReady: Promise<void> | undefined;
async function poolWithSchema() {
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_UNAVAILABLE");
  schemaReady ??= (async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('callflow_account_backup_schema',0))");
      await client.query(`CREATE TABLE IF NOT EXISTS callflow_account_backup_records (
    account_scope text NOT NULL, user_id text NOT NULL, table_name text NOT NULL, record_id text NOT NULL,
    row_data jsonb NOT NULL, client_updated_at bigint NOT NULL, revision bigserial NOT NULL,
    saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (account_scope,user_id,table_name,record_id)
  ); CREATE INDEX IF NOT EXISTS callflow_account_backup_cursor ON callflow_account_backup_records(account_scope,user_id,revision)`);
      await client.query("COMMIT");
    } catch(error) { await client.query("ROLLBACK").catch(() => undefined); schemaReady = undefined; throw error; }
    finally { client.release(); }
  })();
  await schemaReady;
  return pool;
}
const scope = (identity: BackupIdentity) => identity.tenantId || "legacy";

export async function writeAccountBackup(identity: BackupIdentity, records: unknown) {
  const rows = validateBackupRecords(records);
  const pool = await poolWithSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [scope(identity) + ":" + identity.userId]);
    for (const row of rows) {
      await client.query(`INSERT INTO callflow_account_backup_records(account_scope,user_id,table_name,record_id,row_data,client_updated_at)
        VALUES($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT(account_scope,user_id,table_name,record_id) DO UPDATE SET
        row_data=EXCLUDED.row_data,client_updated_at=EXCLUDED.client_updated_at,
        revision=nextval(pg_get_serial_sequence('callflow_account_backup_records','revision')),saved_at=clock_timestamp()
        WHERE EXCLUDED.client_updated_at >= callflow_account_backup_records.client_updated_at AND EXCLUDED.row_data IS DISTINCT FROM callflow_account_backup_records.row_data`,
      [scope(identity),identity.userId,row.table,row.id,JSON.stringify(row.row),row.updatedAt]);
    }
    await client.query("COMMIT");
    return { accepted: rows.map(row => `${row.table}:${row.id}`), savedAt: new Date().toISOString() };
  } catch(error) {
    await client.query("ROLLBACK").catch(() => undefined); throw error;
  } finally { client.release(); }
}

export async function readAccountBackup(identity: BackupIdentity, cursor: string | null) {
  const after = cursor || "0";
  if (!/^\d{1,20}$/.test(after)) throw new Error("INVALID_BACKUP_CURSOR");
  const pool = await poolWithSchema();
  const client = await pool.connect();
  try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [scope(identity) + ":" + identity.userId]);
  const result = await client.query(`SELECT table_name,record_id,row_data,client_updated_at,revision FROM callflow_account_backup_records
    WHERE account_scope=$1 AND user_id=$2 AND revision>$3::bigint ORDER BY revision LIMIT 501`,[scope(identity),identity.userId,after]);
  await client.query("COMMIT");
  const rows = result.rows.slice(0,500);
  return { schemaVersion:9, records:rows.map(row => ({table:row.table_name,id:row.record_id,row:row.row_data,updatedAt:Number(row.client_updated_at)})),
    cursor:rows.length?String(rows.at(-1)?.revision):after, hasMore:result.rows.length>500 };
  } catch(error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}
