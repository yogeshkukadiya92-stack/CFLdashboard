import { getAppState, isDbEnabled } from "@/lib/db";
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
    const state = await getAppState();
    if (!state) return NextResponse.json({ dbEnabled: true, profile: null });

    if (formType === "attendance") {
      const validSession = state.attendanceSessions.some((value: unknown) => {
        const session = value as { published?: unknown; slug?: unknown };
        return text(session.slug) === slug && session.published !== false;
      });
      if (!validSession) return NextResponse.json({ profile: null }, { status: 404 });
    } else {
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
