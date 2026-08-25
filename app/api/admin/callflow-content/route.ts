import { NextRequest, NextResponse } from "next/server";
import { getAppState, saveAppState } from "@/lib/db";

export type CallFlowContentItem = { id: string; title: string; body: string; category: string; active: boolean; updatedAt: string };
type ContentConfig = { announcements: CallFlowContentItem[]; scripts: CallFlowContentItem[]; updatedAt: string };

const empty = (): ContentConfig => ({ announcements: [], scripts: [], updatedAt: new Date(0).toISOString() });

export async function GET() {
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const value = (state.integrations.callFlowContent || empty()) as ContentConfig;
  return NextResponse.json({ ...empty(), ...value });
}

export async function POST(request: NextRequest) {
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json() as Partial<ContentConfig>;
  const clean = (items: CallFlowContentItem[] | undefined) => (Array.isArray(items) ? items : []).slice(0, 100).map((item) => ({ ...item, title: String(item.title || "").trim().slice(0, 100), body: String(item.body || "").trim().slice(0, 4000), category: String(item.category || "General").trim().slice(0, 40), active: item.active !== false, updatedAt: new Date().toISOString() })).filter((item) => item.title && item.body);
  const value: ContentConfig = { announcements: clean(body.announcements), scripts: clean(body.scripts), updatedAt: new Date().toISOString() };
  await saveAppState({ integrations: { ...state.integrations, callFlowContent: value } });
  return NextResponse.json(value);
}
