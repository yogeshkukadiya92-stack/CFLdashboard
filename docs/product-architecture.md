# CFL OS Product Architecture

## Build Intent

CFL OS is a business operating system for training, coaching, workshop, education, event, consulting, and franchise businesses. The product should generate revenue, reduce manual operations, and become SaaS-ready after the MVP.

## Current Workspace Deliverable

- A working Next.js control-center prototype with Tailwind UI.
- Stateful CRM, pipeline, search, import/export, payment filters, AI assistant answers, theme toggle, and language mode controls.
- Scalable PostgreSQL schema baseline in `database/schema.sql`.
- Product modules represented in the UI: dashboard, CRM, sales, workshops, funnels, payments, marketing, reports, support, team, and security.

## Recommended Production Stack

- Frontend: Next.js, React, Tailwind CSS, shadcn-style local components.
- Backend: NestJS with modular domains.
- Database: PostgreSQL with tenant-aware tables and indexed mobile search.
- Cache/queues: Redis plus BullMQ for campaigns, imports, reminders, and report refresh.
- Storage: Cloudflare R2 or S3 for invoices, certificates, imports, exports, and media.
- Auth: Custom OTP or Auth.js/Clerk, with 2FA-ready device tracking.
- Payments: Razorpay Orders, Payments, Webhooks, Refunds, and signature verification.
- Messaging: WhatsApp Cloud API, email via Resend/SendGrid, SMS provider abstraction.

## NestJS Module Map

- `auth`: OTP, sessions, 2FA, device/IP tracking.
- `users`: staff, roles, permissions.
- `crm`: leads, clients, duplicate merge, tags, family groups.
- `sales`: assignment, follow-ups, targets, incentives, leaderboards.
- `workshops`: workshops, batches, trainers, waitlist, attendance, feedback.
- `funnels`: landing pages, coupons, registration flows, thank-you pages.
- `payments`: Razorpay, invoices, installments, refunds, retries.
- `marketing`: campaigns, segments, drips, referrals, rejoin journeys.
- `reports`: daily/sales/revenue/workshop/batch/city/repeat/failed payment reports.
- `support`: tickets, complaints, refund requests, satisfaction.
- `ai`: lead scoring, follow-up scripts, growth insights, founder assistant.
- `audit`: activity logs, data export logs, payment event logs.

## Data Scale Rules

- Store normalized mobile numbers in generated columns and index by `(tenant_id, mobile_normalized)`.
- Keep CRM lists paginated with cursor pagination for large data.
- Use background jobs for imports, exports, duplicate detection, campaign sends, and reports.
- Partition very large audit tables by time.
- Use materialized views for daily revenue and workshop analytics.
- Keep `tenant_id` on every domain table from day one so SaaS migration is not a rewrite.

## Phase Roadmap

### Phase 1 MVP

- OTP login, roles, dashboard, CRM, workshop creation, registration pages, Razorpay, clients, batches, basic reports, WhatsApp notifications, mobile search, CSV import/export, basic analytics.

### Phase 2 Pro

- Sales automation, lead scoring, AI follow-up, advanced reports, team dashboards, refunds, coupons, bulk campaigns, QR attendance, certificate generation, revenue forecasting, duplicate merge, segmentation.

### Phase 3 Enterprise/SaaS

- Multi-branch tenants, white-label, subscription billing, workflow builder, AI founder assistant, API marketplace, custom modules, predictive analytics, call center integrations, full multilingual support.

## Security Checklist

- Verify Razorpay webhook signatures server-side.
- Enforce role permissions at API guard and UI menu levels.
- Log every write operation in `activity_logs`.
- Add rate limits to OTP, search, imports, and campaign sends.
- Encrypt secrets with provider-managed secret storage.
- Back up Postgres daily and export critical files to R2/S3.
- Track device, IP, user agent, and last login.
