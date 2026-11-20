import { getDbPool } from "@/lib/db";
import type { CallFlowCallRecord } from "@/lib/callflow-connector";

export async function importedCallHistory(salespersonId?: string, since = 0) {
  const db = getDbPool();
  if (!db) return [];
  try {
    const result = await db.query<{ payload: CallFlowCallRecord }>(
      "SELECT payload FROM cfl_imported_calls WHERE ($1::text IS NULL OR salesperson_id=$1) AND ($2::bigint=0 OR imported_at >= to_timestamp($2::double precision / 1000))",
      [salespersonId ?? null, since],
    );
    return result.rows.map(row => row.payload);
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
}
