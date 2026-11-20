import type { PoolClient } from "pg";
import { attendanceSessionEnd } from "./attendance-window";
import { ensurePersistenceTable, getDbPool } from "./db";
import { internationalPhone } from "./phone-number";
import { sendAttendanceThankYou } from "./registration-confirmation";
import { salesPersonCodeFromId } from "./sales-person-code";
import { reconcileSalesPeople } from "./sales-person-reconciliation";
import type { AttendanceEntry, AttendanceSession, BuilderForm, Lead, SalesTeamUser } from "./types";

type Salesperson = { id: string; name: string; mobile: string; isActive?: boolean; salesPersonCode?: string };

let deliveryTable: Promise<unknown> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

async function deliverAttendanceThankYous() {
  const db = getDbPool();
  if (!db || running) return;
  running = true;
  let client: PoolClient | undefined;
  let locked = false;
  try {
    await ensurePersistenceTable();
    client = await db.connect();
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(73184, 7) AS locked");
    locked = lock.rows[0].locked;
    if (!locked) return;
    const connection = client;
    deliveryTable ??= connection.query(`CREATE TABLE IF NOT EXISTS cfl_attendance_thank_you_deliveries (
      session_id text NOT NULL,
      mobile text NOT NULL,
      status text NOT NULL DEFAULT 'sending',
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (session_id, mobile)
    )`).catch(error => {
      deliveryTable = undefined;
      throw error;
    });
    await deliveryTable;

    const { rows: [state] } = await connection.query<{
      sessions: AttendanceSession[];
      entries: AttendanceEntry[];
      leads: Lead[];
      people: Salesperson[];
      sales_users: SalesTeamUser[];
      forms: BuilderForm[];
    }>(`SELECT attendance_sessions AS sessions, attendance_entries AS entries,
        leads, sales_people AS people, sales_team_users AS sales_users, forms
      FROM app_state WHERE id = 1 AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(attendance_sessions) session
        WHERE session->>'published' = 'true' AND session->>'whatsappThankYouTemplate' <> ''
      )`);
    if (!state) return;

    const now = Date.now();
    const due = state.sessions.filter(session => {
      const end = attendanceSessionEnd(session);
      return session.published && session.whatsappThankYouTemplate?.trim() && end !== null && end <= now;
    });
    if (!due.length) return;
    const salespeople = reconcileSalesPeople(state.people, state.sales_users) as Salesperson[];
    const dueById = new Map(due.map(session => [session.id, session]));
    const { rows: deliveries } = await connection.query<{ session_id: string; mobile: string }>(
      `SELECT session_id, mobile FROM cfl_attendance_thank_you_deliveries
      WHERE session_id = ANY($1::text[]) AND (status <> 'retry' OR updated_at > now() - interval '5 minutes')`,
      [[...dueById.keys()]]
    );
    const handled = new Set(deliveries.map(row => JSON.stringify([row.session_id, row.mobile])));
    const leadsByPhone = new Map<string, Lead[]>();
    for (const lead of state.leads) {
      const phone = internationalPhone(lead.mobile);
      if (phone) leadsByPhone.set(phone, [...(leadsByPhone.get(phone) ?? []), lead]);
    }

    const sends: Promise<void>[] = [];
    for (const entry of state.entries) {
      const session = dueById.get(entry.sessionId);
      const templateName = session?.whatsappThankYouTemplate?.trim();
      if (!session || !templateName) continue;
      const mobile = internationalPhone(entry.mobile);
      const key = JSON.stringify([session.id, mobile]);
      if (!mobile || handled.has(key)) continue;
      const leads = leadsByPhone.get(mobile);
      const lead = leads?.[0];
      if (leads?.length !== 1 || !lead || lead.blocked) continue;
      const people = salespeople.filter(person => {
        if (person.isActive === false) return false;
        if (lead.assignedSalesPersonId) return person.id === lead.assignedSalesPersonId;
        if (lead.assignedSalesPersonCode) return (person.salesPersonCode || salesPersonCodeFromId(person.id)) === lead.assignedSalesPersonCode;
        return Boolean(lead.assignedTo && person.name === lead.assignedTo);
      });
      const supportNumber = people.length === 1 ? internationalPhone(people[0].mobile) : "";
      if (!supportNumber) continue;

      handled.add(key);
      sends.push((async () => {
        const claim = await connection.query(`INSERT INTO cfl_attendance_thank_you_deliveries AS delivery (session_id, mobile)
          VALUES ($1, $2) ON CONFLICT (session_id, mobile) DO UPDATE SET status = 'sending', updated_at = now()
          WHERE delivery.status = 'retry' AND delivery.updated_at <= now() - interval '5 minutes'
          RETURNING session_id`, [session.id, mobile]);
        if (!claim.rowCount) return;
        const result = await sendAttendanceThankYou({
          mobile,
          name: entry.attendeeName || lead.name,
          sessionTitle: session.title || session.workshopName,
          supportNumber,
          templateName,
          senderId: state.forms.find(form => form.workshopId === session.workshopId)?.whatsappSenderId
        });
        // An unknown provider outcome must retain its claim to avoid a duplicate message.
        const status = result.sent ? "sent" : result.retryable || !result.configured ? "retry" : "failed";
        await connection.query(`UPDATE cfl_attendance_thank_you_deliveries SET status = $3, updated_at = now()
          WHERE session_id = $1 AND mobile = $2`, [session.id, mobile, status]);
      })());
      if (sends.length === 8) break;
    }
    const results = await Promise.allSettled(sends);
    if (results.some(result => result.status === "rejected")) console.error("Attendance thank-you delivery could not be recorded.");
  } catch {
    console.error("Attendance thank-you worker could not process sessions.");
  } finally {
    if (client) {
      let unlockFailed = false;
      if (locked) {
        await client.query("SELECT pg_advisory_unlock(73184, 7)").catch(() => { unlockFailed = true; });
      }
      client.release(unlockFailed);
    }
    running = false;
  }
}

export function startAttendanceThankYouWorker() {
  if (timer || !process.env.DATABASE_URL || process.env.NEXT_PHASE === "phase-production-build") return;
  timer = setInterval(() => void deliverAttendanceThankYous(), 30_000);
  timer.unref();
  void deliverAttendanceThankYous();
}
