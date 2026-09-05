import type { PoolClient } from "pg";
import { getDbPool } from "./db";

let schema: Promise<unknown> | undefined;
let running = false;
export async function ensureRegistrationJobs() {
  const db = getDbPool();
  if (!db) return;
  schema ??= db.query(`DO $setup$ BEGIN PERFORM pg_advisory_xact_lock(73184,4); CREATE TABLE IF NOT EXISTS cfl_registration_jobs (
    registration_id TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ); ALTER TABLE cfl_registration_jobs ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0;
  CREATE INDEX IF NOT EXISTS cfl_registration_jobs_pending_idx
    ON cfl_registration_jobs (available_at) WHERE completed_at IS NULL; END $setup$;`).catch(error => {
    schema = undefined;
    throw error;
  });
  await schema;
}

// A durable outbox: the job is inserted in the SAME transaction as the record.
// One bounded worker group across replicas avoids flooding external services.
export async function drainRegistrationJobs() {
  const db = getDbPool();
  if (!db || running) return;
  running = true;
  let client: PoolClient | undefined;
  let locked = false;
  let hasMore = false;
  try {
    await ensureRegistrationJobs();
    client = await db.connect();
    locked = (await client.query(`SELECT pg_try_advisory_lock(73184, 1) AS acquired`)).rows[0].acquired;
    if (!locked) return;
    const { runRegistrationFollowup } = await import("./registration-followup-worker");
    const configured=Number(process.env.REGISTRATION_JOB_CONCURRENCY ?? 2);
    const concurrency=Number.isInteger(configured)&&configured>=1&&configured<=4?configured:2;
    for (let index = 0; index < 25; index++) {
      const result = await client.query(`SELECT registration_id,revision FROM cfl_registration_jobs
        WHERE completed_at IS NULL AND available_at <= NOW() ORDER BY available_at,registration_id LIMIT $1`,[concurrency]);
      if (!result.rows.length) { hasMore=false; break; }
      hasMore=result.rows.length===concurrency;
      // The session lock remains held until every provider call and receipt has
      // settled. A crash releases it and leaves unfinished jobs recoverable.
      const outcomes=await Promise.allSettled(result.rows.map(async ({registration_id:id,revision})=>{
        try {
          await runRegistrationFollowup(id);
          // A manual confirmation may enqueue a newer job while an old waiting
          // notification is in flight. Only acknowledge the revision we ran.
          await client!.query(`UPDATE cfl_registration_jobs SET completed_at=NOW(),last_error=NULL WHERE registration_id=$1 AND revision=$2`,[id,revision]);
        } catch(error) {
          await client!.query(`UPDATE cfl_registration_jobs SET attempts=attempts+1,
            available_at=NOW() + LEAST(3600,5*power(2,LEAST(attempts,10))) * interval '1 second',
            last_error=$2 WHERE registration_id=$1 AND revision=$3`,[id,error instanceof Error?error.message.slice(0,500):"Follow-up failed",revision]);
        }
      }));
      const failed=outcomes.find(result=>result.status==="rejected");
      if(failed?.status==="rejected")throw failed.reason;
    }
  } catch (error) {
    console.error("Registration worker error", error instanceof Error ? error.message : "unknown");
  } finally {
    if (client) {
      if (locked) await client.query(`SELECT pg_advisory_unlock(73184, 1)`).catch(() => undefined);
      client.release();
    }
    running = false;
    // Full batches continue immediately; the five-second idle poll is only for
    // discovering new work, not a mandatory delay between completed batches.
    if(hasMore){const follow=setTimeout(()=>void drainRegistrationJobs(),0);follow.unref();}
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
export function startRegistrationWorker() {
  if (timer || process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL || process.env.REGISTRATION_WORKER_ENABLED === "false") return;
  timer = setInterval(() => void drainRegistrationJobs(), 5000);
  timer.unref();
  void drainRegistrationJobs();
}
