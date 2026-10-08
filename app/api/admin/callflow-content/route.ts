import { NextRequest, NextResponse } from "next/server";
import { getAppState, saveAppState } from "@/lib/db";

import { introductionStatuses, validateIntroductionStatuses, defaultIntroductionStatuses, type IntroductionStatus } from "@/lib/introduction-statuses";

export type CallFlowContentItem = { id: string; title: string; body: string; category: string; active: boolean; updatedAt: string };
type ContentConfig = { introductionStatuses: IntroductionStatus[]; announcements: CallFlowContentItem[]; scripts: CallFlowContentItem[]; noteTemplates: string[]; updatedAt: string };

const defaults = ["No answer", "Call back tomorrow", "Interested", "Price shared", "Meeting booked", "Not eligible", "Wrong number"];
const empty = (): ContentConfig => ({ introductionStatuses: defaultIntroductionStatuses, announcements: [], scripts: [], noteTemplates: defaults, updatedAt: new Date(0).toISOString() });

export async function GET() {
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const value = (state.integrations.callFlowContent || empty()) as ContentConfig;
  return NextResponse.json({ ...empty(), ...value, introductionStatuses: introductionStatuses(state.integrations) });
}

export async function POST(request: NextRequest) {
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json() as Partial<ContentConfig>;
  const previous = (state.integrations.callFlowContent || empty()) as ContentConfig;
  const clean = (items: CallFlowContentItem[] | undefined) => (Array.isArray(items) ? items : []).slice(0, 100).map((item) => ({ ...item, title: String(item.title || "").trim().slice(0, 100), body: String(item.body || "").trim().slice(0, 4000), category: String(item.category || "General").trim().slice(0, 40), active: item.active !== false, updatedAt: new Date().toISOString() })).filter((item) => item.title && item.body);
  const noteTemplates = (Array.isArray(body.noteTemplates) ? body.noteTemplates : previous.noteTemplates || defaults).map(String).map((value) => value.trim().slice(0, 120)).filter(Boolean).slice(0, 20);
  let statuses: IntroductionStatus[];
  try { statuses = body.introductionStatuses === undefined ? introductionStatuses(state.integrations) : validateIntroductionStatuses(body.introductionStatuses, introductionStatuses(state.integrations)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid statuses" }, { status: 400 }); }
  const value: ContentConfig = { introductionStatuses: statuses, announcements: clean(body.announcements === undefined ? previous.announcements : body.announcements), scripts: clean(body.scripts === undefined ? previous.scripts : body.scripts), noteTemplates, updatedAt: new Date().toISOString() };
  await saveAppState({ integrations: { ...state.integrations, callFlowContent: value } });
  return NextResponse.json(value);
}
