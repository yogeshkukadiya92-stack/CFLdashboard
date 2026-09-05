import { getDbPool } from "./db";

let schema: Promise<unknown> | undefined;
let running = false;
export async function ensureRegistrationJobs() {
  const db = getDbPool();
  if (!db) return;
  schema ??= db.query(`CREATE TABLE IF NOT EXISTS cfl_registration_jobs (
    registration_id TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ); CREATE INDEX IF NOT EXISTS cfl_registration_jobs_pending_idx
    ON cfl_registration_jobs (available_at) WHERE completed_at IS NULL;`).catch(error => {
    schema = undefined;
    throw error;
  });
  await schema;
}

// A durable outbox: the job is inserted in the SAME transaction as the record.
// One worker across replicas keeps external services and DB pools from flooding.
export async function drainRegistrationJobs() {
  const db = getDbPool();
  if (!db || running) return;
  running = true;
  let client;
  let locked = false;
  try {
    await ensureRegistrationJobs();
    client = await db.connect();
    locked = (await client.query(`SELECT pg_try_advisory_lock(73184, 1) AS acquired`)).rows[0].acquired;
    if (!locked) return;
    const { runRegistrationFollowup } = await import("./registration-followup-worker");
    for (let index = 0; index < 10; index++) {
      const result = await client.query(`SELECT registration_id FROM cfl_registration_jobs
        WHERE completed_at IS NULL AND available_at <= NOW() ORDER BY available_at LIMIT 1`);
      const id = result.rows[0]?.registration_id;
      if (!id) break;
      // A process crash releases the advisory lock and leaves the job pending.
      try {
        await runRegistrationFollowup(id);
        await client.query(`UPDATE cfl_registration_jobs SET completed_at = NOW(), last_error = NULL WHERE registration_id = $1`, [id]);
      } catch (error) {
        await client.query(`UPDATE cfl_registration_jobs SET attempts = attempts + 1,
          available_at = NOW() + LEAST(3600, 5 * power(2, LEAST(attempts, 10))) * interval '1 second',
          last_error = $2 WHERE registration_id = $1`, [id, error instanceof Error ? error.message.slice(0, 500) : "Follow-up failed"]);
      }
    }
  } catch (error) {
    console.error("Registration worker error", error instanceof Error ? error.message : "unknown");
  } finally {
    if (client) {
      if (locked) await client.query(`SELECT pg_advisory_unlock(73184, 1)`).catch(() => undefined);
      client.release();
    }
    running = false;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
export function startRegistrationWorker() {
  if (timer || process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL || process.env.REGISTRATION_WORKER_ENABLED === "false") return;
  timer = setInterval(() => void drainRegistrationJobs(), 5000);
  timer.unref();
  void drainRegistrationJobs();
}
