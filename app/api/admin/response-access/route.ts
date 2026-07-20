import { NextResponse } from "next/server";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import { generateResponseAccessToken, hashResponseAccessCode, toResponseAccessSummary } from "@/lib/response-access";
import type { ResponseAccessGrant, ResponseAccessPermissions } from "@/lib/types";

export const runtime = "nodejs";

type WorkshopRecord = { archived?: boolean; id?: string; name?: string };
type WorkshopOption = { id: string; name: string };

function cleanPermissions(value: unknown): ResponseAccessPermissions {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    exportCsv: Boolean(input.exportCsv),
    revealContact: Boolean(input.revealContact),
    viewAnswers: input.viewAnswers !== false
  };
}

function activeWorkshops(state: Awaited<ReturnType<typeof getAppState>>): WorkshopOption[] {
  const records: unknown[] = Array.isArray(state?.workshops) ? state.workshops as unknown[] : [];
  const workshops: WorkshopOption[] = [];
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const item = record as WorkshopRecord;
    if (item.archived || typeof item.id !== "string" || !item.id || typeof item.name !== "string" || !item.name) continue;
    workshops.push({ id: item.id, name: item.name });
  }
  return workshops;
}

export async function GET() {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for secure response access." }, { status: 503 });
  try {
    const state = await getAppState();
    const grants = (Array.isArray(state?.responseAccessGrants) ? state.responseAccessGrants : []) as ResponseAccessGrant[];
    return NextResponse.json({
      grants: [...grants].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(toResponseAccessSummary),
      workshops: activeWorkshops(state)
    });
  } catch {
    return NextResponse.json({ error: "Could not load response access." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for secure response access." }, { status: 503 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const state = await getAppState();
    const current = (Array.isArray(state?.responseAccessGrants) ? state.responseAccessGrants : []) as ResponseAccessGrant[];
    const existing = current.find((grant) => grant.id === String(body.id ?? ""));
    const recipientName = String(body.recipientName ?? "").trim().slice(0, 150);
    const recipientContact = String(body.recipientContact ?? "").trim().slice(0, 200);
    const code = String(body.accessCode ?? "").trim();
    const rawWorkshopIds: unknown[] = Array.isArray(body.workshopIds) ? body.workshopIds as unknown[] : [];
    const workshopIds = Array.from(new Set<string>(rawWorkshopIds.map((value) => String(value)))).slice(0, 100);
    const workshopMap = new Map(activeWorkshops(state).map((workshop) => [workshop.id, workshop.name]));
    const validWorkshopIds = workshopIds.filter((id) => workshopMap.has(id));
    if (!recipientName || !validWorkshopIds.length) {
      return NextResponse.json({ error: "Recipient name and at least one workshop are required." }, { status: 400 });
    }
    if (!existing && (code.length < 4 || code.length > 32)) {
      return NextResponse.json({ error: "Create an access code between 4 and 32 characters." }, { status: 400 });
    }
    if (existing && code && (code.length < 4 || code.length > 32)) {
      return NextResponse.json({ error: "New access code must be between 4 and 32 characters." }, { status: 400 });
    }

    const expiresAtInput = String(body.expiresAt ?? "").trim();
    const expiresAtDate = expiresAtInput ? new Date(expiresAtInput) : null;
    if (expiresAtDate && Number.isNaN(expiresAtDate.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date." }, { status: 400 });
    }
    const token = existing?.token ?? generateResponseAccessToken();
    const now = new Date().toISOString();
    const grant: ResponseAccessGrant = {
      id: existing?.id ?? crypto.randomUUID(),
      token,
      recipientName,
      recipientContact: recipientContact || undefined,
      workshopIds: validWorkshopIds,
      workshopNames: validWorkshopIds.map((id) => workshopMap.get(id) ?? id),
      permissions: cleanPermissions(body.permissions),
      active: body.active !== false,
      expiresAt: expiresAtDate?.toISOString(),
      pinHash: code ? hashResponseAccessCode(code, token) : existing?.pinHash ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastAccessedAt: existing?.lastAccessedAt,
      accessCount: existing?.accessCount ?? 0
    };
    const next = [grant, ...current.filter((item) => item.id !== grant.id)].slice(0, 500);
    await saveAppState({ responseAccessGrants: next });
    return NextResponse.json({ grant: toResponseAccessSummary(grant), path: `/response-view/${grant.token}` });
  } catch {
    return NextResponse.json({ error: "Could not save response access." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for secure response access." }, { status: 503 });
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Access id is required." }, { status: 400 });
    const state = await getAppState();
    const current = (Array.isArray(state?.responseAccessGrants) ? state.responseAccessGrants : []) as ResponseAccessGrant[];
    await saveAppState({ responseAccessGrants: current.filter((grant) => grant.id !== id) });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete response access." }, { status: 500 });
  }
}
