import { NextResponse } from "next/server";
import { getIntegrationSettings, saveIntegrationSettings } from "@/lib/integrations";

export async function GET() {
  const settings = await getIntegrationSettings();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await saveIntegrationSettings(body?.settings ?? {});
    return NextResponse.json({ ok: true, persisted: result.persisted, settings: result.settings });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save integration settings" }, { status: 500 });
  }
}
