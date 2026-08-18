import { NextResponse } from "next/server";
import { addSessionParticipant, bookParticipantMeeting, createSalesSession, getLeadSalesHistory, listSalesSessions, saveParticipantScorecard } from "@/lib/crm-sales-db";
import { SCORECARD_CONFIG, type ScorecardInput } from "@/lib/crm-scorecard";

const actor = "Admin";
const has = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

function validAnswers(value: unknown): value is ScorecardInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return has(SCORECARD_CONFIG.turnover, String(item.turnoverOption)) && has(SCORECARD_CONFIG.teamSize, String(item.teamSizeOption)) &&
    has(SCORECARD_CONFIG.timeFreedom, String(item.timeFreedomOption)) && has(SCORECARD_CONFIG.vintage, String(item.vintageOption)) &&
    ["A", "C", "-"].includes(String(item.instantSignal)) && ["attended","onTime","notesTaken","askedQuestion","stayedUntilEnd","cameWithSomeone","metPersonally"].every((key) => typeof item[key] === "boolean");
}

export async function GET(request: Request) {
  try { const params = new URL(request.url).searchParams; const leadId=params.get("leadId"); return NextResponse.json(leadId ? await getLeadSalesHistory(leadId) : await listSalesSessions(params.get("sessionId") || undefined)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load sessions." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "create_session") {
      if (!String(body.name || "").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.sessionDate || ""))) return NextResponse.json({ error: "Name and a valid session date are required." }, { status: 400 });
      return NextResponse.json({ session: await createSalesSession({ name: String(body.name).trim(), sessionDate: String(body.sessionDate), startTime: String(body.startTime || ""), endTime: String(body.endTime || ""), location: String(body.location || ""), capacity: Number(body.capacity) || undefined, actor }) });
    }
    if (body.action === "add_participant") {
      if (!body.sessionId || !body.leadId || !String(body.leadName || "").trim()) return NextResponse.json({ error: "Session, lead and name are required." }, { status: 400 });
      return NextResponse.json({ participant: await addSessionParticipant({ sessionId: String(body.sessionId), leadId: String(body.leadId), leadName: String(body.leadName).trim(), mobile: String(body.mobile || ""), business: String(body.business || ""), observer: String(body.observer || ""), actor }) });
    }
    if (body.action === "save_scorecard") {
      if (!body.participantId || !validAnswers(body.answers)) return NextResponse.json({ error: "A complete, valid scorecard is required." }, { status: 400 });
      return NextResponse.json({ scorecard: await saveParticipantScorecard({ participantId: String(body.participantId), answers: body.answers, notes: String(body.notes || ""), observer: String(body.observer || actor) }) });
    }
    if (body.action === "book_meeting") {
      if (!body.participantId || !body.meetingAt || !String(body.owner || "").trim() || Number.isNaN(new Date(String(body.meetingAt)).getTime())) return NextResponse.json({ error: "Participant, meeting time and owner are required." }, { status: 400 });
      return NextResponse.json({ meeting: await bookParticipantMeeting({ participantId: String(body.participantId), meetingAt: new Date(String(body.meetingAt)).toISOString(), owner: String(body.owner).trim(), notes: String(body.notes || ""), actor }) });
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "CRM mutation failed." }, { status: 500 }); }
}
