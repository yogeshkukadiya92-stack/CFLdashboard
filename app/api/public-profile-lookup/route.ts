import { ensureRegistrationRecordsTable, getAppState, getDbPool, isDbEnabled } from "@/lib/db";
import { NextResponse } from "next/server";

function mobileDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function slugify(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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

    const state = await getAppState();
    if (!state) return NextResponse.json({ dbEnabled: true, profile: null });

    {
      const knownLink = Object.values(state.registrationLinks).some((value: unknown) => {
        const link = value as { published?: unknown; slug?: unknown };
        return text(link.slug) === slug && link.published !== false;
      });
      const knownForm = state.forms.some((value: unknown) => {
        const form = value as { workshopSlug?: unknown };
        return text(form.workshopSlug) === slug;
      });
      const knownWorkshop = state.workshops.some((value: unknown) => {
        const workshop = value as { archived?: unknown; id?: unknown; name?: unknown };
        return workshop.archived !== true && (text(workshop.id) === slug || slugify(workshop.name) === slug);
      });
      if (!knownLink && !knownForm && !knownWorkshop) {
        return NextResponse.json({ profile: null }, { status: 404 });
      }
    }

    const clients = state.clients as Array<Record<string, unknown>>;
    const registrations = state.registrations as Array<Record<string, unknown>>;
    const attendanceEntries = state.attendanceEntries as Array<Record<string, unknown>>;
    const client = clients.find((item) => mobileDigits(item.mobile) === mobile);
    const registration = registrations.find((item) => mobileDigits(item.mobile) === mobile);
    const attendance = attendanceEntries.find((item) => mobileDigits(item.mobile) === mobile);
    const matches = [client, registration, attendance].filter(Boolean) as Array<Record<string, unknown>>;

    if (!matches.length) return NextResponse.json({ dbEnabled: true, profile: null });

    const firstValue = (...keys: string[]) => {
      for (const match of matches) {
        for (const key of keys) {
          const value = text(match[key]);
          if (value) return value;
        }
      }
      return "";
    };

    return NextResponse.json({
      dbEnabled: true,
      profile: {
        city: firstValue("city"),
        email: firstValue("email"),
        name: firstValue("name", "fullName", "attendeeName")
      }
    });
  } catch {
    return NextResponse.json({ error: "Failed to look up profile" }, { status: 500 });
  }
}
