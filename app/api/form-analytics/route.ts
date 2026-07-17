import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import type { FormAnalyticsRecord } from "@/lib/types";
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
    const state = await getAppState();
    const current = Array.isArray(state?.formAnalytics) ? state.formAnalytics as FormAnalyticsRecord[] : [];
    const existing = current.find((item) => item.formId === formId);
    const record: FormAnalyticsRecord = existing
      ? { ...existing, dropOffByField: { ...(existing.dropOffByField ?? {}) } }
      : {
          completions: 0,
          dropOffByField: {},
          formId,
          starts: 0,
          updatedAt: new Date().toISOString(),
          views: 0,
          workshopId,
          workshopSlug
        };

    if (event === "view") record.views += 1;
    if (event === "start") record.starts += 1;
    if (event === "complete") record.completions += 1;
    if (event === "drop_off" && fieldId) {
      record.dropOffByField[fieldId] = (record.dropOffByField[fieldId] ?? 0) + 1;
    }
    record.updatedAt = new Date().toISOString();
    record.workshopId = workshopId;
    record.workshopSlug = workshopSlug;

    await saveAppState({ formAnalytics: [record, ...current.filter((item) => item.formId !== formId)].slice(0, 1000) });
    return NextResponse.json({ ok: true, dbEnabled: true });
  } catch {
    return NextResponse.json({ error: "Failed to save analytics event" }, { status: 500 });
  }
}
