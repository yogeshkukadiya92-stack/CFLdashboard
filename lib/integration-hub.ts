import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { getDbPool } from "@/lib/db";

export type ApiScope = "customers:read" | "customers:write";
export type CustomerWebhookEvent = "customer.created" | "customer.updated";

const WEBHOOK_EVENTS: CustomerWebhookEvent[] = ["customer.created", "customer.updated"];
let schemaPromise: Promise<void> | null = null;

function requirePool() {
  const pool = getDbPool();
  if (!pool) throw new Error("Database is not configured.");
  return pool;
}

export async function ensureIntegrationHubSchema() {
  if (schemaPromise) return schemaPromise;
  const pool = requirePool();
  schemaPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS integration_api_keys (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL UNIQUE,
      key_hash TEXT NOT NULL UNIQUE,
      scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS integration_webhooks (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
      id UUID PRIMARY KEY,
      webhook_id UUID NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      response_status INTEGER,
      success BOOLEAN NOT NULL DEFAULT FALSE,
      error TEXT NOT NULL DEFAULT '',
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS integration_webhook_deliveries_webhook_idx
      ON integration_webhook_deliveries (webhook_id, delivered_at DESC);
  `).then(() => undefined).catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createApiKey(name: string, scopes: ApiScope[]) {
  await ensureIntegrationHubSchema();
  const pool = requirePool();
  const token = `cfl_live_${randomBytes(24).toString("base64url")}`;
  const prefix = token.slice(0, 17);
  const safeScopes = Array.from(new Set(scopes)).filter((scope): scope is ApiScope =>
    ["customers:read", "customers:write"].includes(scope)
  );
  const id = randomUUID();
  await pool.query(
    `INSERT INTO integration_api_keys (id, name, key_prefix, key_hash, scopes) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [id, name.trim(), prefix, hashKey(token), JSON.stringify(safeScopes)]
  );
  return { id, name: name.trim(), prefix, scopes: safeScopes, token };
}

export async function authenticateApiKey(request: Request, requiredScope: ApiScope) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : request.headers.get("x-api-key")?.trim() ?? "";
  if (!token.startsWith("cfl_live_")) return null;
  await ensureIntegrationHubSchema();
  const pool = requirePool();
  const result = await pool.query<{ id: string; name: string; scopes: ApiScope[] }>(
    `SELECT id, name, scopes FROM integration_api_keys WHERE key_hash = $1 AND revoked_at IS NULL LIMIT 1`,
    [hashKey(token)]
  );
  const key = result.rows[0];
  if (!key || !Array.isArray(key.scopes) || !key.scopes.includes(requiredScope)) return null;
  await pool.query(`UPDATE integration_api_keys SET last_used_at = NOW() WHERE id = $1`, [key.id]);
  return key;
}

export async function listIntegrationHub() {
  await ensureIntegrationHubSchema();
  const pool = requirePool();
  const [keys, webhooks, deliveries] = await Promise.all([
    pool.query(`SELECT id, name, key_prefix AS prefix, scopes, created_at AS "createdAt", last_used_at AS "lastUsedAt" FROM integration_api_keys WHERE revoked_at IS NULL ORDER BY created_at DESC`),
    pool.query(`SELECT id, name, url, events, enabled, created_at AS "createdAt" FROM integration_webhooks ORDER BY created_at DESC`),
    pool.query(`SELECT id, webhook_id AS "webhookId", event, response_status AS "responseStatus", success, error, delivered_at AS "deliveredAt" FROM integration_webhook_deliveries ORDER BY delivered_at DESC LIMIT 30`)
  ]);
  return { apiKeys: keys.rows, webhooks: webhooks.rows, deliveries: deliveries.rows };
}

export async function revokeApiKey(id: string) {
  await ensureIntegrationHubSchema();
  const result = await requirePool().query(`UPDATE integration_api_keys SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`, [id]);
  return Boolean(result.rowCount);
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

export function validateWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) return false;
    return !isPrivateHostname(url.hostname) || process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export async function createWebhook(name: string, url: string, events: CustomerWebhookEvent[]) {
  if (!validateWebhookUrl(url)) throw new Error("Use a valid public HTTPS webhook URL.");
  await ensureIntegrationHubSchema();
  const pool = requirePool();
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const safeEvents = Array.from(new Set(events)).filter((event): event is CustomerWebhookEvent => WEBHOOK_EVENTS.includes(event));
  const id = randomUUID();
  await pool.query(
    `INSERT INTO integration_webhooks (id, name, url, secret, events) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [id, name.trim(), url.trim(), secret, JSON.stringify(safeEvents)]
  );
  return { id, name: name.trim(), url: url.trim(), events: safeEvents, enabled: true, secret };
}

export async function deleteWebhook(id: string) {
  await ensureIntegrationHubSchema();
  const result = await requirePool().query(`DELETE FROM integration_webhooks WHERE id = $1`, [id]);
  return Boolean(result.rowCount);
}

async function deliverWebhook(webhook: { id: string; secret: string; url: string }, event: string, data: unknown) {
  const pool = requirePool();
  const deliveryId = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = JSON.stringify({ id: deliveryId, event, createdAt: new Date().toISOString(), data });
  const signature = createHmac("sha256", webhook.secret).update(`${timestamp}.${payload}`).digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let responseStatus: number | null = null;
  let success = false;
  let error = "";
  try {
    const response = await fetch(webhook.url, {
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CFL-Webhook/1.0",
        "X-CFL-Event": event,
        "X-CFL-Signature": `t=${timestamp},v1=${signature}`,
        "X-CFL-Webhook-Id": deliveryId
      },
      method: "POST",
      redirect: "error",
      signal: controller.signal
    });
    responseStatus = response.status;
    success = response.ok;
    if (!response.ok) error = `Endpoint returned HTTP ${response.status}`;
  } catch (caught) {
    error = caught instanceof Error ? caught.message.slice(0, 500) : "Webhook delivery failed.";
  } finally {
    clearTimeout(timeout);
  }
  await pool.query(
    `INSERT INTO integration_webhook_deliveries (id, webhook_id, event, response_status, success, error) VALUES ($1, $2, $3, $4, $5, $6)`,
    [deliveryId, webhook.id, event, responseStatus, success, error]
  );
  return { responseStatus, success };
}

export async function dispatchCustomerWebhook(event: CustomerWebhookEvent, customer: unknown) {
  if (!getDbPool()) return [];
  await ensureIntegrationHubSchema();
  const result = await requirePool().query<{ id: string; secret: string; url: string }>(
    `SELECT id, secret, url FROM integration_webhooks WHERE enabled = TRUE AND events ? $1`,
    [event]
  );
  return Promise.all(result.rows.map((webhook) => deliverWebhook(webhook, event, { customer })));
}

export async function testWebhook(id: string) {
  await ensureIntegrationHubSchema();
  const result = await requirePool().query<{ id: string; secret: string; url: string }>(
    `SELECT id, secret, url FROM integration_webhooks WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!result.rows[0]) throw new Error("Webhook not found.");
  return deliverWebhook(result.rows[0], "webhook.test", { message: "CFL webhook connection test" });
}
