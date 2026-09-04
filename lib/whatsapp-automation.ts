import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDbPool } from "./db.ts";

export type WhatsAppEvent = {
  eventKey: string;
  type: "message.received" | "message.sent" | "message.delivered" | "message.read" | "message.failed";
  providerMessageId: string;
  mobile: string;
  messageType?: string;
  text?: string;
  error?: string;
  timestamp?: string;
};

export type WhatsAppActivity = {
  id: string;
  direction: "inbound" | "outbound";
  mobile: string;
  status: string;
  templateName?: string;
  text: string;
  createdAt: string;
};

let schemaReady: Promise<void> | null = null;

async function database() {
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  if (!schemaReady) {
    schemaReady = readFile(join(process.cwd(), "database", "whatsapp_automation.sql"), "utf8")
      .then((sql) => pool.query(sql))
      .then(() => undefined)
      .catch((error) => { schemaReady = null; throw error; });
  }
  await schemaReady;
  return pool;
}

function mobileDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-15);
}

function eventTimestamp(value: unknown) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0 ? new Date(numeric * 1000) : new Date();
  return date.toISOString();
}

function statusType(value: unknown): WhatsAppEvent["type"] | null {
  const status = String(value ?? "").toLowerCase();
  if (["sent", "delivered", "read", "failed"].includes(status)) return `message.${status}` as WhatsAppEvent["type"];
  return null;
}

export function verifyWhatsAppWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.WHATSAPP_WEBHOOK_APP_SECRET || process.env.META_APP_SECRET || "";
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const received = signatureHeader.slice(7);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!/^[0-9a-f]{64}$/i.test(received) || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export function parseWhatsAppWebhook(payload: unknown): WhatsAppEvent[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const root = payload as Record<string, unknown>;
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const events: WhatsAppEvent[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const changes = Array.isArray((entry as Record<string, unknown>).changes) ? (entry as Record<string, unknown>).changes as unknown[] : [];
    for (const change of changes) {
      if (!change || typeof change !== "object" || Array.isArray(change)) continue;
      const value = (change as Record<string, unknown>).value;
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const data = value as Record<string, unknown>;
      for (const item of Array.isArray(data.messages) ? data.messages : []) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const message = item as Record<string, unknown>;
        const providerMessageId = String(message.id ?? "").slice(0, 300);
        if (!providerMessageId) continue;
        const textValue = message.text && typeof message.text === "object" && !Array.isArray(message.text) ? String((message.text as Record<string, unknown>).body ?? "") : "";
        const buttonValue = message.button && typeof message.button === "object" && !Array.isArray(message.button) ? String((message.button as Record<string, unknown>).text ?? (message.button as Record<string, unknown>).payload ?? "") : "";
        const interactiveValue = message.interactive && typeof message.interactive === "object" && !Array.isArray(message.interactive) ? JSON.stringify(message.interactive).slice(0, 4096) : "";
        events.push({ eventKey: `in:${providerMessageId}`, type: "message.received", providerMessageId, mobile: mobileDigits(message.from), messageType: String(message.type ?? "text").slice(0, 50), text: (textValue || buttonValue || interactiveValue).slice(0, 4096), timestamp: eventTimestamp(message.timestamp) });
      }
      for (const item of Array.isArray(data.statuses) ? data.statuses : []) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const status = item as Record<string, unknown>;
        const type = statusType(status.status);
        const providerMessageId = String(status.id ?? "").slice(0, 300);
        if (!type || !providerMessageId) continue;
        const errors = Array.isArray(status.errors) ? status.errors as Array<Record<string, unknown>> : [];
        events.push({ eventKey: `${type}:${providerMessageId}:${String(status.timestamp ?? "")}`, type, providerMessageId, mobile: mobileDigits(status.recipient_id), error: errors.map((error) => String(error.title ?? error.message ?? error.code ?? "")).filter(Boolean).join(" · ").slice(0, 1000), timestamp: eventTimestamp(status.timestamp) });
      }
    }
  }
  return events.slice(0, 500);
}

export async function storeWhatsAppEvents(events: WhatsAppEvent[]) {
  if (!events.length) return [];
  const db = await database();
  const client = await db.connect();
  const inserted: WhatsAppEvent[] = [];
  try {
    await client.query("BEGIN");
    for (const event of events) {
      const accepted = await client.query(
        `INSERT INTO cfl_whatsapp_webhook_events (event_key,event_type,provider_message_id,mobile,summary,received_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT (event_key) DO NOTHING RETURNING event_key`,
        [event.eventKey, event.type, event.providerMessageId, event.mobile, JSON.stringify({ messageType: event.messageType, text: event.text, error: event.error }), event.timestamp || new Date().toISOString()]
      );
      if (!accepted.rowCount) continue;
      inserted.push(event);
      if (event.type === "message.received") {
        await client.query(
          `INSERT INTO cfl_whatsapp_messages (id,provider_message_id,mobile,direction,message_type,message_text,status,retry_enabled,max_attempts,received_at)
           VALUES ($1,$2,$3,'inbound',$4,$5,'received',FALSE,0,$6)
           ON CONFLICT (provider_message_id) DO UPDATE SET message_text=EXCLUDED.message_text,updated_at=NOW()`,
          [randomUUID(), event.providerMessageId, event.mobile, event.messageType || "text", event.text || "", event.timestamp || new Date().toISOString()]
        );
      } else {
        const status = event.type.slice(8);
        const timestampColumn = status === "delivered" ? "delivered_at" : status === "read" ? "read_at" : status === "failed" ? "failed_at" : "sent_at";
        const updated = await client.query(
          `UPDATE cfl_whatsapp_messages SET status=$1, ${timestampColumn}=$2, updated_at=NOW(), metadata=metadata || $3::jsonb WHERE provider_message_id=$4 RETURNING id,retry_enabled,max_attempts`,
          [status, event.timestamp || new Date().toISOString(), JSON.stringify(event.error ? { lastError: event.error } : {}), event.providerMessageId]
        );
        const message = updated.rows[0];
        if (status === "failed" && message?.retry_enabled && Number(message.max_attempts) > 0) {
          await client.query(
            `INSERT INTO cfl_whatsapp_retry_queue (id,message_id,provider_message_id,attempt_count,max_attempts,next_attempt_at,last_error)
             VALUES ($1,$2,$3,0,$4,NOW()+INTERVAL '5 minutes',$5) ON CONFLICT (message_id,attempt_count) DO NOTHING`,
            [randomUUID(), message.id, event.providerMessageId, Number(message.max_attempts), event.error || "Provider reported delivery failure"]
          );
        }
      }
    }
    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordOutboundWhatsAppMessage(input: { providerMessageId?: string; registrationId?: string; mobile: string; templateName?: string; status: "sent" | "failed"; retryEnabled?: boolean; maxAttempts?: number; error?: string }) {
  const db = await database();
  const id = randomUUID();
  const providerMessageId = input.providerMessageId?.slice(0, 300) || `local:${id}`;
  const result = await db.query(
    `INSERT INTO cfl_whatsapp_messages (id,provider_message_id,registration_id,mobile,direction,message_type,template_name,status,retry_enabled,max_attempts,metadata,sent_at,failed_at)
     VALUES ($1,$2,$3,$4,'outbound','template',$5,$6,$7,$8,$9::jsonb,$10,$11)
     ON CONFLICT (provider_message_id) DO UPDATE SET status=EXCLUDED.status,metadata=cfl_whatsapp_messages.metadata || EXCLUDED.metadata,updated_at=NOW()
     RETURNING id,retry_enabled,max_attempts`,
    [id, providerMessageId, input.registrationId || null, mobileDigits(input.mobile), input.templateName || null, input.status, input.retryEnabled !== false, Math.max(0, Math.min(10, input.maxAttempts ?? 3)), JSON.stringify(input.error ? { lastError: input.error } : {}), input.status === "sent" ? new Date().toISOString() : null, input.status === "failed" ? new Date().toISOString() : null]
  );
  const message = result.rows[0];
  if (input.status === "failed" && message?.retry_enabled && Number(message.max_attempts) > 0) {
    await db.query(
      `INSERT INTO cfl_whatsapp_retry_queue (id,message_id,provider_message_id,attempt_count,max_attempts,next_attempt_at,last_error)
       VALUES ($1,$2,$3,0,$4,NOW()+INTERVAL '5 minutes',$5) ON CONFLICT (message_id,attempt_count) DO NOTHING`,
      [randomUUID(), message.id, providerMessageId, Number(message.max_attempts), input.error || "Initial delivery failed"]
    );
  }
}

export async function claimDueWhatsAppRetries(limit = 10) {
  const db = await database();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT q.id,q.message_id AS "messageId",q.attempt_count AS "attemptCount",q.max_attempts AS "maxAttempts",
        m.registration_id AS "registrationId",m.mobile,m.template_name AS "templateName"
       FROM cfl_whatsapp_retry_queue q JOIN cfl_whatsapp_messages m ON m.id=q.message_id
       WHERE q.status='pending' AND q.next_attempt_at<=NOW()
       ORDER BY q.next_attempt_at FOR UPDATE OF q SKIP LOCKED LIMIT $1`,
      [Math.max(1, Math.min(25, limit))]
    );
    if (result.rows.length) await client.query(`UPDATE cfl_whatsapp_retry_queue SET status='processing',updated_at=NOW() WHERE id=ANY($1::uuid[])`, [result.rows.map((row) => row.id)]);
    await client.query("COMMIT");
    return result.rows as Array<{ id: string; messageId: string; attemptCount: number; maxAttempts: number; registrationId?: string; mobile: string; templateName?: string }>;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function finishWhatsAppRetry(id: string, success: boolean, error = "") {
  const db = await database();
  if (success) {
    await db.query(`UPDATE cfl_whatsapp_retry_queue SET status='completed',attempt_count=attempt_count+1,last_error='',updated_at=NOW() WHERE id=$1`, [id]);
    return;
  }
  await db.query(
    `UPDATE cfl_whatsapp_retry_queue SET attempt_count=attempt_count+1,
       status=CASE WHEN attempt_count+1>=max_attempts THEN 'exhausted' ELSE 'pending' END,
       next_attempt_at=NOW()+(INTERVAL '5 minutes' * POWER(2,LEAST(attempt_count,5))),
       last_error=$2,updated_at=NOW() WHERE id=$1`,
    [id, error.slice(0, 1000)]
  );
}

export async function getWhatsAppAutomationOverview() {
  const db = await database();
  const [counts, activity, retries] = await Promise.all([
    db.query(`SELECT status,COUNT(*)::int AS count FROM cfl_whatsapp_messages WHERE created_at >= NOW()-INTERVAL '24 hours' GROUP BY status`),
    db.query(`SELECT id,direction,mobile,status,template_name AS "templateName",message_text AS text,created_at AS "createdAt" FROM cfl_whatsapp_messages ORDER BY created_at DESC LIMIT 20`),
    db.query(`SELECT COUNT(*)::int AS count FROM cfl_whatsapp_retry_queue WHERE status='pending' AND next_attempt_at<=NOW()`)
  ]);
  return {
    counts: Object.fromEntries(counts.rows.map((row) => [String(row.status), Number(row.count)])),
    retryDue: Number(retries.rows[0]?.count || 0),
    activity: activity.rows as WhatsAppActivity[]
  };
}

export function webhookPayloadKey(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}
