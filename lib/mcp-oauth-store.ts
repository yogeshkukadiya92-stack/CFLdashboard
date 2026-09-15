import { Pool, type PoolClient } from "pg";

export type Authorization = { consentId: string; codeHash: string; grantId: string; clientId: string; clientStamp: string; adminStamp: string; redirectUri: string; resource: string; challenge: string };
export type Exchange = { kind: "code" | "refresh"; hash: string; clientId: string; clientStamp: string; adminStamp: string; resource: string; redirectUri?: string; challenge?: string; accessHash: string; refreshHash: string };
export interface OAuthStore {
  authorize(value: Authorization): Promise<void>;
  exchange(value: Exchange): Promise<boolean>;
  access(hash: string, resource: string, adminStamp: string): Promise<{ clientId: string; clientStamp: string } | null>;
  revokeToken(hash: string, clientId: string): Promise<void>;
  connections(adminStamp: string): Promise<Record<string, unknown>[]>;
  revokeGrant(id: string, adminStamp: string): Promise<void>;
}

let pool: Pool | undefined;
function db() {
  if (!process.env.DATABASE_URL) throw new Error("OAuth persistence unavailable");
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000,
      query_timeout: 6000, idleTimeoutMillis: 30000, application_name: "cfl-mcp-oauth" });
    pool.on("error", () => console.error("OAuth persistence connection failed"));
  }
  return pool;
}

async function transaction<T>(run: (client: PoolClient) => Promise<T>, database: () => Pick<Pool, "query" | "connect"> = db) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    const value = await run(client);
    await client.query("COMMIT");
    return value;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}

export function createPostgresOAuthStore(database: () => Pick<Pool, "query" | "connect"> = db): OAuthStore {
return {
  async authorize(value) {
    await transaction(async client => {
      // Unique consent ID makes approval replay fail across workers/replicas.
      await client.query("INSERT INTO cfl_oauth.grants (id, consent_id, client_id, client_stamp, admin_stamp, resource) VALUES ($1,$2,$3,$4,$5,$6)",
        [value.grantId, value.consentId, value.clientId, value.clientStamp, value.adminStamp, value.resource]);
      await client.query("INSERT INTO cfl_oauth.codes (hash, grant_id, redirect_uri, challenge, expires_at) VALUES ($1,$2,$3,$4,now() + interval '2 minutes')",
        [value.codeHash, value.grantId, value.redirectUri, value.challenge]);
    }, database);
  },
  async exchange(value) {
    return transaction(async client => {
      const table = value.kind === "code" ? "codes" : "tokens";
      const result = await client.query(`SELECT item.*, g.client_id, g.client_stamp, g.admin_stamp, g.resource, g.revoked_at, g.expires_at AS grant_expiry,
        item.expires_at > now() AND g.expires_at > now() AS live FROM cfl_oauth.${table} item
        JOIN cfl_oauth.grants g ON g.id = item.grant_id WHERE item.hash = $1 FOR UPDATE OF item, g`, [value.hash]);
      const row = result.rows[0];
      if (!row || row.client_id !== value.clientId || row.client_stamp !== value.clientStamp || row.admin_stamp !== value.adminStamp || row.resource !== value.resource || row.revoked_at) return false;
      if (value.kind === "code" && (row.redirect_uri !== value.redirectUri || row.challenge !== value.challenge)) return false;
      if (value.kind === "refresh" && row.kind !== "refresh") return false;
      if (row.consumed_at) {
        // Reuse of a redeemed code or refresh token revokes its whole grant.
        await client.query("UPDATE cfl_oauth.grants SET revoked_at = now() WHERE id = $1", [row.grant_id]);
        return false;
      }
      if (!row.live) return false;
      await client.query(`UPDATE cfl_oauth.${table} SET consumed_at = now() WHERE hash = $1`, [value.hash]);
      await client.query("INSERT INTO cfl_oauth.tokens (hash, grant_id, kind, expires_at) VALUES ($1,$3,'access', LEAST(now() + interval '15 minutes', $4::timestamptz)), ($2,$3,'refresh',$4::timestamptz)",
        [value.accessHash, value.refreshHash, row.grant_id, row.grant_expiry]);
      return true;
    }, database);
  },
  async access(hash, resource, adminStamp) {
    const result = await database().query(`SELECT g.client_id, g.client_stamp FROM cfl_oauth.tokens t JOIN cfl_oauth.grants g ON g.id = t.grant_id
      WHERE t.hash = $1 AND t.kind = 'access' AND t.expires_at > now() AND g.expires_at > now()
      AND g.revoked_at IS NULL AND g.resource = $2 AND g.admin_stamp = $3`, [hash, resource, adminStamp]);
    return result.rows[0] ? { clientId: result.rows[0].client_id, clientStamp: result.rows[0].client_stamp } : null;
  },
  async revokeToken(hash, clientId) {
    await database().query("UPDATE cfl_oauth.grants SET revoked_at = now() WHERE client_id = $2 AND id IN (SELECT grant_id FROM cfl_oauth.tokens WHERE hash = $1)", [hash, clientId]);
  },
  async connections(adminStamp) {
    const result = await database().query("SELECT id, client_id, created_at, expires_at FROM cfl_oauth.grants WHERE admin_stamp = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 100", [adminStamp]);
    return result.rows;
  },
  async revokeGrant(id, adminStamp) {
    await database().query("UPDATE cfl_oauth.grants SET revoked_at = now() WHERE id = $1 AND admin_stamp = $2", [id, adminStamp]);
  }
};
}
export const postgresOAuthStore = createPostgresOAuthStore();
