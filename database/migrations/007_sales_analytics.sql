-- Phase 7: reconciled sales analytics summaries. Source tables remain authoritative.

CREATE TABLE IF NOT EXISTS callflow_daily_sales_summary (
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  membership_id uuid,
  source text NOT NULL DEFAULT 'unknown',
  leads_created integer NOT NULL DEFAULT 0,
  leads_contacted integer NOT NULL DEFAULT 0,
  leads_won integer NOT NULL DEFAULT 0,
  leads_lost integer NOT NULL DEFAULT 0,
  leads_opted_out integer NOT NULL DEFAULT 0,
  calls_total integer NOT NULL DEFAULT 0,
  calls_connected integer NOT NULL DEFAULT 0,
  talk_seconds bigint NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id,summary_date,membership_id,source),
  FOREIGN KEY (tenant_id,membership_id) REFERENCES callflow_memberships(tenant_id,id) ON DELETE SET NULL (membership_id)
);

CREATE INDEX IF NOT EXISTS callflow_daily_summary_range_idx ON callflow_daily_sales_summary (tenant_id,summary_date DESC,membership_id,source);
CREATE INDEX IF NOT EXISTS callflow_daily_summary_source_idx ON callflow_daily_sales_summary (tenant_id,source,summary_date DESC);
CREATE INDEX IF NOT EXISTS callflow_calls_analytics_idx ON callflow_call_events (tenant_id,started_at DESC,salesperson_membership_id,result) INCLUDE (lead_id,duration_seconds);
CREATE INDEX IF NOT EXISTS callflow_leads_outcome_analytics_idx ON callflow_leads (tenant_id,created_at DESC,stage,source,assigned_membership_id) INCLUDE (score,quality,first_contacted_at,opted_out_at) WHERE deleted_at IS NULL;

ALTER TABLE callflow_daily_sales_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE callflow_daily_sales_summary FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS callflow_daily_sales_summary_tenant_isolation ON callflow_daily_sales_summary;
CREATE POLICY callflow_daily_sales_summary_tenant_isolation ON callflow_daily_sales_summary FOR ALL
USING (callflow_is_owner_admin() OR tenant_id=callflow_current_tenant_id())
WITH CHECK (callflow_is_owner_admin() OR tenant_id=callflow_current_tenant_id());
