-- Phase 6: availability-aware assignment and actionable sales workflow controls.

ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS first_contacted_at timestamptz;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS next_action_type text;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS opted_out_at timestamptz;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS opt_out_reason text;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE callflow_leads ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE TABLE IF NOT EXISTS callflow_workflow_settings (
  tenant_id uuid PRIMARY KEY REFERENCES callflow_companies(id) ON DELETE CASCADE,
  auto_assign_enabled boolean NOT NULL DEFAULT true,
  first_response_minutes integer NOT NULL DEFAULT 30 CHECK (first_response_minutes BETWEEN 5 AND 10080),
  stalled_hours integer NOT NULL DEFAULT 48 CHECK (stalled_hours BETWEEN 1 AND 8760),
  ageing_days integer NOT NULL DEFAULT 14 CHECK (ageing_days BETWEEN 1 AND 3650),
  require_next_action boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS callflow_sales_availability (
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL,
  accepting_leads boolean NOT NULL DEFAULT true,
  leave_until timestamptz,
  daily_capacity integer NOT NULL DEFAULT 100 CHECK (daily_capacity BETWEEN 1 AND 10000),
  max_active_leads integer NOT NULL DEFAULT 500 CHECK (max_active_leads BETWEEN 1 AND 100000),
  last_assigned_at timestamptz,
  last_latitude numeric(9,6),
  last_longitude numeric(9,6),
  last_accuracy_meters numeric(10,2),
  last_location_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,membership_id),
  FOREIGN KEY (tenant_id,membership_id) REFERENCES callflow_memberships(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE callflow_sales_availability ADD COLUMN IF NOT EXISTS last_latitude numeric(9,6);
ALTER TABLE callflow_sales_availability ADD COLUMN IF NOT EXISTS last_longitude numeric(9,6);
ALTER TABLE callflow_sales_availability ADD COLUMN IF NOT EXISTS last_accuracy_meters numeric(10,2);
ALTER TABLE callflow_sales_availability ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

CREATE TABLE IF NOT EXISTS callflow_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  priority integer NOT NULL DEFAULT 100,
  source_equals text,
  city_equals text,
  quality_equals text,
  minimum_score smallint CHECK (minimum_score IS NULL OR minimum_score BETWEEN 0 AND 100),
  target_membership_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  FOREIGN KEY (tenant_id,target_membership_id) REFERENCES callflow_memberships(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS callflow_manager_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('first_response_overdue','next_action_missing','next_action_overdue','stalled','ageing','sync_failure')),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,lead_id,kind), UNIQUE (tenant_id,id),
  FOREIGN KEY (tenant_id,lead_id) REFERENCES callflow_leads(tenant_id,id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS callflow_availability_eligible_idx ON callflow_sales_availability (tenant_id,accepting_leads,leave_until,last_assigned_at,membership_id);
CREATE INDEX IF NOT EXISTS callflow_rules_priority_idx ON callflow_assignment_rules (tenant_id,active,priority,id);
CREATE INDEX IF NOT EXISTS callflow_leads_unassigned_idx ON callflow_leads (tenant_id,created_at,id) WHERE assigned_membership_id IS NULL AND deleted_at IS NULL AND opted_out_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_leads_first_response_idx ON callflow_leads (tenant_id,first_contacted_at,created_at,id) WHERE deleted_at IS NULL AND opted_out_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_leads_next_action_idx ON callflow_leads (tenant_id,next_action_at,id) WHERE deleted_at IS NULL AND opted_out_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_alerts_open_idx ON callflow_manager_alerts (tenant_id,status,severity,updated_at DESC,id DESC);

DO $$
DECLARE target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['callflow_workflow_settings','callflow_sales_availability','callflow_assignment_rules','callflow_manager_alerts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I',target_table||'_tenant_isolation',target_table);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (callflow_is_owner_admin() OR tenant_id=callflow_current_tenant_id()) WITH CHECK (callflow_is_owner_admin() OR tenant_id=callflow_current_tenant_id())',target_table||'_tenant_isolation',target_table);
  END LOOP;
END $$;

INSERT INTO callflow_workflow_settings (tenant_id) SELECT id FROM callflow_companies ON CONFLICT (tenant_id) DO NOTHING;
