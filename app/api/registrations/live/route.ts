import { ensurePersistenceTable, getDbPool, isDbEnabled } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false, registrations: [] });
  }

  try {
    const database = getDbPool();
    if (!database) return NextResponse.json({ dbEnabled: false, registrations: [] });

    await ensurePersistenceTable();
    const versionResult = await database.query<{ version: string }>(
      `SELECT md5(registrations::text) AS version FROM app_state WHERE id = 1 LIMIT 1`
    );
    const version = versionResult.rows[0]?.version ?? "empty";
    const etag = `"${version}"`;

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    const registrationsResult = await database.query<{ registrations: unknown[] }>(
      `SELECT registrations FROM app_state WHERE id = 1 LIMIT 1`
    );
    return NextResponse.json(
      { dbEnabled: true, registrations: registrationsResult.rows[0]?.registrations ?? [] },
      { headers: { "Cache-Control": "no-store", ETag: etag } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to read live registrations" }, { status: 500 });
  }
}
