# Attendance, payments and all registrations

Implemented in the MCP server; live database migration and connection must still
be completed. Both local stdio and remote OAuth clients use these datasets.

| Dataset | Data |
| --- | --- |
| registrations | Live registrations: name, mobile, email, city, workshop, batch, registration number, status, confirmation/waiting status, attendance match, source, payment mode, paid and due balances |
| crm_registrations | CRM history, including imported registrations, client/external IDs, salesperson and payment balances |
| attendance | Every attendance entry: attendee contacts, workshop, batch, session title/date, status, check-in/join/leave times and duration |
| payments | Every gateway payment event: transaction and registration IDs, status, amount, currency, method, applied time and associated registration contacts |

The existing workshop and summary datasets remain available. CRM summary counts
refer to normalized CRM tables, not the live registration list.

Run `database/mcp_business_records.sql` as the database owner after the original
reader setup and application schemas exist. This migration creates read-only
views and grants access to the existing reader. It does not recreate the role or
change business records. It requires `app_state`, `cfl_registration_records`,
the normalized CRM tables and `cfl_payment_events` (created by the app's payment
setup). The reader receives no base-table or raw helper-payload permissions.
Keep `MCP_DATABASE_URL` private and use only the dedicated reader role.

For the remote endpoint, deploy the new code with the migration. Built-in OAuth
consent now explains the expanded data access. Its consent version changed so
previous built-in grants stop working and require a new login and consent.
External OAuth deployments must review the approved subject list before exposing
the expanded views; existing `cfl:read` tokens can read the new datasets.

Call `list_datasets`, then `browse_records` with the chosen dataset. Optional
filters: `query` searches name, mobile, email, workshop name or record ID;
`workshop_id` and `status` are exact matches; `date_from` and `date_to` are
inclusive YYYY-MM-DD values. Dates use the stored date for live/attendance
records and Asia/Kolkata for database timestamps in CRM/payment events.

```json
{"dataset":"attendance","workshop_id":"workshop-123","date_from":"2026-09-01","date_to":"2026-09-30","limit":50}
```

Follow `next_cursor` as `after_id` while `has_more` is true. All records are
accessible through pages of up to 50. Text IDs are ordered lexically, not by date;
concurrent inserts/changes mean a multi-page read is not a frozen snapshot.

Payment events can contain several lifecycle events for the same transaction.
Do not sum all events as collected money. Manual payments and outstanding
balances are available in registration datasets, not gateway events. CRM and
live records may overlap; reconcile using external/registration IDs before
combining totals. Live snapshots take precedence over durable record payloads
because payment automation currently updates that snapshot.

Custom form answers, medical details, raw webhook payloads, private meeting URLs,
passwords and integration credentials are excluded. This exposes all rows of the
requested business datasets with explicit columns, not unrestricted database SQL.
