import { Pool } from "pg";

let pool: Pool | null = null;

type AppState = {
  attendanceEntries: unknown[];
  attendanceSessions: unknown[];
  clients: unknown[];
  facilitators: unknown[];
  forms: unknown[];
  integrations: Record<string, unknown>;
  leads: unknown[];
  registrationLinks: Record<string, unknown>;
  registrations: unknown[];
  salesPeople: unknown[];
  schedules: unknown[];
  workshopTypes: unknown[];
  workshops: unknown[];
};

const emptyAppState: AppState = {
  attendanceEntries: [],
  attendanceSessions: [],
  clients: [],
  facilitators: [],
  forms: [],
  integrations: {},
  leads: [],
  registrationLinks: {},
  registrations: [],
  salesPeople: [],
  schedules: [],
  workshopTypes: [],
  workshops: []
};

export function getDbPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
      leads JSONB NOT NULL DEFAULT '[]'::jsonb,
      workshops JSONB NOT NULL DEFAULT '[]'::jsonb,
      registrations JSONB NOT NULL DEFAULT '[]'::jsonb,
      schedules JSONB NOT NULL DEFAULT '[]'::jsonb,
      forms JSONB NOT NULL DEFAULT '[]'::jsonb,
      registration_links JSONB NOT NULL DEFAULT '{}'::jsonb,
      sales_people JSONB NOT NULL DEFAULT '[]'::jsonb,
      workshop_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      facilitators JSONB NOT NULL DEFAULT '[]'::jsonb,
      integrations JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS clients JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS attendance_sessions JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS attendance_entries JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS leads JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS workshops JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS registrations JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS schedules JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS forms JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS registration_links JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS sales_people JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS workshop_types JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS facilitators JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await client.query(`ALTER TABLE app_state ADD COLUMN IF NOT EXISTS integrations JSONB NOT NULL DEFAULT '{}'::jsonb;`);
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

export async function getAppState() {
  const client = getDbPool();
  if (!client) return null;
  await ensurePersistenceTable();
  const result = await client.query(`
    SELECT
      clients,
      attendance_sessions AS "attendanceSessions",
      attendance_entries AS "attendanceEntries",
      leads,
      workshops,
      registrations,
      schedules,
      forms,
      registration_links AS "registrationLinks",
      sales_people AS "salesPeople",
      workshop_types AS "workshopTypes",
      facilitators,
      integrations
    FROM app_state
    WHERE id = 1
    LIMIT 1
  `);
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
        leads = $4::jsonb,
        workshops = $5::jsonb,
        registrations = $6::jsonb,
        schedules = $7::jsonb,
        forms = $8::jsonb,
        registration_links = $9::jsonb,
        sales_people = $10::jsonb,
        workshop_types = $11::jsonb,
        facilitators = $12::jsonb,
        integrations = $13::jsonb,
        updated_at = NOW()
      WHERE id = 1
    `,
    [
      JSON.stringify(input.clients ?? current.clients),
      JSON.stringify(input.attendanceSessions ?? current.attendanceSessions),
      JSON.stringify(input.attendanceEntries ?? current.attendanceEntries),
      JSON.stringify(input.leads ?? current.leads),
      JSON.stringify(input.workshops ?? current.workshops),
      JSON.stringify(input.registrations ?? current.registrations),
      JSON.stringify(input.schedules ?? current.schedules),
      JSON.stringify(input.forms ?? current.forms),
      JSON.stringify(input.registrationLinks ?? current.registrationLinks),
      JSON.stringify(input.salesPeople ?? current.salesPeople),
      JSON.stringify(input.workshopTypes ?? current.workshopTypes),
      JSON.stringify(input.facilitators ?? current.facilitators),
      JSON.stringify(input.integrations ?? current.integrations)
    ]
  );
  return true;
}
