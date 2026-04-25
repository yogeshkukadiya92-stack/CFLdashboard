# CFL OS

AI-powered Business Operating System for workshop, training, coaching, education, and event businesses.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## What Is Built

- Premium SaaS dashboard inspired by the generated CFL OS product concept.
- Universal mobile search.
- CRM lead database and detail profile.
- Pipeline movement and AI follow-up surfaces.
- Workshop, batch, attendance, funnel, payment, marketing, reports, support, team, and security modules.
- CSV import/export for leads.
- Dark/light mode and EN/HI/GU mode toggle.
- PostgreSQL SaaS schema baseline in `database/schema.sql`.

## Production Path

Use this frontend as the product shell, then add a NestJS API backed by PostgreSQL, Redis queues, Razorpay webhooks, WhatsApp/Email/SMS providers, and tenant-aware authorization.
