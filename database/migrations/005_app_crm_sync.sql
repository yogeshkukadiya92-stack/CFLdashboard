-- Phase 5: idempotent Android <-> Company CRM delta sync.

ALTER TABLE callflow_call_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE callflow_call_events ADD COLUMN IF NOT EXISTS sim_label text;
ALTER TABLE callflow_call_events ADD COLUMN IF NOT EXISTS phone_account_id text;
ALTER TABLE callflow_lead_notes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE callflow_lead_notes ADD COLUMN IF NOT EXISTS call_id uuid;

DO $$ BEGIN
  ALTER TABLE callflow_lead_notes ADD CONSTRAINT callflow_lead_notes_call_fk FOREIGN KEY (tenant_id,call_id) REFERENCES callflow_call_events(tenant_id,id) ON DELETE SET NULL (call_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS callflow_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9_]{1,60}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  requires_note boolean NOT NULL DEFAULT false,
  requires_follow_up boolean NOT NULL DEFAULT false,
  target_stage text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code), UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_call_dispositions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  call_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  disposition_id uuid,
  disposition_code text NOT NULL,
  note text,
  meeting_link text,
  created_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, call_id),
  FOREIGN KEY (tenant_id, call_id) REFERENCES callflow_call_events(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, lead_id) REFERENCES callflow_leads(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, created_by_membership_id) REFERENCES callflow_memberships(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_sync_receipts (
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  event_uuid uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES callflow_users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, event_uuid)
);

CREATE TABLE IF NOT EXISTS callflow_sync_tombstones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('LEAD','FOLLOW_UP')),
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES callflow_users(id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id), UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS callflow_assignment_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES callflow_companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES callflow_users(id) ON DELETE CASCADE,
  assigned boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  FOREIGN KEY (tenant_id,lead_id) REFERENCES callflow_leads(tenant_id,id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS callflow_sync_receipts_user_idx ON callflow_sync_receipts (tenant_id,user_id,received_at DESC);
CREATE INDEX IF NOT EXISTS callflow_sync_tombstones_cursor_idx ON callflow_sync_tombstones (tenant_id,user_id,deleted_at,id);
CREATE INDEX IF NOT EXISTS callflow_call_dispositions_lead_idx ON callflow_call_dispositions (tenant_id,lead_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS callflow_dispositions_order_idx ON callflow_dispositions (tenant_id,active,sort_order,id);
CREATE INDEX IF NOT EXISTS callflow_assignment_changes_cursor_idx ON callflow_assignment_changes (tenant_id,user_id,changed_at,id);
CREATE INDEX IF NOT EXISTS callflow_calls_member_sync_idx ON callflow_call_events (tenant_id,salesperson_membership_id,updated_at,id);
CREATE INDEX IF NOT EXISTS callflow_notes_sync_idx ON callflow_lead_notes (tenant_id,updated_at,id);
CREATE INDEX IF NOT EXISTS callflow_followups_sync_idx ON callflow_follow_ups (tenant_id,updated_at,id);
CREATE INDEX IF NOT EXISTS callflow_stages_sync_idx ON callflow_lead_stages (tenant_id,updated_at,id);
CREATE INDEX IF NOT EXISTS callflow_dispositions_sync_idx ON callflow_dispositions (tenant_id,updated_at,id);

DO $$
DECLARE target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['callflow_dispositions','callflow_call_dispositions','callflow_sync_receipts','callflow_sync_tombstones','callflow_assignment_changes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', target_table || '_tenant_isolation', target_table);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (callflow_is_owner_admin() OR tenant_id = callflow_current_tenant_id()) WITH CHECK (callflow_is_owner_admin() OR tenant_id = callflow_current_tenant_id())', target_table || '_tenant_isolation', target_table);
  END LOOP;
END $$;

INSERT INTO callflow_dispositions (tenant_id,code,name,requires_note,requires_follow_up,target_stage,sort_order)
SELECT company.id, seed.code, seed.name, seed.requires_note, seed.requires_follow_up, seed.target_stage, seed.sort_order
FROM callflow_companies company CROSS JOIN (VALUES
 ('WARM','Warm',false,false,'interested',10),('INVITE_INTRO','Invite intro',false,false,'contacted',20),
 ('CALLBACK_REQUESTED','Callback requested',false,true,'follow_up',30),('MEETING_BOOKED','Meeting booked',false,true,'interested',40),
 ('PROPOSAL_SENT','Proposal sent',false,true,'interested',50),('NOT_ELIGIBLE','Not eligible',true,false,'lost',60),
 ('NO_ANSWER','No answer',false,false,NULL,70),('WRONG_NUMBER','Wrong number',true,false,'lost',80),('CONVERTED','Converted',false,false,'won',90)
) AS seed(code,name,requires_note,requires_follow_up,target_stage,sort_order)
ON CONFLICT (tenant_id,code) DO NOTHING;
