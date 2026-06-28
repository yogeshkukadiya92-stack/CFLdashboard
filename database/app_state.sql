CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY,
  clients JSONB NOT NULL DEFAULT '[]'::jsonb,
  leads JSONB NOT NULL DEFAULT '[]'::jsonb,
  workshops JSONB NOT NULL DEFAULT '[]'::jsonb,
  integrations JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_state
ADD COLUMN IF NOT EXISTS clients JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE app_state
ADD COLUMN IF NOT EXISTS integrations JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO app_state (id, clients, leads, workshops, integrations)
VALUES (1, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
