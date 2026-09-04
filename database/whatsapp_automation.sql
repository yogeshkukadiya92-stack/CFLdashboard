CREATE TABLE IF NOT EXISTS cfl_whatsapp_messages (
  id UUID PRIMARY KEY,
  provider_message_id TEXT UNIQUE,
  registration_id TEXT,
  mobile TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text',
  template_name TEXT,
  message_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  retry_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 0 AND 10),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfl_whatsapp_webhook_events (
  event_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'meta',
  event_type TEXT NOT NULL,
  provider_message_id TEXT,
  mobile TEXT NOT NULL DEFAULT '',
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfl_whatsapp_retry_queue (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES cfl_whatsapp_messages(id) ON DELETE CASCADE,
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'exhausted')),
  next_attempt_at TIMESTAMPTZ NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, attempt_count)
);

CREATE INDEX IF NOT EXISTS cfl_whatsapp_messages_mobile_created_idx ON cfl_whatsapp_messages (mobile, created_at DESC);
CREATE INDEX IF NOT EXISTS cfl_whatsapp_messages_status_updated_idx ON cfl_whatsapp_messages (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS cfl_whatsapp_events_received_idx ON cfl_whatsapp_webhook_events (received_at DESC);
CREATE INDEX IF NOT EXISTS cfl_whatsapp_retry_due_idx ON cfl_whatsapp_retry_queue (status, next_attempt_at);
