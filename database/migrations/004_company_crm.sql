-- Phase 4: tenant-isolated company CRM lead workflows.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS imported_at timestamptz;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE TABLE IF NOT EXISTS callflow_company_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES callflow_users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[a-z0-9_]{1,40}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  color text NOT NULL DEFAULT '#6366f1' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_lead_activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  actor_membership_id uuid,
  kind text NOT NULL CHECK (kind IN ('created','imported','assigned','stage_changed','duplicate_flagged','merged','note')),
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, lead_id) REFERENCES callflow_leads(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, actor_membership_id) REFERENCES callflow_memberships(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_lead_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  actor_membership_id uuid,
  file_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing','completed','failed')),
  total_rows integer NOT NULL DEFAULT 0,
  created_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, actor_membership_id) REFERENCES callflow_memberships(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS callflow_company_sessions_active_idx ON callflow_company_sessions (token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_stages_tenant_order_idx ON callflow_lead_stages (tenant_id, active, sort_order, id);
CREATE INDEX IF NOT EXISTS callflow_leads_filter_idx ON callflow_leads (tenant_id, stage, source, quality, score DESC, updated_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_leads_created_idx ON callflow_leads (tenant_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_leads_assigned_idx ON callflow_leads (tenant_id, assigned_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_leads_name_search_idx ON callflow_leads USING gin (lower(name) gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_leads_company_search_idx ON callflow_leads USING gin (lower(company_name) gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_activities_lead_idx ON callflow_lead_activities (tenant_id, lead_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS callflow_imports_tenant_idx ON callflow_lead_imports (tenant_id, created_at DESC, id DESC);

ALTER TABLE callflow_company_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_company_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE callflow_lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_lead_stages FORCE ROW LEVEL SECURITY;
ALTER TABLE callflow_lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_lead_activities FORCE ROW LEVEL SECURITY;
ALTER TABLE callflow_lead_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_lead_imports FORCE ROW LEVEL SECURITY;

DO $$
DECLARE target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['callflow_company_sessions','callflow_lead_stages','callflow_lead_activities','callflow_lead_imports'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', target_table || '_tenant_isolation', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (callflow_is_owner_admin() OR tenant_id = callflow_current_tenant_id()) WITH CHECK (callflow_is_owner_admin() OR tenant_id = callflow_current_tenant_id())',
      target_table || '_tenant_isolation', target_table
    );
  END LOOP;
END $$;

COMMENT ON TABLE callflow_lead_activities IS 'Immutable, tenant-scoped basic lead timeline for Company CRM operations.';
