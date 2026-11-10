-- External identity mapping; never link accounts by an unverified email claim.
ALTER TABLE callflow_users ADD COLUMN IF NOT EXISTS supabase_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS callflow_users_supabase_uidx ON callflow_users (supabase_user_id) WHERE supabase_user_id IS NOT NULL;
