import { NextResponse } from "next/server";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";

const arrayFields = [
  "attendanceEntries",
  "attendanceSessions",
  "clients",
  "facilitators",
  "formAnalytics",
  "forms",
  "leads",
  "landingPages",
  "registrations",
  "salesPeople",
  "schedules",
  "workshopTypes",
  "workshops"
] as const;

const objectFields = ["integrations", "registrationLinks"] as const;

export async function GET() {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false });
  }
  try {
    const state = await getAppState();
    if (!state) return NextResponse.json({ dbEnabled: true });
    const {
      attendanceTeamUsers: _privateAttendanceTeamUsers,
      responseAccessGrants: _privateResponseAccessGrants,
      ...publicState
    } = state;
    return NextResponse.json({ dbEnabled: true, ...publicState });
  } catch (error) {
    return NextResponse.json({ dbEnabled: true, error: "Failed to read DB state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false }, { status: 400 });
  }
  try {
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    arrayFields.forEach((field) => {
      if (Array.isArray(body?.[field])) patch[field] = body[field];
    });
    objectFields.forEach((field) => {
      if (body?.[field] && typeof body[field] === "object" && !Array.isArray(body[field])) {
        patch[field] = body[field];
      }
    });
    await saveAppState(patch);
    return NextResponse.json({ ok: true, dbEnabled: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save DB state" }, { status: 500 });
  }
}
