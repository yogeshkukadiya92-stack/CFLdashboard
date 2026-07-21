import { NextResponse } from "next/server";
import { createApiKey, createWebhook, deleteWebhook, listIntegrationHub, revokeApiKey, testWebhook, type ApiScope, type CustomerWebhookEvent } from "@/lib/integration-hub";
import { isDbEnabled } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET() {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for Integration Hub." }, { status: 503 });
  try {
    return NextResponse.json(await listIntegrationHub());
  } catch {
    return NextResponse.json({ error: "Could not load Integration Hub." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for Integration Hub." }, { status: 503 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    if (body.action === "create_api_key") {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "API key name is required." }, { status: 400 });
      const apiKey = await createApiKey(name, strings(body.scopes) as ApiScope[]);
      return NextResponse.json({ apiKey, ok: true }, { status: 201 });
    }
    if (body.action === "create_webhook") {
      const name = String(body.name ?? "").trim();
      const url = String(body.url ?? "").trim();
      if (!name || !url) return NextResponse.json({ error: "Webhook name and URL are required." }, { status: 400 });
      const webhook = await createWebhook(name, url, strings(body.events) as CustomerWebhookEvent[]);
      return NextResponse.json({ ok: true, webhook }, { status: 201 });
    }
    if (body.action === "test_webhook") {
      return NextResponse.json({ ok: true, result: await testWebhook(String(body.id ?? "")) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Integration action failed." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for Integration Hub." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  const type = params.get("type");
  const deleted = type === "api_key" ? await revokeApiKey(id) : type === "webhook" ? await deleteWebhook(id) : false;
  return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Integration not found." }, { status: 404 });
}
