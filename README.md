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
- Public workshop registration page at `/register/[slug]` with full/part payment capture.
- Optional Razorpay order + webhook endpoints and an optional PostgreSQL persistence layer (`database/schema.sql`).

## Production Path

Use this frontend as the product shell, then add a NestJS API backed by PostgreSQL, Redis queues, Razorpay webhooks, WhatsApp/Email/SMS providers, and tenant-aware authorization.
