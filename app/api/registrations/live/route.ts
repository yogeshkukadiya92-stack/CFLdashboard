import { ensureRegistrationRecordsTable, getDbPool, isDbEnabled, readRegistrationRecords } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false, registrations: [] });
  }

  try {
    const database = getDbPool();
    if (!database) return NextResponse.json({ dbEnabled: false, registrations: [] });

    await ensureRegistrationRecordsTable();
    const versionResult = await database.query<{ version: string }>(
      `SELECT md5(COALESCE(MAX(updated_at)::text, 'empty') || ':' || COUNT(*)::text) AS version FROM cfl_registration_records`
    );
    const version = versionResult.rows[0]?.version ?? "empty";
    const etag = `"${version}"`;

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    const registrations = await readRegistrationRecords();
    return NextResponse.json(
      { dbEnabled: true, registrations },
      { headers: { "Cache-Control": "no-store", ETag: etag } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to read live registrations" }, { status: 500 });
  }
}
