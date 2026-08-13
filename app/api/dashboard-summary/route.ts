import { NextResponse } from "next/server";
import { buildDashboardSnapshot, type DashboardRegistration, type DashboardSchedule, type DashboardWorkshop } from "@/lib/dashboard-summary";
import { ensurePersistenceTable, getDbPool, isDbEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const database = getDbPool();
    if (!database) return NextResponse.json({ dbEnabled: false });
    await ensurePersistenceTable();
    const result = await database.query<{
      clientCount: number;
      registrations: DashboardRegistration[];
      schedules: DashboardSchedule[];
      workshops: DashboardWorkshop[];
    }>(`
      SELECT
        jsonb_array_length(clients)::integer AS "clientCount",
        workshops,
        registrations,
        schedules
      FROM app_state
      WHERE id = 1
      LIMIT 1
    `);
    const state = result.rows[0];
    const snapshot = buildDashboardSnapshot(
      [],
      (state?.workshops ?? []) as DashboardWorkshop[],
      (state?.registrations ?? []) as DashboardRegistration[],
      (state?.schedules ?? []) as DashboardSchedule[],
      new Date(),
      Number(state?.clientCount ?? 0),
    );
    return NextResponse.json(
      { dbEnabled: true, snapshot },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { dbEnabled: true, error: "Failed to load dashboard summary." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
