import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createCallFlowToken, type CallFlowIdentity } from "./callflow-auth.ts";
import { verifyPassword } from "./owner-crypto.ts";
import { requirePlatformPool } from "./platform/database.ts";

const ACCESS_SECONDS = 15 * 60;
const SESSION_DAYS = 30;
const OFFLINE_HOURS = 72;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export type MobileDeviceInput = { installId: string; deviceName?: string; appVersion?: string };
export type CentralTokenResponse = { accessToken: string; refreshToken: string; expiresAt: string; offlineValidUntil: string; employeeName: string; mobile: string | null; accountId: string; deviceId: string; status: "ACTIVE" };

export async function centralAccountSchemaAvailable() {
  try {
    const result = await requirePlatformPool().query<{ ready: boolean }>(
      "SELECT to_regclass('public.callflow_users') IS NOT NULL AND to_regclass('public.callflow_user_sessions') IS NOT NULL AS ready",
    );
    return result.rows[0]?.ready === true;
  } catch { return false; }
}

function normalizeDevice(input: MobileDeviceInput) {
  const installId = input.installId?.trim();
  if (!installId || installId.length > 200) throw new Error("A valid app installation id is required.");
  return { installId, deviceName: input.deviceName?.trim().slice(0, 200) || null, appVersion: input.appVersion?.trim().slice(0, 40) || null };
}

export async function loginCentralAccount(identityValue: string, password: string, deviceInput: MobileDeviceInput, verifiedSupabaseId?: string): Promise<CentralTokenResponse | null> {
  const identity = identityValue.trim().toLowerCase();
  const mobile = identity.includes("@") ? "" : identity.replace(/\D/g, "").slice(-10);
  const client = await requirePlatformPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('callflow.owner_admin', 'true', true)");
    const account = await client.query<{ company_status: string; display_name: string; email_normalized: string | null; mobile_normalized: string | null; password_hash: string | null; supabase_user_id: string | null; role: string; status: string; tenant_id: string; user_id: string }>(`
      SELECT users.id AS user_id, users.display_name, users.email_normalized, users.mobile_normalized,
        users.password_hash, users.supabase_user_id, users.status, membership.tenant_id, membership.role, company.status AS company_status
      FROM callflow_users users
      JOIN callflow_memberships membership ON membership.user_id = users.id AND membership.status = 'active'
      JOIN callflow_companies company ON company.id = membership.tenant_id
      WHERE (users.email_normalized = $1 OR ($2 <> '' AND right(users.mobile_normalized, 10) = $2))
      ORDER BY membership.created_at DESC LIMIT 1 FOR UPDATE OF users
    `, [identity, mobile]);
    const row = account.rows[0];
    if (!row) { await client.query("ROLLBACK"); return null; }
    if (row.role !== "salesperson" || row.status !== "active" || row.company_status !== "active" || (row.supabase_user_id ? row.supabase_user_id !== verifiedSupabaseId : !row.password_hash || !verifyPassword(password, row.password_hash))) throw new Error("INVALID_CREDENTIALS");
    const device = normalizeDevice(deviceInput);
    await client.query(`UPDATE callflow_user_sessions SET revoked_at = NOW(), revoke_reason = 'signed_in_on_another_phone' WHERE user_id = $1 AND revoked_at IS NULL`, [row.user_id]);
    const refreshToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    const offlineValidUntil = new Date(Date.now() + OFFLINE_HOURS * 3_600_000);
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO callflow_user_sessions (tenant_id, user_id, token_hash, refresh_token_hash, device_id, install_id, device_name, app_version, expires_at, offline_valid_until)
      VALUES ($1, $2, $3, $3, $4, $4, $5, $6, $7, $8) RETURNING id
    `, [row.tenant_id, row.user_id, hash(refreshToken), device.installId, device.deviceName, device.appVersion, expiresAt, offlineValidUntil]);
    const sessionId = inserted.rows[0].id;
    const tokenIdentity: CallFlowIdentity = { userId: row.user_id, salesPersonId: row.user_id, name: row.display_name, tenantId: row.tenant_id, sessionId, deviceId: device.installId };
    await client.query(`INSERT INTO callflow_audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, 'mobile.login', 'session', $3, $4::jsonb)`, [row.tenant_id, row.user_id, sessionId, JSON.stringify({ installId: device.installId, appVersion: device.appVersion })]);
    await client.query("COMMIT");
    return { accessToken: createCallFlowToken(tokenIdentity, "access", ACCESS_SECONDS), refreshToken, expiresAt: new Date(Date.now() + ACCESS_SECONDS * 1000).toISOString(), offlineValidUntil: offlineValidUntil.toISOString(), employeeName: row.display_name, mobile: row.mobile_normalized, accountId: row.user_id, deviceId: device.installId, status: "ACTIVE" };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}

export async function refreshCentralSession(refreshToken: string): Promise<CentralTokenResponse | null> {
  if (!refreshToken || refreshToken.includes(".")) return null;
  const client = await requirePlatformPool().connect();
  try {
    await client.query("BEGIN"); await client.query("SELECT set_config('callflow.owner_admin', 'true', true)");
    const result = await client.query<{ id: string; tenant_id: string; user_id: string; device_id: string | null; display_name: string; mobile_normalized: string | null; membership_status: string; user_status: string; company_status: string }>(`
      SELECT session.id, session.tenant_id, session.user_id, session.device_id, users.display_name, users.mobile_normalized,
        membership.status AS membership_status, users.status AS user_status, company.status AS company_status
      FROM callflow_user_sessions session JOIN callflow_users users ON users.id = session.user_id
      JOIN callflow_memberships membership ON membership.tenant_id = session.tenant_id AND membership.user_id = session.user_id
      JOIN callflow_companies company ON company.id = session.tenant_id
      WHERE session.refresh_token_hash = $1 AND session.revoked_at IS NULL AND session.expires_at > NOW()
      FOR UPDATE OF session
    `, [hash(refreshToken)]);
    const row = result.rows[0];
    if (!row || row.membership_status !== 'active' || row.user_status !== 'active' || row.company_status !== 'active') { await client.query("ROLLBACK"); return null; }
    const rotated = randomBytes(32).toString("base64url"); const offlineValidUntil = new Date(Date.now() + OFFLINE_HOURS * 3_600_000);
    await client.query(`UPDATE callflow_user_sessions SET refresh_token_hash = $2, token_hash = $2, last_seen_at = NOW(), offline_valid_until = $3 WHERE id = $1`, [row.id, hash(rotated), offlineValidUntil]);
    await client.query("COMMIT");
    const tokenIdentity: CallFlowIdentity = { userId: row.user_id, salesPersonId: row.user_id, name: row.display_name, tenantId: row.tenant_id, sessionId: row.id, deviceId: row.device_id || undefined };
    return { accessToken: createCallFlowToken(tokenIdentity, "access", ACCESS_SECONDS), refreshToken: rotated, expiresAt: new Date(Date.now() + ACCESS_SECONDS * 1000).toISOString(), offlineValidUntil: offlineValidUntil.toISOString(), employeeName: row.display_name, mobile: row.mobile_normalized, accountId: row.user_id, deviceId: row.device_id || "", status: "ACTIVE" };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}

export async function centralSessionIsActive(identity: CallFlowIdentity) {
  if (!identity.sessionId || !identity.tenantId) return true;
  const client = await requirePlatformPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('callflow.tenant_id', $1, true)", [identity.tenantId]);
    const result = await client.query(`SELECT 1 FROM callflow_user_sessions session
    JOIN callflow_memberships membership ON membership.tenant_id = session.tenant_id AND membership.user_id = session.user_id
    JOIN callflow_companies company ON company.id = session.tenant_id
    JOIN callflow_users users ON users.id = session.user_id
    WHERE session.id = $1 AND session.tenant_id = $2 AND session.user_id = $3 AND session.revoked_at IS NULL
      AND session.expires_at > NOW() AND membership.status = 'active' AND company.status = 'active' AND users.status = 'active'`, [identity.sessionId, identity.tenantId, identity.userId]);
    await client.query("COMMIT");
    return Boolean(result.rowCount);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function revokeCentralSession(identity: CallFlowIdentity) {
  if (!identity.sessionId || !identity.tenantId) return false;
  const client = await requirePlatformPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('callflow.tenant_id', $1, true)", [identity.tenantId]);
    const result = await client.query(`UPDATE callflow_user_sessions SET revoked_at = NOW(), revoke_reason = 'signed_out'
      WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND revoked_at IS NULL`, [identity.sessionId, identity.tenantId, identity.userId]);
    await client.query("COMMIT");
    return Boolean(result.rowCount);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
