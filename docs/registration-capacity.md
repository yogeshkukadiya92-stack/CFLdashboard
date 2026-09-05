# Registration storage and Coolify operation

## Data responsibilities

All authoritative writes continue to use the existing `DATABASE_URL` PostgreSQL primary. This change does not move or delete existing records or create an unsynchronized second database.

- `cfl_registration_records`: individual registration rows, indexed by workshop/batch and mobile; submissions retrieve a person's history and SQL aggregates rather than transferring the entire workshop history.
- `cfl_form_analytics`: isolated per-form counters (introduced previously).
- `cfl_registration_jobs`: durable follow-up outbox. A registration and its job commit together. CRM, MFW and WhatsApp work happens after the HTTP response, outside the registration connection pool.
- `app_state`: workshop configuration and legacy CRM/attendance data. Public submission filters configuration and attendance in SQL. This still scans attendance JSON; normalizing attendance is the next measured step if this becomes dominant.

## Coolify deployment

Use the existing Next.js application on Node with `npm run build` and `npm run start`. The Node instrumentation hook starts a background worker automatically; no external cron or Redis is required. Do not use an idle-suspending/serverless runtime for this worker.

The additive jobs table/index are created automatically with the existing DB role, matching existing project migrations. Run a normal deployment. No database replacement or destructive migration is required.

Keep `REGISTRATION_WORKER_ENABLED=true` on at least one application replica. A PostgreSQL session advisory lock allows one worker across replicas. Each worker pass handles at most 10 jobs and checks again every five seconds. Do not put this worker's shared `DATABASE_URL` behind a transaction-mode pooler: session advisory locks require a session connection.

`REGISTRATION_DB_POOL_MAX` defaults to 10 reserved submission connections; the existing shared admin/worker pool has 10. Budget **20 connections per replica plus other services and operations headroom** before increasing replicas. Extra pools isolate application wait queues, not CPU or database disk. Do not increase connection counts to 600.

Authenticated admins can read `/api/admin/registration-queue` to inspect pending, retrying, completed and oldest pending time. Failed jobs retry with exponential backoff capped at one hour. Jobs are retained, including completed jobs; add an explicit retention policy when volume warrants it.

Provider calls have a 15-second timeout. Successful status fields are saved before updating the CRM projection, so a later CRM error does not resend an already-recorded message. External delivery is **at least once**: a crash after a provider accepts a message but before its receipt commits can duplicate that message. Provider idempotency support is needed to eliminate that boundary.

An asynchronous job always reloads the durable registration. Integration patches merge only integration fields, preserving concurrent changes to confirmation/payment fields. Job recovery does not depend on the participant keeping the browser open.

## Load validation

`scripts/load/registration-burst.mjs` targets only localhost and synthetic disposable data. Start the built app with a disposable PostgreSQL database and no external provider credentials, then set `TEST_DATABASE_URL` and optionally `TEST_BASE_URL` (default localhost:3319). The script sends 600 simultaneous submissions and asserts 600 durable rows/jobs, a 300-seat capacity boundary, waiting positions, registration numbers, identical-request retries and duplicate rejection. It mirrors the form's three-attempt retry policy and reports retries separately.

This is not a production 600-user certification. Production acceptance requires the same burst behind Coolify's actual reverse proxy with production-shaped data, pool/CPU/disk/lock monitoring, plus a sustained workload. A read replica improves reporting reads only and cannot fix a saturated primary write path. Add servers based on those measurements.

### Local result — 2026-09-05

Production Next build + PostgreSQL 18.4 on localhost; 600 synthetic simultaneous submissions with a 300-seat limit. All 600 eventually saved, all 600 durable jobs existed, 300 confirmed and 300 waiting, unique registration numbers/waiting positions, 20 identical retries remained idempotent, and duplicate mobile was rejected. p50 963 ms, p95 1,272 ms, p99 1,431 ms, max 1,548 ms. There were 19 transport retries; **this is not a zero-retry result**. The first raw attempt without client retry encountered a local TCP reset. The test does not establish production capacity or a before/after speedup.

A deliberately missing synthetic MFW mapping recorded a failed durable job; correcting the mapping allowed the worker to retry and complete without calling an external provider. Existing unit tests: 103 passed. Real provider latency and production-shaped attendance/history volumes remain to be tested on staging.

Final-build repeat including conflicting-ID rejection: 600/600 saved, 32 transport retries, p50 1,005 ms, p95 1,396 ms, p99 1,464 ms, max 1,567 ms; capacity and idempotency assertions passed again.
