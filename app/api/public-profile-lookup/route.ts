import { ensureRegistrationRecordsTable, getDbPool, isDbEnabled } from "@/lib/db";
import { NextResponse } from "next/server";

function mobileDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}


export async function GET(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false, profile: null });

  const params = new URL(request.url).searchParams;
  const mobile = mobileDigits(params.get("mobile"));
  const slug = text(params.get("slug"));
  const formType = params.get("type");
  if (mobile.length !== 10 || !/^[6-9]/.test(mobile) || !slug || (formType !== "attendance" && formType !== "registration")) {
    return NextResponse.json({ profile: null }, { status: 400 });
  }

  try {
    if (formType === "attendance") {
      const db = getDbPool();
      if (!db) return NextResponse.json({ dbEnabled: false, profile: null });
      // Validate the public link without hydrating registrations, CRM or analytics.
      const context = await db.query(`SELECT session, workshops FROM app_state,
        LATERAL jsonb_array_elements(attendance_sessions) session
        WHERE app_state.id=1 AND session->>'slug'=$1
          AND COALESCE(session->>'published', 'true') <> 'false' LIMIT 1`, [slug]);
      const session = context.rows[0]?.session;
      if (!session) return NextResponse.json({ profile: null }, { status: 404 });
      const workshops = (context.rows[0]?.workshops ?? []) as Array<Record<string, unknown>>;
      const workshop = workshops.find((item) => item.id === session.workshopId);
      const tag = text(workshop?.tag).toLowerCase();
      const relatedIds = workshops.filter((item) => tag && text(item.tag).toLowerCase() === tag).map((item) => text(item.id));
      await ensureRegistrationRecordsTable();
      // The existing mobile index limits this query to one person's records.
      const matches = await db.query(`SELECT payload FROM cfl_registration_records
        WHERE mobile_normalized=$1
        ORDER BY CASE WHEN workshop_id=$2 THEN 0 WHEN workshop_id=ANY($3::text[]) THEN 1 ELSE 2 END,
          created_at DESC, external_id DESC LIMIT 10`, [mobile, session.workshopId, relatedIds]);
      let profiles = matches.rows.map((row) => row.payload as Record<string, unknown>);
      if (!profiles.length) {
        const fallback = await db.query(`SELECT item FROM app_state,
          LATERAL jsonb_array_elements(clients || attendance_entries) item
          WHERE app_state.id=1 AND RIGHT(REGEXP_REPLACE(COALESCE(item->>'mobile',''), '[^0-9]', '', 'g'),10)=$1
          LIMIT 3`, [mobile]);
        profiles = fallback.rows.map((row) => row.item as Record<string, unknown>);
      }
      const value = (...keys: string[]) => {
        for (const profile of profiles) for (const key of keys) if (text(profile[key])) return text(profile[key]);
        return "";
      };
      return NextResponse.json({ dbEnabled: true, profile: profiles.length ? {
        name: value("name", "fullName", "attendeeName"), email: value("email"), city: value("city")
      } : null });
    }

    const db = getDbPool();
    if (!db) return NextResponse.json({ dbEnabled: false, profile: null });
    // Validate the link in SQL without reading registrations, leads or analytics.
    const context = await db.query(`SELECT
      EXISTS(SELECT 1 FROM jsonb_each(registration_links) l
        WHERE (l.key=$1 OR l.value->>'slug'=$1) AND COALESCE(l.value->>'published','true') <> 'false')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(forms) f WHERE f->>'workshopSlug'=$1)
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(workshops) w
        WHERE COALESCE(w->>'archived','false') <> 'true' AND (w->>'id'=$1 OR
          trim(both '-' from regexp_replace(lower(w->>'name'),'[^a-z0-9]+','-','g'))=$1)) AS valid
      FROM app_state WHERE id=1`, [slug]);
    if (!context.rows[0]?.valid) return NextResponse.json({ profile: null }, { status: 404 });
    await ensureRegistrationRecordsTable();
    const [clients, registrations] = await Promise.all([
      db.query(`SELECT jsonb_build_object('name', item->>'name', 'email', item->>'email', 'city', item->>'city') AS profile
        FROM app_state, LATERAL jsonb_array_elements(clients) item
        WHERE app_state.id=1 AND RIGHT(REGEXP_REPLACE(COALESCE(item->>'mobile',''), '[^0-9]', '', 'g'),10)=$1 LIMIT 1`, [mobile]),
      db.query(`SELECT jsonb_build_object('fullName', payload->>'fullName', 'email', payload->>'email', 'city', payload->>'city') AS profile
        FROM cfl_registration_records WHERE mobile_normalized=$1
        ORDER BY created_at DESC, external_id DESC LIMIT 1`, [mobile])
    ]);
    const matches = [clients.rows[0]?.profile, registrations.rows[0]?.profile].filter(Boolean) as Array<Record<string, unknown>>;
    // Most visitors match an indexed registration. Only scan legacy attendance
    // when a profile field is still missing; never hydrate the full app state.
    if (!matches.some(item => text(item.name) || text(item.fullName)) ||
        !matches.some(item => text(item.email)) || !matches.some(item => text(item.city))) {
      const attendance = await db.query(`SELECT jsonb_build_object('attendeeName', item->>'attendeeName',
          'name', item->>'name', 'fullName', item->>'fullName', 'email', item->>'email', 'city', item->>'city') AS profile
        FROM app_state, LATERAL jsonb_array_elements(attendance_entries) item
        WHERE app_state.id=1 AND RIGHT(REGEXP_REPLACE(COALESCE(item->>'mobile',''), '[^0-9]', '', 'g'),10)=$1 LIMIT 1`, [mobile]);
      if (attendance.rows[0]?.profile) matches.push(attendance.rows[0].profile);
    }
    const firstValue = (...keys: string[]) => {
      for (const match of matches) for (const key of keys) if (text(match[key])) return text(match[key]);
      return "";
    };
    return NextResponse.json({ dbEnabled: true, profile: matches.length ? {
      city: firstValue("city"), email: firstValue("email"), name: firstValue("name", "fullName", "attendeeName")
    } : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to look up profile" }, { status: 500 });
  }
}
