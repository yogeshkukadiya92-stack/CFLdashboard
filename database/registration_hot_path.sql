-- Applied once under the migration advisory lock. Existing registration records
-- stay authoritative; synchronous triggers keep these small read models exact.
LOCK TABLE app_state IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE cfl_registration_records IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS cfl_attendance_lookup (
  source_key TEXT PRIMARY KEY,
  mobile_normalized TEXT NOT NULL,
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS cfl_attendance_lookup_mobile_idx ON cfl_attendance_lookup(mobile_normalized);
CREATE OR REPLACE FUNCTION cfl_sync_attendance_lookup() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  WITH incoming AS MATERIALIZED (
    SELECT DISTINCT md5(item::text) source_key,
      right(regexp_replace(COALESCE(item->>'mobile',''), '[^0-9]', '', 'g'),10) mobile_normalized, item payload
    FROM jsonb_array_elements(NEW.attendance_entries) item
  ), removed AS (
    DELETE FROM cfl_attendance_lookup l WHERE NOT EXISTS (SELECT 1 FROM incoming i WHERE i.source_key=l.source_key)
  )
  INSERT INTO cfl_attendance_lookup SELECT * FROM incoming ON CONFLICT (source_key) DO NOTHING;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS cfl_attendance_lookup_sync ON app_state;
CREATE TRIGGER cfl_attendance_lookup_sync AFTER UPDATE OF attendance_entries ON app_state
  FOR EACH ROW WHEN (OLD.attendance_entries IS DISTINCT FROM NEW.attendance_entries)
  EXECUTE FUNCTION cfl_sync_attendance_lookup();
INSERT INTO cfl_attendance_lookup
  SELECT DISTINCT md5(item::text), right(regexp_replace(COALESCE(item->>'mobile',''), '[^0-9]', '', 'g'),10), item
  FROM app_state, jsonb_array_elements(attendance_entries) item WHERE id=1
  ON CONFLICT (source_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS cfl_registration_totals (
  workshop_id TEXT NOT NULL, batch_id TEXT NOT NULL, batch_name TEXT NOT NULL, intro_session TEXT NOT NULL,
  responses BIGINT NOT NULL, confirmed BIGINT NOT NULL, waiting BIGINT NOT NULL,
  PRIMARY KEY (workshop_id,batch_id,batch_name,intro_session)
);
INSERT INTO cfl_registration_totals
SELECT workshop_id,COALESCE(payload->>'batchId',''),lower(btrim(COALESCE(payload->>'batch',''))),COALESCE(payload->>'introductionSessionId',''),
 count(*),count(*) FILTER (WHERE COALESCE(payload->>'registrationStatus','')<>'waiting'),count(*) FILTER (WHERE payload->>'registrationStatus'='waiting')
FROM cfl_registration_records GROUP BY 1,2,3,4
ON CONFLICT (workshop_id,batch_id,batch_name,intro_session) DO UPDATE
 SET responses=EXCLUDED.responses,confirmed=EXCLUDED.confirmed,waiting=EXCLUDED.waiting;

CREATE OR REPLACE FUNCTION cfl_update_registration_totals() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE old_data JSONB; new_data JSONB;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_data := OLD.payload || jsonb_build_object('workshopId',OLD.workshop_id); END IF;
 IF TG_OP <> 'DELETE' THEN new_data := NEW.payload || jsonb_build_object('workshopId',NEW.workshop_id); END IF;
 IF TG_OP = 'UPDATE' AND
   ROW(old_data->>'workshopId',old_data->>'batchId',old_data->>'batch',old_data->>'introductionSessionId',old_data->>'registrationStatus')
   IS NOT DISTINCT FROM
   ROW(new_data->>'workshopId',new_data->>'batchId',new_data->>'batch',new_data->>'introductionSessionId',new_data->>'registrationStatus') THEN RETURN NEW; END IF;
 INSERT INTO cfl_registration_totals AS totals
 SELECT value->>'workshopId',COALESCE(value->>'batchId',''),lower(btrim(COALESCE(value->>'batch',''))),COALESCE(value->>'introductionSessionId',''),
   sum(delta),sum(CASE WHEN COALESCE(value->>'registrationStatus','')<>'waiting' THEN delta ELSE 0 END),sum(CASE WHEN value->>'registrationStatus'='waiting' THEN delta ELSE 0 END)
 FROM (VALUES (old_data,-1),(new_data,1)) changes(value,delta) WHERE value IS NOT NULL
 GROUP BY 1,2,3,4 ORDER BY 1,2,3,4
 ON CONFLICT (workshop_id,batch_id,batch_name,intro_session) DO UPDATE
 SET responses=totals.responses+EXCLUDED.responses,confirmed=totals.confirmed+EXCLUDED.confirmed,waiting=totals.waiting+EXCLUDED.waiting;
 RETURN COALESCE(NEW,OLD);
END $fn$;
DROP TRIGGER IF EXISTS cfl_registration_totals_sync ON cfl_registration_records;
CREATE TRIGGER cfl_registration_totals_sync AFTER INSERT OR UPDATE OR DELETE ON cfl_registration_records
 FOR EACH ROW EXECUTE FUNCTION cfl_update_registration_totals();
CREATE INDEX IF NOT EXISTS cfl_registration_waiting_position_idx ON cfl_registration_records
 (workshop_id, ((NULLIF(payload->>'waitingPosition',''))::bigint) DESC NULLS LAST)
 WHERE payload->>'registrationStatus'='waiting';
CREATE INDEX IF NOT EXISTS cfl_registration_referral_idx ON cfl_registration_records
 (workshop_id, (payload->>'referralCodeId'), mobile_normalized) WHERE payload->>'referralCodeId' IS NOT NULL;
