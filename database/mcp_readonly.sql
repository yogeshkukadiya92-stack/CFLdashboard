-- REVIEW and run manually as the database owner only after approving this scope.
-- No personal, health, contact, credential, or payment data is exposed.
-- These views target the normalized CRM tables in lib/crm-db.ts, not schema.sql.
BEGIN;
CREATE SCHEMA IF NOT EXISTS cfl_mcp;
REVOKE ALL ON SCHEMA cfl_mcp FROM PUBLIC;
CREATE OR REPLACE VIEW cfl_mcp.workshops AS
  SELECT id, name, workshop_type, product_group, archived
  FROM public.crm_workshop_masters WHERE tenant_id = 'cfl';
CREATE OR REPLACE VIEW cfl_mcp.summary AS
  SELECT 1::bigint AS id,
    (SELECT count(*) FROM public.crm_clients WHERE tenant_id = 'cfl' AND deleted_at IS NULL) AS client_count,
    (SELECT count(*) FROM public.crm_workshop_masters WHERE tenant_id = 'cfl') AS workshop_count,
    (SELECT count(*) FROM public.crm_registrations WHERE tenant_id = 'cfl') AS registration_count;
REVOKE ALL ON ALL TABLES IN SCHEMA cfl_mcp FROM PUBLIC;
-- Fails if the role already exists: review that role rather than widening it.
CREATE ROLE cfl_mcp_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE cfl_mcp_reader SET default_transaction_read_only = on;
ALTER ROLE cfl_mcp_reader SET statement_timeout = '5s';
GRANT USAGE ON SCHEMA cfl_mcp TO cfl_mcp_reader;
GRANT SELECT ON cfl_mcp.workshops, cfl_mcp.summary TO cfl_mcp_reader;
COMMIT;
-- Set its password securely through your database administration tool.
-- Do not use the application owner's DATABASE_URL for MCP.
