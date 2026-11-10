-- CallFlow SaaS Phase 1 foundation.
-- Additive only: the existing CFL app_state and crm_* compatibility paths remain untouched.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION callflow_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('callflow.tenant_id', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS callflow_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  locale text NOT NULL DEFAULT 'en-IN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS callflow_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 160),
  mobile_normalized text CHECK (mobile_normalized IS NULL OR mobile_normalized ~ '^[0-9]{10,15}$'),
  email_normalized text CHECK (email_normalized IS NULL OR email_normalized = lower(email_normalized)),
  password_hash text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mobile_normalized IS NOT NULL OR email_normalized IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS callflow_users_mobile_uidx
  ON callflow_users (mobile_normalized) WHERE mobile_normalized IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS callflow_users_email_uidx
  ON callflow_users (email_normalized) WHERE email_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS callflow_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES callflow_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('company_manager', 'salesperson', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  external_id text,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  mobile_normalized text CHECK (mobile_normalized IS NULL OR mobile_normalized ~ '^[0-9]{10,15}$'),
  email_normalized text,
  source text NOT NULL DEFAULT 'manual',
  stage text NOT NULL DEFAULT 'new',
  quality text,
  score smallint CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  assigned_membership_id uuid,
  next_action_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, external_id),
  FOREIGN KEY (tenant_id, assigned_membership_id)
    REFERENCES callflow_memberships(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  lead_id uuid,
  salesperson_membership_id uuid,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  result text NOT NULL CHECK (result IN ('connected', 'missed', 'not_connected', 'cancelled')),
  phone_normalized text NOT NULL CHECK (phone_normalized ~ '^[0-9]{10,15}$'),
  sim_slot smallint CHECK (sim_slot IS NULL OR sim_slot BETWEEN 0 AND 7),
  started_at timestamptz NOT NULL,
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, event_key),
  FOREIGN KEY (tenant_id, lead_id) REFERENCES callflow_leads(tenant_id, id),
  FOREIGN KEY (tenant_id, salesperson_membership_id)
    REFERENCES callflow_memberships(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  author_membership_id uuid,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, lead_id) REFERENCES callflow_leads(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, author_membership_id)
    REFERENCES callflow_memberships(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  owner_membership_id uuid,
  kind text NOT NULL DEFAULT 'call',
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  note text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, lead_id) REFERENCES callflow_leads(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, owner_membership_id)
    REFERENCES callflow_memberships(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_outbox_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  topic text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, event_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES callflow_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  request_id text,
  ip_address inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS callflow_memberships_tenant_role_idx
  ON callflow_memberships (tenant_id, role, status, id);
CREATE INDEX IF NOT EXISTS callflow_memberships_user_idx
  ON callflow_memberships (user_id, status);
CREATE INDEX IF NOT EXISTS callflow_leads_tenant_updated_idx
  ON callflow_leads (tenant_id, updated_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_leads_owner_stage_idx
  ON callflow_leads (tenant_id, assigned_membership_id, stage, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_leads_mobile_idx
  ON callflow_leads (tenant_id, mobile_normalized, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_calls_lead_started_idx
  ON callflow_call_events (tenant_id, lead_id, started_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS callflow_calls_salesperson_started_idx
  ON callflow_call_events (tenant_id, salesperson_membership_id, started_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS callflow_calls_phone_started_idx
  ON callflow_call_events (tenant_id, phone_normalized, started_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS callflow_notes_lead_created_idx
  ON callflow_lead_notes (tenant_id, lead_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS callflow_followups_owner_due_idx
  ON callflow_follow_ups (tenant_id, owner_membership_id, status, due_at, id);
CREATE INDEX IF NOT EXISTS callflow_outbox_claim_idx
  ON callflow_outbox_jobs (status, available_at, id)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS callflow_audit_tenant_created_idx
  ON callflow_audit_logs (tenant_id, created_at DESC, id DESC);

DO $$
DECLARE target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'callflow_memberships', 'callflow_leads', 'callflow_call_events',
    'callflow_lead_notes', 'callflow_follow_ups', 'callflow_outbox_jobs',
    'callflow_audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
        AND policyname = target_table || '_tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (tenant_id = callflow_current_tenant_id()) WITH CHECK (tenant_id = callflow_current_tenant_id())',
        target_table || '_tenant_isolation', target_table
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION callflow_current_tenant_id() IS
  'Returns the transaction-local tenant selected by the trusted API layer; NULL means deny tenant rows.';
