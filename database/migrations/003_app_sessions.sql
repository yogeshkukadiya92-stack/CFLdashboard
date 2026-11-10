-- Phase 3: device-bound mobile sessions with refresh rotation and bounded offline access.

ALTER TABLE callflow_user_sessions ADD COLUMN IF NOT EXISTS refresh_token_hash char(64);
ALTER TABLE callflow_user_sessions ADD COLUMN IF NOT EXISTS install_id text;
ALTER TABLE callflow_user_sessions ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE callflow_user_sessions ADD COLUMN IF NOT EXISTS app_version text;
ALTER TABLE callflow_user_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE callflow_user_sessions ADD COLUMN IF NOT EXISTS offline_valid_until timestamptz NOT NULL DEFAULT (now() + interval '72 hours');

CREATE UNIQUE INDEX IF NOT EXISTS callflow_user_sessions_refresh_uidx
  ON callflow_user_sessions (refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;

WITH duplicates AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS position
  FROM callflow_user_sessions WHERE revoked_at IS NULL
)
UPDATE callflow_user_sessions SET revoked_at = now(), revoke_reason = 'phase_3_single_device_migration'
WHERE id IN (SELECT id FROM duplicates WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS callflow_user_one_active_device_uidx
  ON callflow_user_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS callflow_user_sessions_install_idx
  ON callflow_user_sessions (tenant_id, user_id, install_id, expires_at DESC);

COMMENT ON INDEX callflow_user_one_active_device_uidx IS
  'Database-enforced one-active-phone rule; login locks the user before revoking and replacing the session.';
