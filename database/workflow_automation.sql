CREATE TABLE IF NOT EXISTS cfl_automation_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  version INTEGER NOT NULL DEFAULT 1,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connections JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT 'Admin User',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfl_automation_workflow_versions (
  id BIGSERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES cfl_automation_workflows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'Admin User',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_id, version)
);

CREATE TABLE IF NOT EXISTS cfl_automation_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES cfl_automation_workflows(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'production')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  trigger_name TEXT NOT NULL,
  participant TEXT NOT NULL DEFAULT '',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS cfl_workflow_status_updated_idx
  ON cfl_automation_workflows (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS cfl_workflow_execution_workflow_started_idx
  ON cfl_automation_executions (workflow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS cfl_automation_schedule_runs (
  id BIGSERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES cfl_automation_workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','success','failed')),
  execution_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE (workflow_id,node_id,scheduled_for)
);
CREATE INDEX IF NOT EXISTS cfl_schedule_runs_created_idx ON cfl_automation_schedule_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS cfl_automation_approvals (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES cfl_automation_workflows(id) ON DELETE CASCADE,
  workflow_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_by TEXT NOT NULL,
  request_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  review_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS cfl_approval_one_pending_version_idx
  ON cfl_automation_approvals (workflow_id,workflow_version) WHERE status='pending';
CREATE INDEX IF NOT EXISTS cfl_approval_workflow_requested_idx
  ON cfl_automation_approvals (workflow_id,requested_at DESC);

CREATE TABLE IF NOT EXISTS cfl_automation_audit_log (
  id BIGSERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_version INTEGER,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cfl_audit_workflow_created_idx
  ON cfl_automation_audit_log (workflow_id,created_at DESC);

CREATE TABLE IF NOT EXISTS cfl_automation_incidents (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES cfl_automation_workflows(id) ON DELETE CASCADE,
  execution_id TEXT NOT NULL REFERENCES cfl_automation_executions(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  title TEXT NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  failed_node TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  acknowledged_by TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  UNIQUE (execution_id)
);
CREATE INDEX IF NOT EXISTS cfl_incident_workflow_status_created_idx
  ON cfl_automation_incidents (workflow_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS cfl_automation_enterprise_settings (
  workflow_id TEXT PRIMARY KEY REFERENCES cfl_automation_workflows(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NOT NULL DEFAULT 'Admin User',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfl_automation_credentials (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES cfl_automation_workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development','staging','production')),
  encrypted_value TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_id,name,environment)
);

CREATE TABLE IF NOT EXISTS cfl_automation_alert_outbox (
  id BIGSERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES cfl_automation_workflows(id) ON DELETE CASCADE,
  incident_id TEXT NOT NULL REFERENCES cfl_automation_incidents(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'dashboard',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE (incident_id,channel)
);
