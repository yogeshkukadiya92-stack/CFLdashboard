import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ensurePersistenceTable, getDbPool } from "./db.ts";
import type { RegistrationEntry } from "./types.ts";

export type ParsedPaymentEvent = {
  id: string;
  eventName: string;
  paymentId: string;
  registrationId: string;
  status: string;
  amount: number;
  currency: string;
  method: string;
  payload: Record<string, unknown>;
};

let schemaReady: Promise<void> | null = null;

async function database() {
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  if (!schemaReady) schemaReady = readFile(join(process.cwd(), "database", "payment_automation.sql"), "utf8").then((sql) => pool.query(sql)).then(() => undefined).catch((error) => { schemaReady = null; throw error; });
  await schemaReady;
  return pool;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, secret: string) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

export function parseRazorpayPaymentEvent(payload: unknown): ParsedPaymentEvent | null {
  const root = object(payload);
  const eventName = String(root.event ?? "").trim().slice(0, 100);
  const payment = object(object(object(root.payload).payment).entity);
  const paymentId = String(payment.id ?? "").trim().slice(0, 160);
  if (!eventName || !paymentId) return null;
  const notes = object(payment.notes);
  const registrationId = String(notes.registrationId ?? notes.registration_id ?? notes.registration ?? "").trim().slice(0, 200);
  const amountPaise = Number(payment.amount ?? 0);
  return {
    id: String(root.id ?? `${eventName}:${paymentId}`).trim().slice(0, 300),
    eventName,
    paymentId,
    registrationId,
    status: String(payment.status ?? eventName.split(".").at(-1) ?? "received").trim().slice(0, 80),
    amount: Number.isFinite(amountPaise) ? Math.max(0, Math.min(100_000_000, amountPaise / 100)) : 0,
    currency: String(payment.currency ?? "INR").trim().slice(0, 10),
    method: String(payment.method ?? "").trim().slice(0, 40),
    payload: root
  };
}

export async function recordPaymentEvent(event: ParsedPaymentEvent) {
  const db = await database();
  const result = await db.query(
    `INSERT INTO cfl_payment_events (id,event_name,payment_id,registration_id,status,amount,currency,method,payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [event.id, event.eventName, event.paymentId, event.registrationId, event.status, event.amount, event.currency, event.method, JSON.stringify(event.payload)]
  );
  return result.rowCount === 1;
}

export async function applyCapturedPayment(event: ParsedPaymentEvent) {
  if (event.eventName !== "payment.captured" || !event.registrationId || event.amount <= 0) return null;
  const db = await database();
  await ensurePersistenceTable();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const paymentEvent = await client.query(`SELECT applied_at FROM cfl_payment_events WHERE id=$1 FOR UPDATE`, [event.id]);
    if (!paymentEvent.rows[0] || paymentEvent.rows[0].applied_at) { await client.query("ROLLBACK"); return null; }
    const selected = await client.query(`SELECT registrations FROM app_state WHERE id=1 FOR UPDATE`);
    const registrations = (Array.isArray(selected.rows[0]?.registrations) ? selected.rows[0].registrations : []) as RegistrationEntry[];
    const current = registrations.find((registration) => registration.id === event.registrationId);
    if (!current) { await client.query("ROLLBACK"); return null; }
    const amountPaid = Math.min(100_000_000, Math.max(0, Number(current.amountPaid || 0) + event.amount));
    const amountDue = Math.max(0, Number(current.amountDue || 0) - event.amount);
    const updated = { ...current, amountPaid, amountDue, status: amountDue > 0 ? "Due" as const : "Paid" as const };
    const next = registrations.map((registration) => registration.id === current.id ? updated : registration);
    await client.query(`UPDATE app_state SET registrations=$1::jsonb,updated_at=NOW() WHERE id=1`, [JSON.stringify(next)]);
    await client.query(`UPDATE cfl_payment_events SET applied_at=NOW() WHERE id=$1`, [event.id]);
    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function getPaymentAutomationOverview(registrations: RegistrationEntry[]) {
  const db = await database();
  const [countsResult, activityResult] = await Promise.all([
    db.query(`SELECT event_name,COUNT(*)::int AS count,COALESCE(SUM(amount),0)::float8 AS amount FROM cfl_payment_events GROUP BY event_name`),
    db.query(`SELECT id,event_name,payment_id,registration_id,status,amount,currency,method,created_at FROM cfl_payment_events ORDER BY created_at DESC LIMIT 20`)
  ]);
  const counts: Record<string, number> = {};
  let collected = 0;
  for (const row of countsResult.rows) { counts[String(row.event_name)] = Number(row.count || 0); if (row.event_name === "payment.captured") collected += Number(row.amount || 0); }
  return {
    counts,
    collected,
    outstanding: registrations.reduce((sum, registration) => sum + Math.max(0, Number(registration.amountDue || 0)), 0),
    dueRegistrations: registrations.filter((registration) => Number(registration.amountDue || 0) > 0).length,
    activity: activityResult.rows.map((row) => ({ id: String(row.id), eventName: String(row.event_name), paymentId: String(row.payment_id), registrationId: String(row.registration_id), status: String(row.status), amount: Number(row.amount || 0), currency: String(row.currency), method: String(row.method), createdAt: new Date(row.created_at).toISOString() }))
  };
}
