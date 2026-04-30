import { NextResponse } from "next/server";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";

export async function GET() {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false, leads: null, workshops: null });
  }
  try {
    const state = await getAppState();
    return NextResponse.json({ dbEnabled: true, ...state });
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
    const leads = Array.isArray(body?.leads) ? body.leads : [];
    const workshops = Array.isArray(body?.workshops) ? body.workshops : [];
    await saveAppState({ leads, workshops });
    return NextResponse.json({ ok: true, dbEnabled: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save DB state" }, { status: 500 });
  }
}

