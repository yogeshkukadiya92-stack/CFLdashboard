import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAppState, getDbPool } from "@/lib/db";
import { importedCallHistory } from "@/lib/imported-call-history";
import { normalizedCallPhone, type CallFlowCallRecord } from "@/lib/callflow-connector";

const authorized = (request: NextRequest) => verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
export async function GET(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ records: await importedCallHistory() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await request.json().catch(() => null);
  if (!Array.isArray(rows) || !rows.length || rows.length > 10000) {
    return NextResponse.json({ error: "Select a prepared call history file." }, { status: 400 });
  }
  const state = await getAppState();
  const db = getDbPool();
  if (!state || !db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const people = state.salesPeople as { id: string; name: string }[];
  const leads = state.leads as { id: string; mobile: string }[];
  const records: CallFlowCallRecord[] = [];
  for (const row of rows) {
    if (!row || !/^legacy-[a-f0-9]{32}$/.test(row.id) || !/^\d{10}$/.test(row.phone) ||
        typeof row.startedAt !== "string" || !Number.isFinite(Date.parse(row.startedAt)) ||
        typeof row.owner !== "string" || typeof row.leadName !== "string" ||
        typeof row.outcome !== "string" || typeof row.note !== "string") {
      return NextResponse.json({ error: "Invalid call history row." }, { status: 400 });
    }
    const matches = people.filter(person => person.name.trim().toLowerCase() === row.owner);
    if (matches.length !== 1) return NextResponse.json({ error: `Map salesperson "${row.owner}" to one CFL account before importing.` }, { status: 409 });
    const [person] = matches;
    const matchingLeads = leads.filter(lead => normalizedCallPhone(lead.mobile) === row.phone);
    records.push({
      id: row.id, eventUuid: row.id, leadId: matchingLeads.length === 1 ? matchingLeads[0].id : "",
      leadName: row.leadName, salespersonId: person.id, salespersonName: person.name, campaign: "",
      phone: row.phone, direction: "OUTGOING", startedAt: new Date(row.startedAt).toISOString(),
      endedAt: "", durationSeconds: 0, connected: false, outcome: row.outcome,
      note: row.note || undefined, source: "External call history",
    });
  }
  if (request.nextUrl.searchParams.get("preview") === "1") {
    return NextResponse.json({ ready: records.length, salespeople: [...new Set(records.map(row => row.salespersonName))] });
  }
  await db.query("CREATE TABLE IF NOT EXISTS cfl_imported_calls (id text PRIMARY KEY, salesperson_id text NOT NULL, imported_at timestamptz NOT NULL DEFAULT clock_timestamp(), payload jsonb NOT NULL)");
  const inserted = await db.query(
    `INSERT INTO cfl_imported_calls (id, salesperson_id, payload)
     SELECT item->>'id', item->>'salespersonId', item FROM jsonb_array_elements($1::jsonb) item
     ON CONFLICT (id) DO NOTHING`, [JSON.stringify(records)],
  );
  return NextResponse.json({ imported: inserted.rowCount, alreadyImported: records.length - (inserted.rowCount || 0) });
}
