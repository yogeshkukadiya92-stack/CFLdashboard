# CFL Dashboard — 400 Concurrent User Load Test

Date: 2026-08-13  
Environment: local production build, Next.js server on macOS (8 CPU, 16 GB RAM)  
Scope: authenticated dashboard reads, dashboard summary API, public registration state API, and login redirect  
Acceptance gates: error rate < 1%, p95 < 1,000 ms, p99 < 2,000 ms, no process crash

## Verdict

**Fail at 400 concurrent active users.** The server stayed alive and latency remained within the latency gates, but repeat testing produced 226 `ECONNRESET` failures (1.785%), exceeding the 1% reliability gate. The same focused scenario passed at 350 users with zero errors.

This is not a production-capacity certification. The local environment had no `DATABASE_URL`, so database pool saturation, locks, write contention, and production network/proxy limits were not exercised.

## Workload

- 45% authenticated dashboard page
- 30% authenticated dashboard summary API
- 15% public registration state API
- 10% authenticated login-page redirect
- 250–1,000 ms think time per virtual user
- 10-second request timeout

## Results

| Stage | Requests | Throughput | Error rate | p95 | p99 | Result |
|---|---:|---:|---:|---:|---:|---|
| 5 users | 40 | 7.32 req/s | 0% | 15.10 ms | 17.29 ms | Pass |
| 50 users | 810 | 74.02 req/s | 0% | 31.81 ms | 55.05 ms | Pass |
| 100 users | 2,001 | 154.67 req/s | 0% | 17.14 ms | 90.42 ms | Pass |
| 200 users | 4,839 | 303.38 req/s | 0% | 7.25 ms | 109.82 ms | Pass |
| 300 users | 9,627 | 460.26 req/s | 0% | 4.93 ms | 147.31 ms | Pass |
| 350 users | 11,287 | 538.42 req/s | 0% | 10.82 ms | 206.87 ms | Pass |
| 400 users, run 1 | 12,903 | 616.75 req/s | 0.558% | 5.66 ms | 156.48 ms | Pass by gate, unstable |
| 400 users, repeat | 12,663 | 604.49 req/s | **1.785%** | 63.83 ms | 678.53 ms | **Fail** |

The repeat 400-user run had 226 `TypeError:ECONNRESET` failures across every route, indicating transport/server connection resets rather than a single broken endpoint. The Next.js process did not crash and still returned HTTP 200 after the run. Observed RSS grew from about 105 MB before load to about 317 MB after all runs; sampled CPU peaked around 46%.

## Findings

### P1 — 400-user connection reliability failure (observed)

At 400 simultaneous virtual users the local server reset connections. The issue reproduced twice and disappeared at 350 users. Production should not be declared safe for 400 active users until this is reproduced in staging behind the real reverse proxy and eliminated or kept below the agreed error budget.

### P1 — Registration writes serialize on one database row (code risk, not exercised)

Every public registration starts a transaction and locks the singleton `app_state` row with `FOR UPDATE`. It then scans, renumbers, serializes, and rewrites the registrations JSON array. Concurrent registrations therefore queue behind one hot row, with work increasing as the array grows.

### P2 — Live registration polling can create synchronized database bursts (code risk)

Each visible Workshop Master client polls every four seconds. Four hundred aligned clients can create roughly 100 requests/second. Each request computes an MD5 over the full registrations JSON and may then query the full JSON again.

### P2 — Public registration reads over-fetch application state (code risk)

The public endpoint calls `getAppState()`, which selects every application-state JSON column, but returns only forms, landing pages, registration links, and workshops. With real data this increases database transfer, JSON parsing, memory, and response time.

### P2 — Database pool has implicit defaults and no explicit timeouts (code risk)

The PostgreSQL pool is created with only a connection string. Capacity, connection wait behavior, idle timeout, statement timeout, and slow-query visibility are not explicitly controlled.

### P2 — Login throttling is process-local (code risk)

Login attempts are stored in an in-memory `Map`. Limits will differ between replicas and reset on deployment; expired entries are not proactively removed, allowing the map to grow under many unique source IPs.

## Recommended Next Test

Run the same scripts against a staging deployment with production-equivalent proxy limits and a disposable production-shaped PostgreSQL database. Add separate scenarios for login bursts, 400 live-registration pollers, and concurrent registration POSTs. Capture reverse-proxy reset reasons, Node event-loop delay, database pool wait time, lock wait time, slow queries, and memory over a 15-minute 400-user hold.

## Reproduction

The dependency-free runner is `scripts/load/run-local-400.mjs`. A generated k6 scenario is also available at `scripts/load/cfl-dashboard-400.js` for environments with k6 installed.
