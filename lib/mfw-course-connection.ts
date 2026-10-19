import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getDbPool } from './db.ts';

function encryptionKey() {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is required to save the MFW connection.');
  return createHash('sha256').update(process.env.AUTH_SECRET).digest();
}
async function database() {
  const pool = getDbPool();
  if (!pool) throw new Error('Database is required for course enrollment settings.');
  await pool.query(`CREATE TABLE IF NOT EXISTS cfl_mfw_course_connection (id INTEGER PRIMARY KEY CHECK(id=1), api_key TEXT NOT NULL DEFAULT '', settings JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  return pool;
}
export async function courseConnectionKey() {
  if (process.env.MFW_INTEGRATION_API_KEY?.trim()) return process.env.MFW_INTEGRATION_API_KEY.trim();
  const pool = await database();
  const result = await pool.query('SELECT api_key FROM cfl_mfw_course_connection WHERE id=1');
  if (!result.rows[0]?.api_key) return '';
  const [iv, tag, encrypted] = String(result.rows[0].api_key).split('.').map(value => Buffer.from(value, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
export async function saveCourseConnectionKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const stored = [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('hex')).join('.');
  const pool = await database();
  await pool.query('INSERT INTO cfl_mfw_course_connection(id,api_key) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET api_key=EXCLUDED.api_key,updated_at=NOW()', [stored]);
}
export async function mfwCourseRequest(path: string, init: RequestInit = {}, apiKey?: string) {
  const key = apiKey || await courseConnectionKey();
  if (!key) throw new Error('Connect MFW with a course enrollment API key first.');
  const baseUrl = (process.env.MFW_API_BASE_URL || 'https://api.myfitnessworld.in').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/integrations/v1/${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'x-mfw-api-key': key }, signal: AbortSignal.timeout(15000), cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || 'MFW could not complete the enrollment request.');
  return result;
}

export async function localCourseEnrollmentSettings() {
  const pool = await database();
  const result = await pool.query('SELECT settings FROM cfl_mfw_course_connection WHERE id=1');
  return (result.rows[0]?.settings || {}) as { enabled?: boolean; mappings?: {paymentLinkId: string; courseId: string}[] };
}
export async function saveLocalCourseEnrollmentSettings(settings: {enabled: boolean; mappings: {paymentLinkId: string; courseId: string}[]}) {
  const pool = await database();
  await pool.query("INSERT INTO cfl_mfw_course_connection(id,settings) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=NOW()", [JSON.stringify(settings)]);
}
