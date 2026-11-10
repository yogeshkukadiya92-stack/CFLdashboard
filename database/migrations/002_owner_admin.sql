-- Phase 2: owner administration, commercial seat controls and revocable sessions.

CREATE OR REPLACE FUNCTION callflow_is_owner_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(current_setting('callflow.owner_admin', true), '') = 'true'
$$;

CREATE TABLE IF NOT EXISTS callflow_company_settings (
  tenant_id uuid PRIMARY KEY REFERENCES callflow_companies(id) ON DELETE CASCADE,
  purchased_seats integer NOT NULL DEFAULT 0 CHECK (purchased_seats BETWEEN 0 AND 100000),
  default_price_paise integer NOT NULL DEFAULT 0 CHECK (default_price_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  billing_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS callflow_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  membership_id uuid,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'suspended')),
  price_override_paise integer CHECK (price_override_paise IS NULL OR price_override_paise >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, membership_id),
  FOREIGN KEY (tenant_id, membership_id) REFERENCES callflow_memberships(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_owner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash char(64) NOT NULL UNIQUE,
  email_normalized text NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text
);

CREATE TABLE IF NOT EXISTS callflow_user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES callflow_users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_owner_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_email text NOT NULL,
  action text NOT NULL,
  tenant_id uuid REFERENCES callflow_companies(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text,
  request_id text,
  ip_address inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS callflow_seats_tenant_status_idx ON callflow_seats (tenant_id, status, id);
CREATE INDEX IF NOT EXISTS callflow_owner_sessions_expiry_idx ON callflow_owner_sessions (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_user_sessions_user_idx ON callflow_user_sessions (tenant_id, user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_owner_audit_created_idx ON callflow_owner_audit_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS callflow_owner_audit_tenant_idx ON callflow_owner_audit_logs (tenant_id, created_at DESC, id DESC);

ALTER TABLE callflow_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_company_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE callflow_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_seats FORCE ROW LEVEL SECURITY;
ALTER TABLE callflow_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_user_sessions FORCE ROW LEVEL SECURITY;

DO $$
DECLARE target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'callflow_memberships', 'callflow_leads', 'callflow_call_events', 'callflow_lead_notes',
    'callflow_follow_ups', 'callflow_outbox_jobs', 'callflow_audit_logs',
    'callflow_company_settings', 'callflow_seats', 'callflow_user_sessions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', target_table || '_tenant_isolation', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (callflow_is_owner_admin() OR tenant_id = callflow_current_tenant_id()) WITH CHECK (callflow_is_owner_admin() OR tenant_id = callflow_current_tenant_id())',
      target_table || '_tenant_isolation', target_table
    );
  END LOOP;
END $$;

COMMENT ON TABLE callflow_company_settings IS 'Commercial settings controlled only through Owner Admin APIs.';
COMMENT ON TABLE callflow_owner_audit_logs IS 'Append-only record of privileged owner actions; never exposed to company managers.';
