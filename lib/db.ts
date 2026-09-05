import { Pool, type PoolClient, type QueryResult } from "pg";

let pool: Pool | null = null;
let registrationRecordsPromise: Promise<boolean> | null = null;

type AppState = {
  attendanceEntries: unknown[];
  attendanceSessions: unknown[];
  attendanceTeamUsers: unknown[];
  clients: unknown[];
  facilitators: unknown[];
  formAnalytics: unknown[];
  forms: unknown[];
  integrations: Record<string, unknown>;
  landingPages: unknown[];
  leads: unknown[];
  registrationLinks: Record<string, unknown>;
  registrations: unknown[];
  responseAccessGrants: unknown[];
  salesPeople: unknown[];
  salesTeamUsers: unknown[];
  schedules: unknown[];
  workshopTypes: unknown[];
  workshops: unknown[];
};

const emptyAppState: AppState = {
  attendanceEntries: [],
  attendanceSessions: [],
  attendanceTeamUsers: [],
  clients: [],
  facilitators: [],
  formAnalytics: [],
  forms: [],
  integrations: {},
  landingPages: [],
  leads: [],
  registrationLinks: {},
  registrations: [],
  responseAccessGrants: [],
  salesPeople: [],
  salesTeamUsers: [],
  schedules: [],
  workshopTypes: [],
  workshops: []
};

export function getDbPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5_000,
      query_timeout: 10_000
    });
  }
  return pool;
}

let registrationPool: Pool | null = null;

// Reserve connections for submissions so admin exports and CRM work cannot
// occupy every connection in the application's shared pool. Both use PRIMARY.
export function getRegistrationDbPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!registrationPool) {
    const configured = Number(process.env.REGISTRATION_DB_POOL_MAX ?? 10);
    registrationPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number.isInteger(configured) && configured > 0 && configured <= 50 ? configured : 10,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
      query_timeout: 10_000,
      application_name: "cfl-registration"
    });
    registrationPool.on("error", (error) => console.error("Registration database idle connection error", error.message));
  }
  return registrationPool;
}

export async function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

let persistenceSchemaPromise: Promise<boolean> | undefined;
export function ensurePersistenceTable() {
  persistenceSchemaPromise ??= createPersistenceTable().catch(error => { persistenceSchemaPromise = undefined; throw error; });
  return persistenceSchemaPromise;
}

async function createPersistenceTable() {
  const database = getDbPool();
  if (!database) return false;
  const client = await database.connect();
  try {
  await client.query("SELECT pg_advisory_lock(73184,5)");
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      clients JSONB NOT NULL DEFAULT '[]'::jsonb,
      attendance_sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
      attendance_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
      attendance_team_users JSONB NOT NULL DEFAULT '[]'::jsonb,
      leads JSONB NOT NULL DEFAULT '[]'::jsonb,
      workshops JSONB NOT NULL DEFAULT '[]'::jsonb,
      registrations JSONB NOT NULL DEFAULT '[]'::jsonb,
      schedules JSONB NOT NULL DEFAULT '[]'::jsonb,
      forms JSONB NOT NULL DEFAULT '[]'::jsonb,
      form_analytics JSONB NOT NULL DEFAULT '[]'::jsonb,
      registration_links JSONB NOT NULL DEFAULT '{}'::jsonb,
      sales_people JSONB NOT NULL DEFAULT '[]'::jsonb,
      sales_team_users JSONB NOT NULL DEFAULT '[]'::jsonb,
      workshop_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      facilitators JSONB NOT NULL DEFAULT '[]'::jsonb,
      integrations JSONB NOT NULL DEFAULT '{}'::jsonb,
      landing_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
      response_access_grants JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS clients JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS attendance_sessions JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS attendance_entries JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS attendance_team_users JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS leads JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS workshops JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS registrations JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS schedules JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS forms JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS form_analytics JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS registration_links JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS sales_people JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS sales_team_users JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS workshop_types JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS facilitators JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS integrations JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS landing_pages JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS response_access_grants JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`
    INSERT INTO app_state (
      id,
      clients,
      attendance_sessions,
      attendance_entries,
      leads,
      workshops,
      registrations,
      schedules,
      forms,
      form_analytics,
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
  `);
  return true;
  } finally {
    await client.query("SELECT pg_advisory_unlock(73184,5)").catch(()=>undefined);
    client.release();
  }
}

export async function ensureRegistrationRecordsTable() {
  const database = getDbPool();
  if (!database) return false;
  if (!registrationRecordsPromise) {
    registrationRecordsPromise = database.query(`
      DO $setup$ BEGIN PERFORM pg_advisory_xact_lock(73184,6);
      CREATE TABLE IF NOT EXISTS cfl_registration_records (
        external_id TEXT PRIMARY KEY,
        workshop_id TEXT NOT NULL,
        batch_key TEXT NOT NULL DEFAULT '',
        mobile_normalized TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS cfl_registration_workshop_batch_idx ON cfl_registration_records (workshop_id, batch_key, created_at);
      CREATE INDEX IF NOT EXISTS cfl_registration_mobile_idx ON cfl_registration_records (mobile_normalized, workshop_id, batch_key);
      CREATE TABLE IF NOT EXISTS cfl_registration_counters (
        scope TEXT PRIMARY KEY,
        value BIGINT NOT NULL
      );
      INSERT INTO cfl_registration_records (external_id, workshop_id, batch_key, mobile_normalized, created_at, payload)
      SELECT
        item->>'id',
        COALESCE(item->>'workshopId', item->>'workshopTitle', ''),
        COALESCE(NULLIF(item->>'batchId', ''), LOWER(COALESCE(item->>'batch', ''))),
        RIGHT(REGEXP_REPLACE(COALESCE(item->>'mobile', ''), '[^0-9]', '', 'g'), 10),
        NOW(),
        item
      FROM app_state, LATERAL jsonb_array_elements(registrations) AS item
      WHERE app_state.id = 1 AND COALESCE(item->>'id', '') <> ''
      ON CONFLICT (external_id) DO NOTHING;
      INSERT INTO cfl_registration_counters (scope, value)
      SELECT 'global', COALESCE(MAX((REGEXP_MATCH(payload->>'registrationNumber', '^REG-([0-9]+)$', 'i'))[1]::BIGINT), 0)
      FROM cfl_registration_records
      ON CONFLICT (scope) DO NOTHING;
      END $setup$;
    `).then(() => true).catch((error) => {
      registrationRecordsPromise = null;
      throw error;
    });
  }
  return registrationRecordsPromise;
}

export async function readRegistrationRecords(client?: Pick<PoolClient, "query">) {
  const database = client ?? getDbPool();
  if (!database) return [] as unknown[];
  const result = await database.query<{ payload: unknown }>(`SELECT payload FROM cfl_registration_records ORDER BY created_at DESC, external_id DESC`);
  return result.rows.map((row) => row.payload);
}

let registrationNumbers = { next: 1, end: 0 };
let registrationNumberBlock: Promise<void> | undefined;
export async function reserveRegistrationNumber(_client: Pick<PoolClient, "query">): Promise<string> {
  // Reserve a durable block in an independent, committed statement. Old app
  // versions use the same counter, so rolling deployments cannot reuse numbers.
  // Like a sequence, unused numbers may be skipped after rollback/restart.
  while (registrationNumbers.next > registrationNumbers.end) {
    registrationNumberBlock ??= getDbPool()!.query<{ value: string }>(`
      INSERT INTO cfl_registration_counters(scope,value) VALUES('global',100)
      ON CONFLICT(scope) DO UPDATE SET value=cfl_registration_counters.value+100 RETURNING value
    `).then(result => {
      const end = Number(result.rows[0].value);
      registrationNumbers = { next: end - 99, end };
    }).finally(() => { registrationNumberBlock = undefined; });
    await registrationNumberBlock;
  }
  return `REG-${String(registrationNumbers.next++).padStart(4, "0")}`;
}

export async function upsertRegistrationRecord(client: Pick<PoolClient, "query">, registration: Record<string, unknown>, insertOnly = false, enqueue = false) {
  const externalId = String(registration.id ?? "").trim();
  if (!externalId) throw new Error("Registration id is required.");
  const workshopId = String(registration.workshopId ?? registration.workshopTitle ?? "").trim();
  const batchKey = String(registration.batchId ?? "").trim() || String(registration.batch ?? "").trim().toLowerCase();
  const mobile = String(registration.mobile ?? "").replace(/\D/g, "").slice(-10);
  const createdAt = String(registration.createdAt ?? new Date().toISOString());
  const insertSql = `
    INSERT INTO cfl_registration_records (external_id, workshop_id, batch_key, mobile_normalized, created_at, payload, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
    ${insertOnly ? "ON CONFLICT (external_id) DO NOTHING" : "ON CONFLICT (external_id) DO UPDATE SET payload = EXCLUDED.payload, workshop_id = EXCLUDED.workshop_id, batch_key = EXCLUDED.batch_key, mobile_normalized = EXCLUDED.mobile_normalized, updated_at = NOW()"}
    RETURNING external_id
  `;
  const result = await client.query(enqueue ? `WITH inserted AS (${insertSql}), jobs AS (
    INSERT INTO cfl_registration_jobs(registration_id) SELECT external_id FROM inserted ON CONFLICT DO NOTHING
  ) SELECT external_id FROM inserted` : insertSql,
    [externalId, workshopId, batchKey, mobile, createdAt, JSON.stringify(registration)]);
  return result.rowCount === 1;
}

export async function mergeRegistrationRecords(registrations: unknown[]) {
  const database = getDbPool();
  if (!database) return false;
  await ensureRegistrationRecordsTable();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    // A dashboard snapshot can predate new public submissions. Absence from
    // that snapshot is never a deletion request; deletion requires explicit IDs.
    for (const registration of registrations) {
      if (registration && typeof registration === "object" && !Array.isArray(registration)) {
        await upsertRegistrationRecord(client, registration as Record<string, unknown>);
      }
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function isMissingPersistenceTableError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42P01");
}

export async function beginPersistenceTransaction<Row extends Record<string, unknown>>(
  client: Pick<PoolClient, "query">,
  selectForUpdateSql: string,
  initialize: () => Promise<unknown> = ensurePersistenceTable
) {
  await client.query("BEGIN");
  try {
    return await client.query<Row>(selectForUpdateSql);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (!isMissingPersistenceTableError(error)) throw error;

    // Schema DDL needs an exclusive PostgreSQL lock. Keep it off the normal
    // registration path and run it only when app_state genuinely is missing.
    await initialize();
    await client.query("BEGIN");
    return client.query<Row>(selectForUpdateSql) as Promise<QueryResult<Row>>;
  }
}

let analyticsTablePromise: Promise<unknown> | null = null;

export async function ensureFormAnalyticsTable() {
  const database = getDbPool();
  if (!database) return;
  if (!analyticsTablePromise) {
    analyticsTablePromise = database.query(`CREATE TABLE IF NOT EXISTS cfl_form_analytics (
      form_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL
    )`).catch((error) => {
      analyticsTablePromise = null;
      throw error;
    });
  }
  await analyticsTablePromise;
}

export async function recordFormAnalyticsEvent(input: {
  formId: string; workshopId: string; workshopSlug: string; event: string; fieldId: string;
}) {
  const database = getDbPool();
  if (!database) return;
  await ensureFormAnalyticsTable();
  // Seed historical totals once; each event updates only its own form row.
  // PostgreSQL serializes concurrent increments without a read/overwrite race.
  await database.query(`INSERT INTO cfl_form_analytics (form_id, payload)
    SELECT $1, COALESCE(
      (SELECT item FROM app_state, jsonb_array_elements(form_analytics) item
        WHERE id = 1 AND item->>'formId' = $1 LIMIT 1),
      jsonb_build_object('formId', $1::text, 'views', 0, 'starts', 0,
        'completions', 0, 'dropOffByField', '{}'::jsonb))
    WHERE NOT EXISTS (SELECT 1 FROM cfl_form_analytics WHERE form_id = $1)
    ON CONFLICT (form_id) DO NOTHING`, [input.formId]);
  const counter = input.event === "view" ? "views" : input.event === "start" ? "starts" : "completions";
  await database.query(`UPDATE cfl_form_analytics SET payload =
    (CASE WHEN $2 = 'drop_off' THEN
      jsonb_set(payload, '{dropOffByField}', COALESCE(payload->'dropOffByField', '{}'::jsonb) ||
        CASE WHEN $3 = '' THEN '{}'::jsonb ELSE
          jsonb_build_object($3::text, COALESCE((payload->'dropOffByField'->>$3)::bigint, 0) + 1) END)
    ELSE jsonb_set(payload, ARRAY[$4::text], to_jsonb(COALESCE((payload->>$4)::bigint, 0) + 1)) END)
    || jsonb_build_object('workshopId', $5::text, 'workshopSlug', $6::text, 'updatedAt', NOW())
    WHERE form_id = $1`, [input.formId, input.event, input.fieldId, counter, input.workshopId, input.workshopSlug]);
}

export async function getAppState() {
  const client = getDbPool();
  if (!client) return null;
  const readState = () => client.query(`
    SELECT
      clients,
      attendance_sessions AS "attendanceSessions",
      attendance_entries AS "attendanceEntries",
      attendance_team_users AS "attendanceTeamUsers",
      leads,
      workshops,
      registrations,
      schedules,
      forms,
      form_analytics AS "formAnalytics",
      registration_links AS "registrationLinks",
      sales_people AS "salesPeople",
      sales_team_users AS "salesTeamUsers",
      workshop_types AS "workshopTypes",
      facilitators,
      integrations,
      landing_pages AS "landingPages",
      response_access_grants AS "responseAccessGrants"
    FROM app_state
    WHERE id = 1
    LIMIT 1
  `);
  let result;
  try {
    result = await readState();
  } catch (error) {
    // Schema creation belongs on the cold-start path only. Running every
    // CREATE/ALTER before every public read can block all registration links
    // behind a PostgreSQL DDL lock.
    if (!isMissingPersistenceTableError(error)) throw error;
    await ensurePersistenceTable();
    result = await readState();
  }
  if (!result.rows[0]) return emptyAppState;
  await ensureFormAnalyticsTable();
  const analytics = await client.query(`SELECT payload FROM cfl_form_analytics`);
  const analyticsByForm = new Map((result.rows[0].formAnalytics ?? []).map((record: { formId: string }) => [record.formId, record]));
  for (const row of analytics.rows) analyticsByForm.set(row.payload.formId, row.payload);
  result.rows[0].formAnalytics = [...analyticsByForm.values()];
  try {
    const registrations = await readRegistrationRecords(client);
    return registrations.length ? { ...result.rows[0], registrations } : result.rows[0];
  } catch (error) {
    if (!isMissingPersistenceTableError(error)) throw error;
    return result.rows[0];
  }
}

export async function saveAppState(input: Partial<AppState>) {
  const client = getDbPool();
  if (!client) return false;
  await ensurePersistenceTable();
  // Update only the supplied fields. Rewriting an old copy of the whole row
  // can overwrite attendance/settings changed by a concurrent request.
  const columns: Record<keyof AppState, string> = {
    clients: "clients", attendanceSessions: "attendance_sessions", attendanceEntries: "attendance_entries",
    attendanceTeamUsers: "attendance_team_users", leads: "leads", workshops: "workshops", registrations: "registrations",
    schedules: "schedules", forms: "forms", formAnalytics: "form_analytics", registrationLinks: "registration_links",
    salesPeople: "sales_people", salesTeamUsers: "sales_team_users", workshopTypes: "workshop_types", facilitators: "facilitators",
    integrations: "integrations", landingPages: "landing_pages", responseAccessGrants: "response_access_grants"
  };
  const fields = (Object.keys(columns) as Array<keyof AppState>).filter(key => input[key] !== undefined);
  if (!fields.length) return true;
  await client.query(`UPDATE app_state SET ${fields.map((key,index) => `${columns[key]}=$${index+1}::jsonb`).join(",")}, updated_at=NOW() WHERE id=1`,
    fields.map(key => JSON.stringify(input[key])));
  if (Array.isArray(input.registrations)) await mergeRegistrationRecords(input.registrations);
  return true;
}

export async function deleteRegistrationRecords(ids: string[]) {
  const database = getDbPool();
  if (!database) throw new Error("Database is not configured.");
  await ensureRegistrationRecordsTable();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    // Remove only the requested identities from the legacy seed as well, so a
    // later server startup cannot re-import a deliberately deleted record.
    await client.query(`UPDATE app_state SET registrations=COALESCE((SELECT jsonb_agg(item)
      FROM jsonb_array_elements(registrations) item WHERE NOT (item->>'id'=ANY($1::text[]))), '[]'::jsonb),
      updated_at=NOW() WHERE id=1`,[ids]);
    const result = await client.query("DELETE FROM cfl_registration_records WHERE external_id=ANY($1::text[])",[ids]);
    await client.query("COMMIT");
    return result.rowCount ?? 0;
  } catch(error) { await client.query("ROLLBACK").catch(()=>undefined); throw error; }
  finally { client.release(); }
}

export async function mutateAttendanceEntries<T>(
  mutate: (entries: unknown[]) => { entries: unknown[]; result: T }
) {
  const database = getDbPool();
  if (!database) throw new Error("Database is not configured.");
  await ensurePersistenceTable();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query(`SELECT attendance_entries FROM app_state WHERE id = 1 FOR UPDATE`);
    const current = Array.isArray(selected.rows[0]?.attendance_entries) ? selected.rows[0].attendance_entries : [];
    const next = mutate(current);
    await client.query(
      `UPDATE app_state SET attendance_entries = $1::jsonb, updated_at = NOW() WHERE id = 1`,
      [JSON.stringify(next.entries)]
    );
    await client.query("COMMIT");
    return next.result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
