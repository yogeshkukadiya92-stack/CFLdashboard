CREATE TABLE IF NOT EXISTS cfl_payment_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  payment_id TEXT NOT NULL DEFAULT '',
  registration_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  method TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE cfl_payment_events ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS cfl_payment_events_created_idx ON cfl_payment_events (created_at DESC);
CREATE INDEX IF NOT EXISTS cfl_payment_events_registration_idx ON cfl_payment_events (registration_id, created_at DESC);
