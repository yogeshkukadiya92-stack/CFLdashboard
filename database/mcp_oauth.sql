-- Manually provision after review; never accessible to cfl_mcp_reader.
BEGIN;
CREATE SCHEMA IF NOT EXISTS cfl_oauth;
REVOKE ALL ON SCHEMA cfl_oauth FROM PUBLIC;
CREATE TABLE IF NOT EXISTS cfl_oauth.grants (
  id uuid PRIMARY KEY,
  consent_id uuid NOT NULL UNIQUE,
  client_id text NOT NULL,
  client_stamp text NOT NULL,
  admin_stamp text NOT NULL,
  resource text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS cfl_oauth.codes (
  hash text PRIMARY KEY,
  grant_id uuid NOT NULL REFERENCES cfl_oauth.grants(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE TABLE IF NOT EXISTS cfl_oauth.tokens (
  hash text PRIMARY KEY,
  grant_id uuid NOT NULL REFERENCES cfl_oauth.grants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('access', 'refresh')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS cfl_oauth_tokens_grant_idx ON cfl_oauth.tokens(grant_id);
CREATE INDEX IF NOT EXISTS cfl_oauth_codes_grant_idx ON cfl_oauth.codes(grant_id);
REVOKE ALL ON ALL TABLES IN SCHEMA cfl_oauth FROM PUBLIC;
COMMIT;
-- Run as the application DATABASE_URL owner, or explicitly grant that runtime
-- role USAGE plus SELECT/INSERT/UPDATE on these three tables (not the MCP reader).
-- Keep replay evidence for each grant's lifetime; expired grants may be cleaned
-- up by the administrator later. No cleanup/deletion is run automatically.
