import type { PoolClient } from "pg";
import { getAppState, getDbPool, saveAppState } from "@/lib/db";

const TENANT_ID = "cfl";
const MAX_IMPORT_BATCH_SIZE = 1000;

const CRM_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS crm_import_runs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'cfl',
    source_file TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
    expected_rows INTEGER NOT NULL DEFAULT 0 CHECK (expected_rows >= 0),
    processed_rows INTEGER NOT NULL DEFAULT 0 CHECK (processed_rows >= 0),
    inserted_registrations INTEGER NOT NULL DEFAULT 0 CHECK (inserted_registrations >= 0),
    duplicate_rows INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_rows >= 0),
    error_rows INTEGER NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, source_hash)
  );

  CREATE TABLE IF NOT EXISTS crm_facilitators (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'cfl',
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    aliases TEXT[] NOT NULL DEFAULT '{}'::text[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, normalized_name)
  );

  CREATE TABLE IF NOT EXISTS crm_workshop_masters (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'cfl',
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    default_facilitator_id BIGINT REFERENCES crm_facilitators(id),
    workshop_type TEXT NOT NULL DEFAULT 'Legacy',
    product_group TEXT NOT NULL DEFAULT 'Legacy',
    payment_type TEXT NOT NULL DEFAULT 'Unknown',
    archived BOOLEAN NOT NULL DEFAULT TRUE,
    is_legacy BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, normalized_name)
  );

  CREATE TABLE IF NOT EXISTS crm_workshop_batches (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'cfl',
    workshop_id BIGINT NOT NULL REFERENCES crm_workshop_masters(id),
    facilitator_id BIGINT NOT NULL REFERENCES crm_facilitators(id),
    source_workshop_name TEXT NOT NULL,
    normalized_source_name TEXT NOT NULL,
    batch_label TEXT,
    batch_number INTEGER,
    archived BOOLEAN NOT NULL DEFAULT TRUE,
    is_legacy BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, normalized_source_name)
  );

  CREATE TABLE IF NOT EXISTS crm_clients (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'cfl',
    identity_key TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    name_aliases TEXT[] NOT NULL DEFAULT '{}'::text[],
    mobile TEXT NOT NULL DEFAULT '',
    mobile_normalized TEXT NOT NULL DEFAULT '',
    valid_mobile BOOLEAN NOT NULL DEFAULT FALSE,
    email TEXT NOT NULL DEFAULT '',
    email_aliases TEXT[] NOT NULL DEFAULT '{}'::text[],
    dob DATE,
    gender TEXT NOT NULL DEFAULT '',
    occupation TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'India',
    state TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspect')),
    has_name_conflict BOOLEAN NOT NULL DEFAULT FALSE,
    has_email_conflict BOOLEAN NOT NULL DEFAULT FALSE,
    is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT NOT NULL DEFAULT 'app',
    first_registered_at TIMESTAMPTZ,
    last_registered_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, identity_key)
  );

  CREATE TABLE IF NOT EXISTS crm_registrations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'cfl',
    import_run_id BIGINT REFERENCES crm_import_runs(id),
    source_row INTEGER,
    source_record_hash TEXT,
    external_id TEXT,
    client_id BIGINT NOT NULL REFERENCES crm_clients(id),
    workshop_id BIGINT NOT NULL REFERENCES crm_workshop_masters(id),
    workshop_batch_id BIGINT NOT NULL REFERENCES crm_workshop_batches(id),
    registered_at TIMESTAMPTZ NOT NULL,
    source_status_code TEXT,
    status TEXT NOT NULL CHECK (status IN ('Success', 'Failed', 'Refund', 'Paid', 'Due')),
    salesperson TEXT NOT NULL DEFAULT '',
    payment_mode TEXT,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS crm_import_rows (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    import_run_id BIGINT NOT NULL REFERENCES crm_import_runs(id) ON DELETE CASCADE,
    source_row INTEGER NOT NULL,
    row_hash TEXT NOT NULL,
    payload JSONB NOT NULL,
    canonical_registration_id BIGINT REFERENCES crm_registrations(id),
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (import_run_id, source_row)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS crm_registrations_legacy_hash_uidx
    ON crm_registrations (tenant_id, source_record_hash)
    WHERE source_record_hash IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS crm_registrations_external_id_uidx
    ON crm_registrations (tenant_id, external_id)
    WHERE external_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS crm_clients_mobile_idx
    ON crm_clients (tenant_id, mobile_normalized, id DESC)
    WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS crm_clients_name_idx
    ON crm_clients (tenant_id, LOWER(name), id DESC)
    WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS crm_clients_email_idx
    ON crm_clients (tenant_id, LOWER(email), id DESC)
    WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS crm_clients_status_id_idx
    ON crm_clients (tenant_id, status, id DESC)
    WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS crm_workshop_masters_facilitator_idx
    ON crm_workshop_masters (default_facilitator_id);
  CREATE INDEX IF NOT EXISTS crm_workshop_batches_workshop_idx
    ON crm_workshop_batches (workshop_id);
  CREATE INDEX IF NOT EXISTS crm_workshop_batches_facilitator_idx
    ON crm_workshop_batches (facilitator_id);
  CREATE INDEX IF NOT EXISTS crm_registrations_client_date_idx
    ON crm_registrations (client_id, registered_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS crm_registrations_workshop_date_idx
    ON crm_registrations (workshop_id, registered_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS crm_registrations_batch_date_idx
    ON crm_registrations (workshop_batch_id, registered_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS crm_registrations_status_date_idx
    ON crm_registrations (tenant_id, status, registered_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS crm_import_rows_hash_idx
    ON crm_import_rows (row_hash);
`;

export type LegacyImportRow = {
  source_row: number;
  name: string;
  mobile_raw: string;
  mobile_normalized: string;
  valid_mobile: boolean;
  identity_key: string;
  email: string;
  registered_at: string;
  workshop_source_name: string;
  workshop_normalized: string;
  workshop_base_name: string;
  workshop_base_normalized: string;
  batch_label: string | null;
  batch_number: number | null;
  facilitator_original: string;
  facilitator_name: string;
  facilitator_normalized: string;
  status_code: "S" | "P" | "R";
  status: "Success" | "Failed" | "Refund";
  salesperson: string;
  state: string;
  city: string;
  country: string;
  occupation: string;
  row_hash: string;
  payload: Record<string, string>;
};

type ImportRunRow = {
  id: string;
  source_file: string;
  source_hash: string;
  status: "running" | "complete" | "failed";
  expected_rows: number;
  processed_rows: number;
  inserted_registrations: number;
  duplicate_rows: number;
  error_rows: number;
  last_error: string | null;
  started_at: string;
  completed_at: string | null;
};

let schemaPromise: Promise<boolean> | null = null;

export async function ensureCrmSchema() {
  const pool = getDbPool();
  if (!pool) return false;
  if (!schemaPromise) {
    schemaPromise = pool.query(CRM_SCHEMA_SQL).then(() => true).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function requirePool() {
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  return pool;
}

function mapImportRun(row: ImportRunRow) {
  return {
    id: String(row.id),
    sourceFile: row.source_file,
    sourceHash: row.source_hash,
    status: row.status,
    expectedRows: Number(row.expected_rows),
    processedRows: Number(row.processed_rows),
    insertedRegistrations: Number(row.inserted_registrations),
    duplicateRows: Number(row.duplicate_rows),
    errorRows: Number(row.error_rows),
    lastError: row.last_error,
    startedAt: row.started_at,
    completedAt: row.completed_at
  };
}

export async function startLegacyImport(input: {
  expectedRows: number;
  metadata?: Record<string, unknown>;
  sourceFile: string;
  sourceHash: string;
}) {
  await ensureCrmSchema();
  const pool = requirePool();
  const result = await pool.query<ImportRunRow>(
    `
      INSERT INTO crm_import_runs (
        tenant_id, source_file, source_hash, expected_rows, metadata
      ) VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (tenant_id, source_hash) DO UPDATE SET
        source_file = EXCLUDED.source_file,
        expected_rows = GREATEST(crm_import_runs.expected_rows, EXCLUDED.expected_rows),
        metadata = crm_import_runs.metadata || EXCLUDED.metadata,
        status = CASE WHEN crm_import_runs.status = 'complete' THEN 'complete' ELSE 'running' END,
        last_error = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [TENANT_ID, input.sourceFile, input.sourceHash, input.expectedRows, JSON.stringify(input.metadata ?? {})]
  );
  return mapImportRun(result.rows[0]);
}

export async function getLegacyImportRun(runId: string) {
  await ensureCrmSchema();
  const pool = requirePool();
  const result = await pool.query<ImportRunRow>(
    `SELECT * FROM crm_import_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [runId, TENANT_ID]
  );
  return result.rows[0] ? mapImportRun(result.rows[0]) : null;
}

async function createTemporaryImportTable(client: PoolClient, rows: LegacyImportRow[]) {
  await client.query(
    `
      CREATE TEMP TABLE tmp_legacy_import_rows ON COMMIT DROP AS
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS source_rows(
        source_row INTEGER,
        name TEXT,
        mobile_raw TEXT,
        mobile_normalized TEXT,
        valid_mobile BOOLEAN,
        identity_key TEXT,
        email TEXT,
        registered_at TIMESTAMPTZ,
        workshop_source_name TEXT,
        workshop_normalized TEXT,
        workshop_base_name TEXT,
        workshop_base_normalized TEXT,
        batch_label TEXT,
        batch_number INTEGER,
        facilitator_original TEXT,
        facilitator_name TEXT,
        facilitator_normalized TEXT,
        status_code TEXT,
        status TEXT,
        salesperson TEXT,
        state TEXT,
        city TEXT,
        country TEXT,
        occupation TEXT,
        row_hash TEXT,
        payload JSONB
      )
    `,
    [JSON.stringify(rows)]
  );
}

async function upsertImportFacilitators(client: PoolClient) {
  await client.query(`
    INSERT INTO crm_facilitators AS target (
      tenant_id, name, normalized_name, aliases, is_legacy
    )
    SELECT DISTINCT ON (facilitator_normalized)
      '${TENANT_ID}',
      facilitator_name,
      facilitator_normalized,
      CASE
        WHEN facilitator_original <> facilitator_name THEN ARRAY[facilitator_original]
        ELSE '{}'::text[]
      END,
      TRUE
    FROM tmp_legacy_import_rows
    ORDER BY facilitator_normalized, source_row
    ON CONFLICT (tenant_id, normalized_name) DO UPDATE SET
      name = CASE
        WHEN target.normalized_name = 'dr luv patel' THEN 'Dr Luv Patel'
        ELSE target.name
      END,
      aliases = (
        SELECT ARRAY(
          SELECT DISTINCT alias
          FROM unnest(target.aliases || EXCLUDED.aliases) AS alias
          WHERE alias <> ''
        )
      ),
      is_legacy = target.is_legacy OR EXCLUDED.is_legacy,
      updated_at = NOW()
  `);
}

async function upsertImportWorkshops(client: PoolClient) {
  await client.query(`
    INSERT INTO crm_workshop_masters AS target (
      tenant_id,
      name,
      normalized_name,
      default_facilitator_id,
      workshop_type,
      product_group,
      payment_type,
      archived,
      is_legacy
    )
    SELECT DISTINCT ON (rows.workshop_base_normalized)
      '${TENANT_ID}',
      rows.workshop_base_name,
      rows.workshop_base_normalized,
      facilitator.id,
      'Legacy',
      'Legacy',
      'Unknown',
      TRUE,
      TRUE
    FROM tmp_legacy_import_rows AS rows
    JOIN crm_facilitators AS facilitator
      ON facilitator.tenant_id = '${TENANT_ID}'
      AND facilitator.normalized_name = rows.facilitator_normalized
    ORDER BY rows.workshop_base_normalized, rows.source_row
    ON CONFLICT (tenant_id, normalized_name) DO UPDATE SET
      default_facilitator_id = COALESCE(target.default_facilitator_id, EXCLUDED.default_facilitator_id),
      is_legacy = target.is_legacy OR EXCLUDED.is_legacy,
      updated_at = NOW()
  `);

  await client.query(`
    INSERT INTO crm_workshop_batches AS target (
      tenant_id,
      workshop_id,
      facilitator_id,
      source_workshop_name,
      normalized_source_name,
      batch_label,
      batch_number,
      archived,
      is_legacy
    )
    SELECT DISTINCT ON (rows.workshop_normalized)
      '${TENANT_ID}',
      workshop.id,
      facilitator.id,
      rows.workshop_source_name,
      rows.workshop_normalized,
      rows.batch_label,
      rows.batch_number,
      TRUE,
      TRUE
    FROM tmp_legacy_import_rows AS rows
    JOIN crm_workshop_masters AS workshop
      ON workshop.tenant_id = '${TENANT_ID}'
      AND workshop.normalized_name = rows.workshop_base_normalized
    JOIN crm_facilitators AS facilitator
      ON facilitator.tenant_id = '${TENANT_ID}'
      AND facilitator.normalized_name = rows.facilitator_normalized
    ORDER BY rows.workshop_normalized, rows.source_row
    ON CONFLICT (tenant_id, normalized_source_name) DO UPDATE SET
      facilitator_id = EXCLUDED.facilitator_id,
      source_workshop_name = EXCLUDED.source_workshop_name,
      batch_label = EXCLUDED.batch_label,
      batch_number = EXCLUDED.batch_number,
      updated_at = NOW()
  `);
}

async function upsertImportClients(client: PoolClient) {
  await client.query(`
    WITH ranked AS (
      SELECT
        rows.*,
        ROW_NUMBER() OVER (
          PARTITION BY identity_key
          ORDER BY registered_at DESC, source_row ASC
        ) AS row_rank,
        MIN(registered_at) OVER (PARTITION BY identity_key) AS first_registered_at,
        MAX(registered_at) OVER (PARTITION BY identity_key) AS last_registered_at
      FROM tmp_legacy_import_rows AS rows
    )
    INSERT INTO crm_clients AS target (
      tenant_id,
      identity_key,
      name,
      mobile,
      mobile_normalized,
      valid_mobile,
      email,
      occupation,
      country,
      state,
      city,
      status,
      is_legacy,
      source,
      first_registered_at,
      last_registered_at
    )
    SELECT
      '${TENANT_ID}',
      identity_key,
      COALESCE(name, ''),
      COALESCE(mobile_raw, ''),
      COALESCE(mobile_normalized, ''),
      COALESCE(valid_mobile, FALSE),
      COALESCE(email, ''),
      COALESCE(occupation, ''),
      COALESCE(NULLIF(country, ''), 'India'),
      COALESCE(state, ''),
      COALESCE(city, ''),
      'Active',
      TRUE,
      'member-details',
      first_registered_at,
      last_registered_at
    FROM ranked
    WHERE row_rank = 1
    ON CONFLICT (tenant_id, identity_key) DO UPDATE SET
      name = CASE WHEN target.name = '' THEN EXCLUDED.name ELSE target.name END,
      name_aliases = CASE
        WHEN target.name <> ''
          AND EXCLUDED.name <> ''
          AND LOWER(target.name) <> LOWER(EXCLUDED.name)
          AND NOT (EXCLUDED.name = ANY(target.name_aliases))
        THEN ARRAY_APPEND(target.name_aliases, EXCLUDED.name)
        ELSE target.name_aliases
      END,
      mobile = CASE WHEN target.mobile = '' THEN EXCLUDED.mobile ELSE target.mobile END,
      mobile_normalized = CASE
        WHEN target.mobile_normalized = '' THEN EXCLUDED.mobile_normalized
        ELSE target.mobile_normalized
      END,
      valid_mobile = target.valid_mobile OR EXCLUDED.valid_mobile,
      email = CASE WHEN target.email = '' THEN EXCLUDED.email ELSE target.email END,
      email_aliases = CASE
        WHEN target.email <> ''
          AND EXCLUDED.email <> ''
          AND LOWER(target.email) <> LOWER(EXCLUDED.email)
          AND NOT (EXCLUDED.email = ANY(target.email_aliases))
        THEN ARRAY_APPEND(target.email_aliases, EXCLUDED.email)
        ELSE target.email_aliases
      END,
      occupation = CASE WHEN target.occupation = '' THEN EXCLUDED.occupation ELSE target.occupation END,
      country = CASE WHEN target.country = '' THEN EXCLUDED.country ELSE target.country END,
      state = CASE WHEN target.state = '' THEN EXCLUDED.state ELSE target.state END,
      city = CASE WHEN target.city = '' THEN EXCLUDED.city ELSE target.city END,
      has_name_conflict = target.has_name_conflict OR (
        target.name <> '' AND EXCLUDED.name <> '' AND LOWER(target.name) <> LOWER(EXCLUDED.name)
      ),
      has_email_conflict = target.has_email_conflict OR (
        target.email <> '' AND EXCLUDED.email <> '' AND LOWER(target.email) <> LOWER(EXCLUDED.email)
      ),
      is_legacy = target.is_legacy OR EXCLUDED.is_legacy,
      first_registered_at = LEAST(
        COALESCE(target.first_registered_at, EXCLUDED.first_registered_at),
        EXCLUDED.first_registered_at
      ),
      last_registered_at = GREATEST(
        COALESCE(target.last_registered_at, EXCLUDED.last_registered_at),
        EXCLUDED.last_registered_at
      ),
      updated_at = NOW()
  `);
}

async function insertImportRegistrations(client: PoolClient, runId: string) {
  return client.query(`
    INSERT INTO crm_registrations (
      tenant_id,
      import_run_id,
      source_row,
      source_record_hash,
      client_id,
      workshop_id,
      workshop_batch_id,
      registered_at,
      source_status_code,
      status,
      salesperson,
      is_legacy
    )
    SELECT DISTINCT ON (rows.row_hash)
      '${TENANT_ID}',
      $1,
      rows.source_row,
      rows.row_hash,
      crm_client.id,
      workshop.id,
      batch.id,
      rows.registered_at,
      rows.status_code,
      rows.status,
      COALESCE(rows.salesperson, ''),
      TRUE
    FROM tmp_legacy_import_rows AS rows
    JOIN crm_clients AS crm_client
      ON crm_client.tenant_id = '${TENANT_ID}'
      AND crm_client.identity_key = rows.identity_key
    JOIN crm_workshop_masters AS workshop
      ON workshop.tenant_id = '${TENANT_ID}'
      AND workshop.normalized_name = rows.workshop_base_normalized
    JOIN crm_workshop_batches AS batch
      ON batch.tenant_id = '${TENANT_ID}'
      AND batch.normalized_source_name = rows.workshop_normalized
    ORDER BY rows.row_hash, rows.source_row
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [runId]);
}

async function insertImportAuditRows(client: PoolClient, runId: string) {
  return client.query<{ is_duplicate: boolean }>(`
    INSERT INTO crm_import_rows (
      import_run_id,
      source_row,
      row_hash,
      payload,
      canonical_registration_id,
      is_duplicate
    )
    SELECT
      $1,
      rows.source_row,
      rows.row_hash,
      rows.payload,
      registration.id,
      registration.import_run_id <> $1 OR registration.source_row <> rows.source_row
    FROM tmp_legacy_import_rows AS rows
    JOIN crm_registrations AS registration
      ON registration.tenant_id = '${TENANT_ID}'
      AND registration.source_record_hash = rows.row_hash
    ON CONFLICT (import_run_id, source_row) DO NOTHING
    RETURNING is_duplicate
  `, [runId]);
}

export async function importLegacyBatch(runId: string, rows: LegacyImportRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { duplicateRows: 0, insertedRegistrations: 0, processedRows: 0 };
  }
  if (rows.length > MAX_IMPORT_BATCH_SIZE) {
    throw new Error(`Import batch exceeds ${MAX_IMPORT_BATCH_SIZE} rows.`);
  }

  await ensureCrmSchema();
  const pool = requirePool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '45s'");
    await client.query("SELECT pg_advisory_xact_lock($1)", [runId]);
    const run = await client.query<{ status: string }>(
      `SELECT status FROM crm_import_runs WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [runId, TENANT_ID]
    );
    if (!run.rows[0]) throw new Error("Import run not found.");
    if (run.rows[0].status === "complete") {
      await client.query("ROLLBACK");
      return { duplicateRows: 0, insertedRegistrations: 0, processedRows: 0 };
    }

    await createTemporaryImportTable(client, rows);
    await upsertImportFacilitators(client);
    await upsertImportWorkshops(client);
    await upsertImportClients(client);
    const registrationResult = await insertImportRegistrations(client, runId);
    const auditResult = await insertImportAuditRows(client, runId);
    const processedRows = auditResult.rowCount ?? 0;
    const duplicateRows = auditResult.rows.filter((row) => row.is_duplicate).length;
    const insertedRegistrations = registrationResult.rowCount ?? 0;

    await client.query(
      `
        UPDATE crm_import_runs
        SET
          processed_rows = processed_rows + $1,
          inserted_registrations = inserted_registrations + $2,
          duplicate_rows = duplicate_rows + $3,
          status = 'running',
          last_error = NULL,
          updated_at = NOW()
        WHERE id = $4 AND tenant_id = $5
      `,
      [processedRows, insertedRegistrations, duplicateRows, runId, TENANT_ID]
    );
    await client.query("COMMIT");
    return { duplicateRows, insertedRegistrations, processedRows };
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message.slice(0, 2000) : "Unknown import error";
    await pool.query(
      `UPDATE crm_import_runs SET last_error = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [message, runId, TENANT_ID]
    ).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function mergeNameKey(value: string) {
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("en-IN")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  return normalized === "luv patel" || normalized === "dr luv patel" ? "dr luv patel" : normalized;
}

function workshopNameKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-IN")
    .trim()
    .replace(/\s+/g, " ");
}

function objectName(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name.trim() : "";
}

async function syncLegacyMastersToAppState() {
  const pool = requirePool();
  const [state, facilitatorResult, workshopResult] = await Promise.all([
    getAppState(),
    pool.query<{ id: string; name: string }>(`
      SELECT id, name
      FROM crm_facilitators
      WHERE tenant_id = $1 AND is_legacy = TRUE
      ORDER BY name
    `, [TENANT_ID]),
    pool.query<{
      batch_count: number;
      facilitator_name: string;
      id: string;
      name: string;
    }>(`
      SELECT
        workshop.id,
        workshop.name,
        facilitator.name AS facilitator_name,
        COUNT(batch.id)::INTEGER AS batch_count
      FROM crm_workshop_masters AS workshop
      LEFT JOIN crm_facilitators AS facilitator ON facilitator.id = workshop.default_facilitator_id
      LEFT JOIN crm_workshop_batches AS batch ON batch.workshop_id = workshop.id
      WHERE workshop.tenant_id = $1 AND workshop.is_legacy = TRUE
      GROUP BY workshop.id, facilitator.name
      ORDER BY workshop.name
    `, [TENANT_ID])
  ]);

  const stateClients = (Array.isArray(state?.clients) ? state.clients : []) as unknown[];
  for (const entry of stateClients) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const client = entry as Record<string, unknown>;
    const name = String(client.name ?? "").trim();
    const mobile = String(client.mobile ?? "").trim();
    if (!name || !mobile) continue;
    await saveCrmClient({
      city: String(client.city ?? ""),
      country: String(client.country ?? "India"),
      dob: String(client.dob ?? ""),
      email: String(client.email ?? ""),
      gender: String(client.gender ?? ""),
      mobile,
      name,
      occupation: String(client.occupation ?? ""),
      state: String(client.state ?? ""),
      status: String(client.status ?? "Active")
    });
  }

  const stateRegistrations = (Array.isArray(state?.registrations) ? state.registrations : []) as unknown[];
  for (const entry of stateRegistrations) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    await upsertLiveRegistration(entry as Record<string, unknown>);
  }

  const currentFacilitators = (Array.isArray(state?.facilitators) ? state.facilitators : []) as unknown[];
  const sampleFacilitators = new Set(["amit verma", "neha kapoor", "arjun sharma"]);
  const facilitatorMap = new Map<string, Record<string, unknown>>();
  currentFacilitators.forEach((entry) => {
    const name = objectName(entry);
    if (!name) return;
    const canonicalName = mergeNameKey(name) === "dr luv patel" ? "Dr Luv Patel" : name;
    const key = mergeNameKey(canonicalName);
    if (sampleFacilitators.has(key)) return;
    facilitatorMap.set(key, {
      ...(entry as Record<string, unknown>),
      name: canonicalName
    });
  });
  facilitatorResult.rows.forEach((entry) => {
    const name = mergeNameKey(entry.name) === "dr luv patel" ? "Dr Luv Patel" : entry.name;
    const key = mergeNameKey(name);
    if (!facilitatorMap.has(key)) {
      facilitatorMap.set(key, { id: `legacy-facilitator-${entry.id}`, name });
    }
  });

  const currentWorkshops = (Array.isArray(state?.workshops) ? state.workshops : []) as unknown[];
  const workshopMap = new Map<string, Record<string, unknown>>();
  currentWorkshops.forEach((entry) => {
    const name = objectName(entry);
    if (name) workshopMap.set(workshopNameKey(name), entry as Record<string, unknown>);
  });
  workshopResult.rows.forEach((entry) => {
    const key = workshopNameKey(entry.name);
    const existing = workshopMap.get(key);
    if (existing) {
      workshopMap.set(key, {
        ...existing,
        legacyBatchCount: Number(entry.batch_count),
        legacySource: true
      });
      return;
    }
    workshopMap.set(key, {
      archived: true,
      batch: `${entry.batch_count} historical batches`,
      facilitator: entry.facilitator_name || "CFL Facilitator",
      id: `legacy-workshop-${entry.id}`,
      isPaid: false,
      legacyBatchCount: Number(entry.batch_count),
      legacySource: true,
      name: entry.name,
      paymentUnknown: true,
      productGroup: "Legacy",
      transferLeadToCrm: false,
      type: "Legacy"
    });
  });

  const currentTypes = (Array.isArray(state?.workshopTypes) ? state.workshopTypes : []) as unknown[];
  const hasLegacyType = currentTypes.some((entry) => mergeNameKey(objectName(entry)) === "legacy");
  const workshopTypes = hasLegacyType
    ? currentTypes
    : [...currentTypes, { id: "legacy-workshop-type", name: "Legacy" }];

  await saveAppState({
    facilitators: Array.from(facilitatorMap.values()),
    workshops: Array.from(workshopMap.values()),
    workshopTypes
  });
}

export async function finishLegacyImport(runId: string) {
  await ensureCrmSchema();
  const pool = requirePool();
  const current = await getLegacyImportRun(runId);
  if (!current) throw new Error("Import run not found.");
  if (current.processedRows !== current.expectedRows) {
    throw new Error(`Import is incomplete: ${current.processedRows} of ${current.expectedRows} rows processed.`);
  }

  await pool.query(
    `
      UPDATE crm_import_runs
      SET status = 'complete', completed_at = NOW(), last_error = NULL, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `,
    [runId, TENANT_ID]
  );
  await syncLegacyMastersToAppState();
  return getCrmSummary();
}

export async function getCrmSummary() {
  await ensureCrmSchema();
  const pool = requirePool();
  const result = await pool.query<{
    clients: number;
    duplicate_rows: number;
    facilitators: number;
    failed: number;
    import_rows: number;
    refunds: number;
    registrations: number;
    success: number;
    workshop_batches: number;
    workshop_masters: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::INTEGER FROM crm_clients WHERE tenant_id = '${TENANT_ID}' AND deleted_at IS NULL) AS clients,
      (SELECT COUNT(*)::INTEGER FROM crm_facilitators WHERE tenant_id = '${TENANT_ID}') AS facilitators,
      (SELECT COUNT(*)::INTEGER FROM crm_workshop_masters WHERE tenant_id = '${TENANT_ID}') AS workshop_masters,
      (SELECT COUNT(*)::INTEGER FROM crm_workshop_batches WHERE tenant_id = '${TENANT_ID}') AS workshop_batches,
      (SELECT COUNT(*)::INTEGER FROM crm_registrations WHERE tenant_id = '${TENANT_ID}') AS registrations,
      (SELECT COUNT(*)::INTEGER FROM crm_import_rows AS import_row JOIN crm_import_runs AS import_run ON import_run.id = import_row.import_run_id WHERE import_run.tenant_id = '${TENANT_ID}') AS import_rows,
      (SELECT COUNT(*)::INTEGER FROM crm_import_rows AS import_row JOIN crm_import_runs AS import_run ON import_run.id = import_row.import_run_id WHERE import_run.tenant_id = '${TENANT_ID}' AND import_row.is_duplicate = TRUE) AS duplicate_rows,
      (SELECT COUNT(*)::INTEGER FROM crm_registrations WHERE tenant_id = '${TENANT_ID}' AND status = 'Success') AS success,
      (SELECT COUNT(*)::INTEGER FROM crm_registrations WHERE tenant_id = '${TENANT_ID}' AND status = 'Failed') AS failed,
      (SELECT COUNT(*)::INTEGER FROM crm_registrations WHERE tenant_id = '${TENANT_ID}' AND status = 'Refund') AS refunds
  `);
  const row = result.rows[0];
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

function encodeCursor(id: string) {
  return Buffer.from(JSON.stringify({ id }), "utf8").toString("base64url");
}

function decodeCursor(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { id?: unknown };
    return typeof parsed.id === "string" || typeof parsed.id === "number" ? String(parsed.id) : null;
  } catch {
    return null;
  }
}

export async function listCrmClients(input: {
  cursor?: string | null;
  limit?: number;
  query?: string;
  status?: string;
}) {
  await ensureCrmSchema();
  const pool = requirePool();
  const limit = Math.min(100, Math.max(10, Number(input.limit) || 25));
  const values: unknown[] = [TENANT_ID];
  const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
  if (input.status && ["Active", "Inactive", "Suspect"].includes(input.status)) {
    values.push(input.status);
    conditions.push(`status = $${values.length}`);
  }
  const query = input.query?.trim().toLowerCase() ?? "";
  if (query) {
    const digits = query.replace(/\D/g, "");
    values.push(`${query}%`);
    const textParam = `$${values.length}`;
    if (digits) {
      values.push(`${digits}%`);
      conditions.push(`(mobile_normalized LIKE $${values.length} OR LOWER(name) LIKE ${textParam} OR LOWER(email) LIKE ${textParam})`);
    } else {
      conditions.push(`(LOWER(name) LIKE ${textParam} OR LOWER(email) LIKE ${textParam} OR LOWER(city) LIKE ${textParam})`);
    }
  }
  const filteredWhere = conditions.join(" AND ");
  const filteredValues = [...values];
  const cursorId = decodeCursor(input.cursor);
  if (cursorId) {
    values.push(cursorId);
    conditions.push(`id < $${values.length}`);
  }
  values.push(limit + 1);

  const where = conditions.join(" AND ");
  const [rowsResult, countResult, filteredCountResult] = await Promise.all([
    pool.query<{
      city: string;
      country: string;
      dob: string | null;
      email: string;
      gender: string;
      id: string;
      mobile: string;
      name: string;
      occupation: string;
      state: string;
      status: "Active" | "Inactive" | "Suspect";
    }>(`
      SELECT id, name, mobile, email, dob, gender, occupation, country, state, city, status
      FROM crm_clients
      WHERE ${where}
      ORDER BY id DESC
      LIMIT $${values.length}
    `, values),
    pool.query<{ status: string; total: number }>(`
      SELECT status, COUNT(*)::INTEGER AS total
      FROM crm_clients
      WHERE tenant_id = $1 AND deleted_at IS NULL
      GROUP BY status
    `, [TENANT_ID]),
    pool.query<{ total: number }>(`
      SELECT COUNT(*)::INTEGER AS total
      FROM crm_clients
      WHERE ${filteredWhere}
    `, filteredValues)
  ]);

  const hasMore = rowsResult.rows.length > limit;
  const rows = hasMore ? rowsResult.rows.slice(0, limit) : rowsResult.rows;
  const counts = { Active: 0, Inactive: 0, Suspect: 0 };
  countResult.rows.forEach((row) => {
    if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.total);
  });
  return {
    clients: rows.map((row) => ({ ...row, id: Number(row.id), dob: row.dob ?? "" })),
    counts,
    hasMore,
    nextCursor: hasMore && rows.length ? encodeCursor(rows[rows.length - 1].id) : null,
    total: Number(filteredCountResult.rows[0]?.total ?? 0)
  };
}

export async function listCrmWorkshops() {
  await ensureCrmSchema();
  const pool = requirePool();
  const [workshops, facilitators] = await Promise.all([
    pool.query<{
      batch_count: number;
      facilitators: string[];
      id: string;
      name: string;
      registration_count: number;
    }>(`
      WITH batch_summary AS (
        SELECT
          batch.workshop_id,
          COUNT(*)::INTEGER AS batch_count,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT facilitator.name), NULL) AS facilitators
        FROM crm_workshop_batches AS batch
        LEFT JOIN crm_facilitators AS facilitator ON facilitator.id = batch.facilitator_id
        GROUP BY batch.workshop_id
      ),
      registration_summary AS (
        SELECT workshop_id, COUNT(*)::INTEGER AS registration_count
        FROM crm_registrations
        WHERE tenant_id = $1
        GROUP BY workshop_id
      )
      SELECT
        workshop.id,
        workshop.name,
        COALESCE(batch_summary.batch_count, 0)::INTEGER AS batch_count,
        COALESCE(registration_summary.registration_count, 0)::INTEGER AS registration_count,
        COALESCE(batch_summary.facilitators, '{}'::text[]) AS facilitators
      FROM crm_workshop_masters AS workshop
      LEFT JOIN batch_summary ON batch_summary.workshop_id = workshop.id
      LEFT JOIN registration_summary ON registration_summary.workshop_id = workshop.id
      WHERE workshop.tenant_id = $1
      ORDER BY registration_count DESC, workshop.name
    `, [TENANT_ID]),
    pool.query<{
      id: string;
      name: string;
      registration_count: number;
      workshop_count: number;
    }>(`
      SELECT
        facilitator.id,
        facilitator.name,
        COUNT(DISTINCT batch.workshop_id)::INTEGER AS workshop_count,
        COUNT(registration.id)::INTEGER AS registration_count
      FROM crm_facilitators AS facilitator
      LEFT JOIN crm_workshop_batches AS batch ON batch.facilitator_id = facilitator.id
      LEFT JOIN crm_registrations AS registration ON registration.workshop_batch_id = batch.id
      WHERE facilitator.tenant_id = $1
      GROUP BY facilitator.id
      ORDER BY registration_count DESC, facilitator.name
    `, [TENANT_ID])
  ]);
  return {
    workshops: workshops.rows.map((row) => ({
      ...row,
      batch_count: Number(row.batch_count),
      registration_count: Number(row.registration_count)
    })),
    facilitators: facilitators.rows.map((row) => ({
      ...row,
      registration_count: Number(row.registration_count),
      workshop_count: Number(row.workshop_count)
    }))
  };
}

export async function listCrmRegistrations(input: {
  cursor?: string | null;
  limit?: number;
  query?: string;
  status?: string;
  workshopId?: string;
}) {
  await ensureCrmSchema();
  const pool = requirePool();
  const limit = Math.min(100, Math.max(10, Number(input.limit) || 25));
  const values: unknown[] = [TENANT_ID];
  const conditions = ["registration.tenant_id = $1"];
  if (input.workshopId) {
    values.push(input.workshopId);
    conditions.push(`registration.workshop_id = $${values.length}`);
  }
  if (input.status && ["Success", "Failed", "Refund", "Paid", "Due"].includes(input.status)) {
    values.push(input.status);
    conditions.push(`registration.status = $${values.length}`);
  }
  const query = input.query?.trim().toLowerCase() ?? "";
  if (query) {
    values.push(`%${query}%`);
    conditions.push(`(LOWER(client.name) LIKE $${values.length} OR client.mobile_normalized LIKE $${values.length})`);
  }
  const cursorId = decodeCursor(input.cursor);
  if (cursorId) {
    values.push(cursorId);
    conditions.push(`registration.id < $${values.length}`);
  }
  values.push(limit + 1);

  const result = await pool.query<{
    batch: string;
    city: string;
    client_id: string;
    client_name: string;
    email: string;
    facilitator: string;
    id: string;
    mobile: string;
    registered_at: string;
    source_status_code: string | null;
    status: string;
    workshop: string;
  }>(`
    SELECT
      registration.id,
      registration.registered_at,
      registration.status,
      registration.source_status_code,
      client.id AS client_id,
      client.name AS client_name,
      client.mobile,
      client.email,
      client.city,
      workshop.name AS workshop,
      batch.source_workshop_name AS batch,
      facilitator.name AS facilitator
    FROM crm_registrations AS registration
    JOIN crm_clients AS client ON client.id = registration.client_id
    JOIN crm_workshop_masters AS workshop ON workshop.id = registration.workshop_id
    JOIN crm_workshop_batches AS batch ON batch.id = registration.workshop_batch_id
    JOIN crm_facilitators AS facilitator ON facilitator.id = batch.facilitator_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY registration.id DESC
    LIMIT $${values.length}
  `, values);
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  return {
    hasMore,
    nextCursor: hasMore && rows.length ? encodeCursor(rows[rows.length - 1].id) : null,
    registrations: rows
  };
}

function cleanMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
}

function identityKeyForClient(mobile: string, email: string, name: string, city: string) {
  const digits = cleanMobile(mobile);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `m:${digits}`;
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.includes("@")) return `e:${normalizedEmail}`;
  return `n:${mergeNameKey(name)}|${mergeNameKey(city)}|${digits}`;
}

export async function saveCrmClient(input: {
  city?: string;
  country?: string;
  dob?: string;
  email?: string;
  gender?: string;
  id?: number | string;
  mobile: string;
  name: string;
  occupation?: string;
  state?: string;
  status?: string;
}) {
  await ensureCrmSchema();
  const pool = requirePool();
  const mobile = input.mobile.trim();
  const mobileNormalized = cleanMobile(mobile);
  const validMobile = mobileNormalized.length === 10 && /^[6-9]/.test(mobileNormalized);
  const identityKey = identityKeyForClient(mobile, input.email ?? "", input.name, input.city ?? "");
  const status = ["Active", "Inactive", "Suspect"].includes(input.status ?? "") ? input.status : "Active";

  if (input.id) {
    const result = await pool.query(`
      UPDATE crm_clients
      SET
        identity_key = $1,
        name = $2,
        mobile = $3,
        mobile_normalized = $4,
        valid_mobile = $5,
        email = $6,
        dob = NULLIF($7, '')::date,
        gender = $8,
        occupation = $9,
        country = $10,
        state = $11,
        city = $12,
        status = $13,
        deleted_at = NULL,
        updated_at = NOW()
      WHERE id = $14 AND tenant_id = $15
      RETURNING id
    `, [
      identityKey,
      input.name.trim(),
      mobile,
      mobileNormalized,
      validMobile,
      input.email?.trim() ?? "",
      input.dob ?? "",
      input.gender?.trim() ?? "",
      input.occupation?.trim() ?? "",
      input.country?.trim() || "India",
      input.state?.trim() ?? "",
      input.city?.trim() ?? "",
      status,
      input.id,
      TENANT_ID
    ]);
    if (!result.rowCount) throw new Error("Client not found.");
    return { created: false, id: Number(result.rows[0].id) };
  }

  const result = await pool.query(`
    INSERT INTO crm_clients (
      tenant_id, identity_key, name, mobile, mobile_normalized, valid_mobile,
      email, dob, gender, occupation, country, state, city, status, source
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::date, $9, $10, $11, $12, $13, $14, 'app'
    )
    ON CONFLICT (tenant_id, identity_key) DO UPDATE SET
      name = EXCLUDED.name,
      mobile = EXCLUDED.mobile,
      email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE crm_clients.email END,
      occupation = CASE WHEN EXCLUDED.occupation <> '' THEN EXCLUDED.occupation ELSE crm_clients.occupation END,
      country = EXCLUDED.country,
      state = CASE WHEN EXCLUDED.state <> '' THEN EXCLUDED.state ELSE crm_clients.state END,
      city = CASE WHEN EXCLUDED.city <> '' THEN EXCLUDED.city ELSE crm_clients.city END,
      status = EXCLUDED.status,
      deleted_at = NULL,
      updated_at = NOW()
    RETURNING id, (xmax = 0) AS inserted
  `, [
    TENANT_ID,
    identityKey,
    input.name.trim(),
    mobile,
    mobileNormalized,
    validMobile,
    input.email?.trim() ?? "",
    input.dob ?? "",
    input.gender?.trim() ?? "",
    input.occupation?.trim() ?? "",
    input.country?.trim() || "India",
    input.state?.trim() ?? "",
    input.city?.trim() ?? "",
    status
  ]);
  return { created: Boolean(result.rows[0].inserted), id: Number(result.rows[0].id) };
}

export async function deleteCrmClient(id: string) {
  await ensureCrmSchema();
  const pool = requirePool();
  const result = await pool.query(
    `UPDATE crm_clients SET deleted_at = NOW(), status = 'Inactive', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    [id, TENANT_ID]
  );
  return Boolean(result.rowCount);
}

export async function upsertLiveRegistration(input: Record<string, unknown>) {
  await ensureCrmSchema();
  const pool = requirePool();
  const client = await pool.connect();
  const name = String(input.fullName ?? "Guest").trim();
  const mobile = String(input.mobile ?? "").trim();
  const email = String(input.email ?? "").trim();
  const city = String(input.city ?? "").trim();
  const workshopName = String(input.workshopTitle ?? "Workshop").trim();
  const workshopId = String(input.workshopId ?? workshopName).trim();
  const batchName = String(input.batch ?? "Main Batch").trim();
  const facilitatorName = String(input.facilitator ?? "CFL Facilitator").trim();
  const externalId = String(input.id ?? "").trim();
  const status = input.status === "Due" ? "Due" : "Paid";
  const mobileNormalized = cleanMobile(mobile);
  const validMobile = mobileNormalized.length === 10 && /^[6-9]/.test(mobileNormalized);
  const identityKey = identityKeyForClient(mobile, email, name, city);
  const workshopNormalized = `app:${workshopId.toLowerCase()}`;
  const batchNormalized = `${workshopNormalized}:${batchName.toLowerCase()}`;
  const facilitatorNormalized = mergeNameKey(facilitatorName);

  try {
    await client.query("BEGIN");
    const facilitator = await client.query<{ id: string }>(`
      INSERT INTO crm_facilitators (tenant_id, name, normalized_name, is_legacy)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (tenant_id, normalized_name) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `, [TENANT_ID, facilitatorName, facilitatorNormalized]);
    const workshop = await client.query<{ id: string }>(`
      INSERT INTO crm_workshop_masters (
        tenant_id, name, normalized_name, default_facilitator_id,
        workshop_type, product_group, payment_type, archived, is_legacy
      ) VALUES ($1, $2, $3, $4, 'Workshop', 'Live', 'Known', FALSE, FALSE)
      ON CONFLICT (tenant_id, normalized_name) DO UPDATE SET
        archived = FALSE,
        updated_at = NOW()
      RETURNING id
    `, [TENANT_ID, workshopName, workshopNormalized, facilitator.rows[0].id]);
    const batch = await client.query<{ id: string }>(`
      INSERT INTO crm_workshop_batches (
        tenant_id, workshop_id, facilitator_id, source_workshop_name,
        normalized_source_name, batch_label, archived, is_legacy
      ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE)
      ON CONFLICT (tenant_id, normalized_source_name) DO UPDATE SET
        facilitator_id = EXCLUDED.facilitator_id,
        archived = FALSE,
        updated_at = NOW()
      RETURNING id
    `, [TENANT_ID, workshop.rows[0].id, facilitator.rows[0].id, `${workshopName} - ${batchName}`, batchNormalized, batchName]);
    const crmClient = await client.query<{ id: string }>(`
      INSERT INTO crm_clients (
        tenant_id, identity_key, name, mobile, mobile_normalized, valid_mobile,
        email, city, status, source, first_registered_at, last_registered_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', 'registration', NOW(), NOW())
      ON CONFLICT (tenant_id, identity_key) DO UPDATE SET
        name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE crm_clients.name END,
        email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE crm_clients.email END,
        city = CASE WHEN EXCLUDED.city <> '' THEN EXCLUDED.city ELSE crm_clients.city END,
        last_registered_at = NOW(),
        deleted_at = NULL,
        updated_at = NOW()
      RETURNING id
    `, [TENANT_ID, identityKey, name, mobile, mobileNormalized, validMobile, email, city]);
    await client.query(`
      INSERT INTO crm_registrations (
        tenant_id, external_id, client_id, workshop_id, workshop_batch_id,
        registered_at, status, payment_mode, amount_paid, amount_due, is_legacy
      ) VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7, $8, $9, $10, FALSE)
      ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
        client_id = EXCLUDED.client_id,
        workshop_id = EXCLUDED.workshop_id,
        workshop_batch_id = EXCLUDED.workshop_batch_id,
        status = EXCLUDED.status,
        payment_mode = EXCLUDED.payment_mode,
        amount_paid = EXCLUDED.amount_paid,
        amount_due = EXCLUDED.amount_due,
        updated_at = NOW()
    `, [
      TENANT_ID,
      externalId,
      crmClient.rows[0].id,
      workshop.rows[0].id,
      batch.rows[0].id,
      String(input.createdAt ?? new Date().toISOString()),
      status,
      String(input.paymentMode ?? "Full"),
      Number(input.amountPaid ?? 0),
      Number(input.amountDue ?? 0)
    ]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
