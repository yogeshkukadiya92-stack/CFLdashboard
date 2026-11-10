import type { PoolClient } from "pg";

export const CLAIM_OUTBOX_JOBS_SQL = `
  WITH claimable AS (
    SELECT id
    FROM callflow_outbox_jobs
    WHERE status IN ('pending', 'failed') AND available_at <= NOW()
    ORDER BY available_at, id
    LIMIT $2
    FOR UPDATE SKIP LOCKED
  )
  UPDATE callflow_outbox_jobs AS job
  SET status = 'processing', attempts = attempts + 1, locked_at = NOW(), locked_by = $1
  FROM claimable
  WHERE job.id = claimable.id
  RETURNING job.*
`;

export async function enqueueOutboxJob(client: PoolClient, input: {
  eventKey: string;
  payload: Record<string, unknown>;
  tenantId: string;
  topic: string;
}) {
  const result = await client.query<{ id: string }>(`
    INSERT INTO callflow_outbox_jobs (tenant_id, event_key, topic, payload)
    VALUES ($1, $2, $3, $4::jsonb)
    ON CONFLICT (tenant_id, event_key) DO NOTHING
    RETURNING id
  `, [input.tenantId, input.eventKey, input.topic, JSON.stringify(input.payload)]);
  return result.rows[0]?.id ?? null;
}

export async function claimOutboxJobs(client: PoolClient, workerId: string, limit = 25) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  return client.query(CLAIM_OUTBOX_JOBS_SQL, [workerId, safeLimit]);
}
