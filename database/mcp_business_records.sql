-- Extend the existing MCP reader with the user's requested business datasets.
-- Requires mcp_readonly.sql and existing app/CRM/payment tables. No writes to business records.
BEGIN;
-- Fail if the existing reader/schema has not been provisioned.
SELECT 'cfl_mcp_reader'::regrole;

-- Payment automation currently updates app_state; prefer that snapshot over stale
-- per-record payloads, retaining records that are present only in the durable table.
CREATE OR REPLACE VIEW cfl_mcp.registration_source AS
  SELECT DISTINCT ON (id) id, payload
  FROM (
    SELECT item->>'id' AS id, item AS payload, 0 AS priority
    FROM public.app_state s CROSS JOIN LATERAL jsonb_array_elements(s.registrations) item
    WHERE s.id = 1 AND COALESCE(item->>'id', '') <> ''
    UNION ALL
    SELECT external_id, payload, 1 FROM public.cfl_registration_records
  ) records ORDER BY id, priority;

CREATE OR REPLACE VIEW cfl_mcp.registrations AS
  SELECT id, payload->>'fullName' AS name, payload->>'mobile' AS mobile,
    payload->>'email' AS email, payload->>'city' AS city,
    payload->>'workshopId' AS workshop_id, payload->>'workshopTitle' AS workshop_name,
    payload->>'batch' AS batch, payload->>'status' AS status,
    payload->>'createdAt' AS recorded_at, payload->>'registrationNumber' AS registration_number,
    payload->>'paymentMode' AS payment_mode,
    payload->>'amountPaid' AS amount_paid, payload->>'amountDue' AS amount_due,
    payload->>'confirmationStatus' AS confirmation_status,
    payload->>'waitingReason' AS waiting_reason,
    payload->>'attendanceMatched' AS attendance_matched, payload->>'source' AS source
  FROM cfl_mcp.registration_source;

CREATE OR REPLACE VIEW cfl_mcp.crm_registrations AS
  SELECT r.id, c.name, c.mobile, c.email, c.city, r.workshop_id::text AS workshop_id,
    w.name AS workshop_name, b.batch_label AS batch, r.status,
    to_char(r.registered_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS') AS recorded_at,
    r.external_id, r.client_id, r.payment_mode, r.amount_paid, r.amount_due,
    r.salesperson, r.is_legacy
  FROM public.crm_registrations r
  JOIN public.crm_clients c ON c.id = r.client_id AND c.tenant_id = r.tenant_id
  JOIN public.crm_workshop_masters w ON w.id = r.workshop_id AND w.tenant_id = r.tenant_id
  JOIN public.crm_workshop_batches b ON b.id = r.workshop_batch_id AND b.tenant_id = r.tenant_id
  WHERE r.tenant_id = 'cfl';

CREATE OR REPLACE VIEW cfl_mcp.attendance AS
  SELECT item->>'id' AS id, item->>'attendeeName' AS name,
    item->>'mobile' AS mobile, item->>'email' AS email, item->>'city' AS city,
    item->>'workshopId' AS workshop_id, item->>'workshopName' AS workshop_name,
    item->>'batch' AS batch, item->>'status' AS status,
    item->>'submittedAt' AS recorded_at, item->>'sessionId' AS session_id,
    session->>'title' AS session_title, session->>'sessionDate' AS session_date,
    item->>'checkInAt' AS check_in_at, item->>'joinedZoomAt' AS joined_zoom_at,
    item->>'leftZoomAt' AS left_zoom_at, item->>'durationMinutes' AS duration_minutes,
    item->>'source' AS source
  FROM public.app_state s
  CROSS JOIN LATERAL jsonb_array_elements(s.attendance_entries) item
  LEFT JOIN LATERAL (
    SELECT value AS session FROM jsonb_array_elements(s.attendance_sessions)
    WHERE value->>'id' = item->>'sessionId' LIMIT 1
  ) matched ON true
  WHERE s.id = 1 AND COALESCE(item->>'id', '') <> '';

CREATE OR REPLACE VIEW cfl_mcp.payments AS
  SELECT p.id, r.name, r.mobile, r.email, r.workshop_id, r.workshop_name,
    p.registration_id, p.payment_id, p.event_name, p.status, p.amount,
    p.currency, p.method, p.applied_at,
    to_char(p.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS') AS recorded_at
  FROM public.cfl_payment_events p
  LEFT JOIN cfl_mcp.registrations r ON r.id = p.registration_id;

REVOKE ALL ON cfl_mcp.registration_source, cfl_mcp.registrations,
  cfl_mcp.crm_registrations, cfl_mcp.attendance, cfl_mcp.payments FROM PUBLIC;
-- The helper's raw payload is deliberately not granted to the reader.
GRANT SELECT ON cfl_mcp.registrations, cfl_mcp.crm_registrations,
  cfl_mcp.attendance, cfl_mcp.payments TO cfl_mcp_reader;
COMMIT;
