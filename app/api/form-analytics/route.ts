import { isDbEnabled, recordFormAnalyticsEvent } from "@/lib/db";
import { NextResponse } from "next/server";

const analyticsEvents = new Set(["view", "start", "complete", "drop_off"]);

function cleanIdentifier(value: unknown, fallback = "unknown") {
  const cleaned = String(value ?? "").trim().slice(0, 300);
  return cleaned || fallback;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = String(body?.event ?? "");
    if (!analyticsEvents.has(event)) {
      return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
    }

    if (!(await isDbEnabled())) {
      return NextResponse.json({ ok: true, dbEnabled: false });
    }

    const formId = cleanIdentifier(body?.formId);
    const workshopId = cleanIdentifier(body?.workshopId, formId);
    const workshopSlug = cleanIdentifier(body?.workshopSlug, workshopId);
    const fieldId = cleanIdentifier(body?.fieldId, "");
    await recordFormAnalyticsEvent({ formId, workshopId, workshopSlug, fieldId, event });
    return NextResponse.json({ ok: true, dbEnabled: true });
  } catch {
    return NextResponse.json({ error: "Failed to save analytics event" }, { status: 500 });
  }
}
