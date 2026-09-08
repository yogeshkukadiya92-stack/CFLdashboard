# CFL OS

AI-powered Business Operating System for workshop, training, coaching, education, and event businesses.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## What Is Built

- Master-admin login (HMAC-signed session cookie) protecting every admin route.
- Premium admin dashboard with live KPIs sourced from saved data.
- Command palette in the header — press `Ctrl/Cmd + K`, then use arrow keys + Enter to jump to any page.
- Workshop Master, Workshop Scheduling, Manage Client, Sales Person, Process, and Reports modules.
- Excel/CSV import, duplicate-merge, and export for clients and workshops.
- Indexed PostgreSQL CRM tables for large client and registration history.
- Historical Data workspace with server-side search and cursor pagination.
- Public workshop registration page at `/register/[slug]` with full/part payment capture.
- Optional Razorpay order + webhook endpoints and an optional PostgreSQL persistence layer (`database/schema.sql`).

## PostgreSQL Persistence

Set `DATABASE_URL` to enable persistence. The application creates the additive `app_state` compatibility table and normalized `crm_*` tables automatically. Existing `app_state` data is preserved.

Required production variables:

```bash
DATABASE_URL=postgres://user:password@host:5432/database
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_strong_password
AUTH_SECRET=replace_with_a_long_random_secret
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

`ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `AUTH_SECRET` are required in production. The local development defaults are intentionally disabled for deployed builds.

## Coolify: four workers on one server

Build with `npm run build` and start with `npm run start` (not `next start`,
which bypasses the worker supervisor). Route the Coolify proxy to port 3000.
Use one application container with these runtime environment variables:

```bash
WEB_CONCURRENCY=4
DB_POOL_MAX=5
REGISTRATION_DB_POOL_MAX=5
```

Set these explicitly in Coolify: existing environment values override the new
defaults, and `.env.example` is not loaded automatically. Redeploy to activate.
Configure Coolify's HTTP health check as `/api/health` on port 3000; it returns
200 only when the database and registration storage are ready. Allow startup
time for database initialization before marking the container unhealthy.
Allow at least four CPUs for the container; the supervisor caps workers to the
CPUs available to it. Startup logs should show `CFL server: 4 web processes`.
The supervisor distributes new connections across workers and restarts failed
workers. Keep-alive requests may stay on their existing worker.

The two database pools reserve up to 10 connections per worker: 40 per container,
or 80 while old and new containers overlap during deployment. Leave additional
database capacity for other clients and administration. Check the database's
connection limit before deployment. Use a termination grace period of at least
35 seconds to allow the supervisor's 30-second shutdown window.

Validate on staging with representative registrations and dashboard requests,
increasing concurrency gradually while monitoring latency, errors, CPU, memory,
and database connections. More workers do not eliminate queues or database
contention. This setup does not protect against failure of the physical server.
Existing process-local login attempt limits remain per worker, not global.

## Historical Member Import

The importer streams the oversized worksheet instead of loading all rows into browser memory. It is resumable and idempotent by file hash, source row, and normalized row hash.

Validate without changing the database:

```bash
npm run import:members -- --file /absolute/path/Member-details.xlsx --dry-run
```

Import through the authenticated deployed application:

```bash
CFL_ADMIN_EMAIL=admin@example.com \
CFL_ADMIN_PASSWORD=your_password \
npm run import:members -- \
  --file /absolute/path/Member-details.xlsx \
  --app-url https://your-domain.example
```

Confirmed source mapping:

- `fname` -> facilitator, with `LUV PATEL` merged into `Dr Luv Patel`.
- `status S` -> `Success`.
- `status P` -> `Failed`.
- `status R` -> `Refund`.
- Trailing ` - N` workshop suffix -> historical batch number.

Expected reconciliation for `Member-details.xlsx`: 430,178 source rows, 228,874 client identities, 166 workshop masters, 657 historical batches, 15 facilitators, and 182 exact duplicate rows retained in the import audit.
