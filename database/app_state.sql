CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY,
  clients JSONB NOT NULL DEFAULT '[]'::jsonb,
  leads JSONB NOT NULL DEFAULT '[]'::jsonb,
  workshops JSONB NOT NULL DEFAULT '[]'::jsonb,
  registrations JSONB NOT NULL DEFAULT '[]'::jsonb,
  schedules JSONB NOT NULL DEFAULT '[]'::jsonb,
  forms JSONB NOT NULL DEFAULT '[]'::jsonb,
  registration_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  sales_people JSONB NOT NULL DEFAULT '[]'::jsonb,
  workshop_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  facilitators JSONB NOT NULL DEFAULT '[]'::jsonb,
  integrations JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_state ADD COLUMN IF NOT EXISTS clients JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS leads JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS workshops JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS registrations JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS schedules JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS forms JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS registration_links JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS sales_people JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS workshop_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS facilitators JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS integrations JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO app_state (
  id,
  clients,
  leads,
  workshops,
  registrations,
  schedules,
  forms,
  registration_links,
  sales_people,
  workshop_types,
  facilitators,
  integrations
)
VALUES (
  1,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
