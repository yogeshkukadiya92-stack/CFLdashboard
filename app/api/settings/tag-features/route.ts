import { extractWorkshopTags, type WorkshopTagRecord } from "@/lib/workshop-tags";
import { ensurePersistenceTable, getDbPool } from "@/lib/db";
import { features } from "@/lib/tag-features";
import { NextResponse } from "next/server";

async function database() {
  const db = getDbPool();
  if (!db) throw new Error("Database unavailable");
  await db.query("CREATE TABLE IF NOT EXISTS workshop_tag_features (tag_key TEXT PRIMARY KEY, name TEXT NOT NULL, disabled JSONB NOT NULL)");
  return db;
}
export async function GET() {
  try {
    const db = await database();
    const result = await db.query("SELECT name, disabled FROM workshop_tag_features ORDER BY name");
    await ensurePersistenceTable();
    const state = await db.query<{ workshops: WorkshopTagRecord[] }>("SELECT workshops FROM app_state WHERE id = 1");
    const policies = new Map(result.rows.map(row => [row.name.trim().toLowerCase(), row]));
    for (const workshop of state.rows[0]?.workshops ?? []) {
      for (const name of extractWorkshopTags(workshop)) {
        const key = name.toLowerCase();
        if (!policies.has(key)) policies.set(key, { name, disabled: [] });
      }
    }
    return NextResponse.json(Array.from(policies.values()).sort((a, b) => a.name.localeCompare(b.name)), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({error: "Could not load tag features."}, {status: 503});
  }
}
export async function PUT(request: Request) {
  try {
    const { name, disabled } = await request.json();
    if (typeof name !== "string" || !name.trim() || name.length > 100 || name.includes(",") || !Array.isArray(disabled) || !disabled.every(item => features.includes(item))) {
      return NextResponse.json({error: "Invalid tag or features."}, {status: 400});
    }
    const db = await database();
    await db.query("INSERT INTO workshop_tag_features VALUES ($1,$2,$3::jsonb) ON CONFLICT(tag_key) DO UPDATE SET name=EXCLUDED.name, disabled=EXCLUDED.disabled", [name.trim().toLowerCase(), name.trim(), JSON.stringify(disabled)]);
    return NextResponse.json({ok:true});
  } catch {
    return NextResponse.json({error:"Could not save tag features."}, {status:503});
  }
}
