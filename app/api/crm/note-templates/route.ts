import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken, getAdminName } from "@/lib/auth";
import { readSalesSession, SALES_SESSION_COOKIE } from "@/lib/sales-session";
import { getDbPool, getCrmDashboardState } from "@/lib/db";
import { cleanNoteFields } from "@/lib/crm-note-fields";
import type { SalesTeamUser } from "@/lib/types";
async function identity(request: NextRequest) {
  if (await verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)) return { id: "admin", name: getAdminName(), admin: true };
  const session = await readSalesSession(request.cookies.get(SALES_SESSION_COOKIE)?.value);
  if (!session || !session.permissions.some(permission => permission === "crm_today" || permission === "lead_details")) return null;
  const state = await getCrmDashboardState(false);
  const user = (state?.salesTeamUsers as SalesTeamUser[] | undefined)?.find(u => u.id === session.userId && u.active);
  return user ? { id: session.userId, name: session.name, admin: false } : null;
}
async function database() {
  const pool = getDbPool();
  if (!pool) throw new Error("Templates are unavailable. Please try again later.");
  await pool.query(`CREATE TABLE IF NOT EXISTS crm_note_templates (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, shared BOOLEAN NOT NULL DEFAULT FALSE, payload JSONB NOT NULL)`);
  return pool;
}
export async function GET(request: NextRequest) {
  try {
    const user = await identity(request);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const db = await database().catch(() => null);
    if (!db) return NextResponse.json({ user, templates: [], error: "Saved question sets are unavailable. Draft saving is still on." });
    const rows = await db.query("SELECT payload FROM crm_note_templates WHERE owner_id = $1 OR shared = TRUE ORDER BY payload->>'name'", [user.id]);
    return NextResponse.json({ user, templates: rows.rows.map(row=>row.payload) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Could not load saved question sets." }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await identity(request);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name || name.length > 100) return NextResponse.json({ error: "Enter a name under 100 characters." }, { status: 400 });
    const fields = cleanNoteFields(body.fields).map(field=>({...field,value:""}));
    if (!fields.length) return NextResponse.json({ error: "Add at least one question first." }, { status: 400 });
    if (body.shared && !user.admin) return NextResponse.json({ error: "Only an admin can share a set with the team." }, { status: 403 });
    const template = { id: crypto.randomUUID(), name, fields, shared: Boolean(body.shared), ownerId: user.id };
    const db = await database();
    await db.query("INSERT INTO crm_note_templates (id,owner_id,shared,payload) VALUES ($1,$2,$3,$4::jsonb)", [template.id,user.id,template.shared,JSON.stringify(template)]);
    return NextResponse.json({ template });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save question set." }, { status: 400 }); }
}
