# Registration reliability and capacity

## Release — 6 September 2026

The registration request commits the participant and durable follow-up job together before returning success. CRM, MFW enrollment and WhatsApp delivery run afterward. Registration is not acknowledged from browser storage or from an uncommitted queue entry.

The existing PostgreSQL primary remains authoritative. Splitting related writes between independent databases would introduce consistency problems without fixing the measured query and lock bottlenecks.

### Storage and request changes

- `cfl_registration_records` stores individual participants with workshop/batch and mobile indexes.
- `cfl_attendance_lookup` indexes attendance by normalized mobile. A synchronous trigger mirrors attendance changes, so submission checks no longer scan the complete attendance JSON array.
- `cfl_registration_totals` holds exact response/confirmed/waiting counts per workshop, batch and introduction session. Row triggers maintain counts on insertion, confirmation, transfer and deletion in the same transaction.
- Partial indexes cover waiting positions and referral usage. Submission configuration reads exclude logos, field definitions and other presentation content.
- Workshop limits retain transaction locks to prevent overselling and duplicate waiting positions. Mobile history lookup happens before acquiring the workshop lock. Registration numbers reserve durable blocks of 100 from the shared counter; unused numbers can leave gaps after a restart or rollback.
- Public form configuration is serialized once per process per second, with concurrent cache misses coalesced. Eligibility always reads fresh database state on submission. An already open form can show configuration up to one second old on its next fetch.
- Manual waiting-list confirmation updates selected records and commits before contacting providers. The current dashboard requests only that workshop's updated records; older clients retain the previous full-response contract.
- A stale dashboard snapshot cannot delete registrations omitted from its list. Deletion now requires explicit participant IDs. Saving settings only updates supplied columns, preserving concurrent changes to other settings/attendance columns. Legacy full-record edits still use last-writer-wins for the same supplied participant; this release does not implement general optimistic edit conflict resolution.
- OTP challenges are shared in PostgreSQL with hashed codes, expiry and transactional single-use verification. Requests may reach either web process.

### Server and follow-ups

`npm run start -- --hostname 0.0.0.0 --port 3000` uses a Node cluster supervisor with two stock Next.js server processes sharing one port. The supervisor restarts an exited process and shuts down cleanly on container termination. Startup prepares additive database migrations before the application becomes ready.

`GET /api/health` returns 200 only when the database and registration migration are available; otherwise 503. Configure Coolify HTTP health checks on port 3000, path `/api/health`, expected status 200, with a startup allowance of 30 seconds.

| Setting | Default | Purpose |
| --- | --- | --- |
| `WEB_CONCURRENCY` | 2 | Web processes per container; supported range 1–4 |
| `REGISTRATION_DB_POOL_MAX` | 10 | Reserved submission connections per process |
| `REGISTRATION_WORKER_ENABLED` | true | Leave enabled on at least one long-running replica |
| `REGISTRATION_JOB_CONCURRENCY` | 2 | Concurrent external follow-ups across the whole deployment; range 1–4 |

The shared admin/background pool also permits 10 connections per process. Budget **40 connections per container**, or **80 during a two-container rolling deployment**, plus other database users and operational headroom. Do not increase web processes or pool sizes without rechecking `max_connections`. A shared pooler in transaction mode is not compatible with the follow-up worker's session advisory lock.

The follow-up worker uses one elected worker group across all processes. It processes up to 25 bounded batches per pass and continues immediately when more jobs remain. Idle discovery polls every five seconds. Failed jobs retry with exponential backoff capped at one hour. A revision check prevents an old in-flight waiting notification from acknowledging a newer confirmation job.

Authenticated admins can inspect `/api/admin/registration-queue`. Completed jobs remain available for audit; retention is a separate operational policy. External delivery remains **at least once**: a crash after a provider accepts a message but before its receipt is saved can cause a resend. Registration retry idempotency does not imply exactly-once delivery by external providers.

### Existing production capacity observed

Read-only diagnostics found 12 logical CPUs, about 47 GiB RAM (about 36 GiB available), no container CPU/memory cap, PostgreSQL 18.4 with `max_connections=100`, a roughly 681 MB database, 2,532 normalized registrations and 1,153 attendance entries. There were 11 database connections and no pending follow-up jobs at that observation. These were point-in-time observations, not peak measurements. No additional paid server or database was purchased.

## Load-test evidence

**Conditional local pass, not a production 5,000-user certification.** Tests used the production Next build and disposable PostgreSQL 18.4 on the same macOS host. Each target run seeded 5,000 historical registrations in the same workshop and 5,000 attendance entries. It then submitted 5,000 unique users simultaneously, with a 2,500-seat remaining capacity. Assertions checked committed records/jobs, unique registration numbers/waiting positions and the exact capacity boundary.

Each virtual user had its own pre-established HTTP connection, modelling participants who already opened the form before pressing Submit. Requests were all dispatched together with no application retries. This excludes initial TLS/TCP connection storms and does not model real mobile networks, Coolify's reverse proxy, real providers, large answer payloads, a sustained arrival rate or unrelated production dashboard traffic. Forms in the fixture were deliberately minimal. A raw fresh-connection baseline encountered local `ECONNRESET`; that limitation is not hidden by the successful preconnected results.

| Run | Successful submissions / submitted | Failures | Total burst | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- | --- |
| Previous main `1efc1d8`, 1 process, worker off | 2,196 / 5,000 | 2,804 HTTP 500 | 18.75 s | 16.84 s | 18.23 s | 18.51 s |
| Optimized, 2 processes, worker off | 5,000 / 5,000 | 0 | 7.70 s | 4.58 s | 7.15 s | 7.37 s |
| Final build, 2 processes, worker on | 5,000 / 5,000 | 0 | 10.03 s | 5.70 s | 9.48 s | 9.81 s |

The baseline used the old route/runtime with the new database projection triggers installed, so it is a comparison of query/runtime behavior with the same added trigger write cost, not a reconstruction of every previous production condition. Its generic HTTP errors did not identify a verified server-side root cause for every failed request.

The final worker-on run saved 2,500 confirmed and 2,500 waiting registrations, with 5,000 durable jobs and zero client retries. All 5,000 synthetic jobs completed without provider retries in 12.53 seconds measured from the first job creation to the last completion. No real WhatsApp or MFW endpoint was called. Peak submission connections were 20; peak observed database lock waiters were 19. Correct same-workshop capacity enforcement still serializes a short critical section; this is not a claim of zero internal waiting.

A preceding worker-on 500-user stage passed 500/500 in 1.66 seconds, p95 1.59 seconds. Earlier validation on 5 September saved 600/600 with 19–32 transport retries; those older runs were not zero-retry results.

Additional validation:

- 30 identical concurrent requests produced one registration, including when duplicate entries were otherwise allowed.
- Response limits, identity collisions, manual promotion, batch moves and explicit deletion retained exact counters.
- An empty/stale dashboard snapshot preserved newer registration rows; targeted deletion preserved unrelated rows.
- Concurrent changes to separate settings columns both survived.
- 20 concurrent attempts to verify the same OTP produced exactly one success across both processes; incorrect-attempt limits remained enforced.
- A deliberately invalid synthetic MFW mapping produced a durable failed job; correcting the mapping allowed recovery without contacting an external provider.
- Stopping one local web process left 20/20 readiness probes successful while the supervisor started a replacement process.
- Production build passed; 103 existing unit tests passed.

### Reproduce

Use only a disposable localhost database with no real provider credentials. The runners reject remote database/application targets.

```sh
# Start the built app with DATABASE_URL pointing to the disposable PostgreSQL DB.
WEB_CONCURRENCY=2 REGISTRATION_WORKER_ENABLED=true npm run start -- --hostname 127.0.0.1 --port 3319
# TEST_DATABASE_URL must point to the same disposable database.
LOAD_USERS=500 LOAD_PRECONNECT=true node scripts/load/registration-capacity.mjs
LOAD_USERS=5000 LOAD_PRECONNECT=true node scripts/load/registration-capacity.mjs
node scripts/load/registration-queue-retry.mjs
```

For `registration-integrity.mjs`, use the synthetic admin/secret configuration documented in that runner and disable the worker while asserting pending-job state. The load runner's throughput field counts submitted requests per elapsed second; use `httpSuccess` and `durableRows` to distinguish accepted work, especially for failed baseline runs.

### Deployment and rollback

The additive migration runs once under a database advisory lock and records version 1 in `cfl_registration_migrations`. It briefly locks attendance/registration writes while seeding the indexed projections. Existing participant records stay in place. Startup/health failure must prevent routing a new container before readiness. Keep normal database backups and sufficient connection headroom for the rolling deployment.

A code rollback can leave the additive tables, indexes and triggers in place; they remain compatible with previous registration writes. Registration number blocks share the old global counter, preventing reuse during rolling deployments. OTPs issued by the former in-memory implementation may need to be requested again across this release boundary.

Next infrastructure acceptance step is an isolated staging burst and sustained mixed workload behind the actual Coolify proxy, with CPU, disk latency, lock/pool waits and downstream delivery rate observed together. Additional servers, a read replica or a queue broker should follow that measurement; none can guarantee zero failures under every network or provider outage.
