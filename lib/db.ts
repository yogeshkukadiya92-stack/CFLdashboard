import { Pool } from "pg";

let pool: Pool | null = null;

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

export async function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensurePersistenceTable() {
  const client = getDbPool();
  if (!client) return false;
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
}

export function isMissingPersistenceTableError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42P01");
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
  return result.rows[0];
}

export async function saveAppState(input: Partial<AppState>) {
  const client = getDbPool();
  if (!client) return false;
  await ensurePersistenceTable();
  const current = { ...emptyAppState, ...(await getAppState()) };
  await client.query(
    `
      UPDATE app_state
      SET
        clients = $1::jsonb,
        attendance_sessions = $2::jsonb,
        attendance_entries = $3::jsonb,
        attendance_team_users = $4::jsonb,
        leads = $5::jsonb,
        workshops = $6::jsonb,
        registrations = $7::jsonb,
        schedules = $8::jsonb,
        forms = $9::jsonb,
        form_analytics = $10::jsonb,
        registration_links = $11::jsonb,
        sales_people = $12::jsonb,
        sales_team_users = $13::jsonb,
        workshop_types = $14::jsonb,
        facilitators = $15::jsonb,
        integrations = $16::jsonb,
        landing_pages = $17::jsonb,
        response_access_grants = $18::jsonb,
        updated_at = NOW()
      WHERE id = 1
    `,
    [
      JSON.stringify(input.clients ?? current.clients),
      JSON.stringify(input.attendanceSessions ?? current.attendanceSessions),
      JSON.stringify(input.attendanceEntries ?? current.attendanceEntries),
      JSON.stringify(input.attendanceTeamUsers ?? current.attendanceTeamUsers),
      JSON.stringify(input.leads ?? current.leads),
      JSON.stringify(input.workshops ?? current.workshops),
      JSON.stringify(input.registrations ?? current.registrations),
      JSON.stringify(input.schedules ?? current.schedules),
      JSON.stringify(input.forms ?? current.forms),
      JSON.stringify(input.formAnalytics ?? current.formAnalytics),
      JSON.stringify(input.registrationLinks ?? current.registrationLinks),
      JSON.stringify(input.salesPeople ?? current.salesPeople),
      JSON.stringify(input.salesTeamUsers ?? current.salesTeamUsers),
      JSON.stringify(input.workshopTypes ?? current.workshopTypes),
      JSON.stringify(input.facilitators ?? current.facilitators),
      JSON.stringify(input.integrations ?? current.integrations),
      JSON.stringify(input.landingPages ?? current.landingPages),
      JSON.stringify(input.responseAccessGrants ?? current.responseAccessGrants)
    ]
  );
  return true;
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
