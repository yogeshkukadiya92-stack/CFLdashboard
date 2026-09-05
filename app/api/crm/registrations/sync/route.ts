import { deleteRegistrationRecords, getAppState, isDbEnabled, readRegistrationRecords, saveAppState } from "@/lib/db";
import { deleteLiveRegistrationsByExternalIds, listLiveRegistrationsByAppWorkshopId } from "@/lib/crm-db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false }, { status: 400 });
  }

  try {
    const body = await request.json();
    const workshopId = String(body?.workshopId ?? "").trim();
    if (!workshopId) return NextResponse.json({ error: "Workshop is required." }, { status: 400 });

    const recovered = await listLiveRegistrationsByAppWorkshopId(workshopId);
    const state = await getAppState();
    const current = Array.isArray(state?.registrations) ? state.registrations : [];
    const currentIds = new Set(current.map((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";
      return String((item as { id?: unknown }).id ?? "");
    }));
    const missing = recovered.filter((item) => !currentIds.has(item.id));
    const registrations = [...missing, ...current];
    if (missing.length) await saveAppState({ registrations });

    return NextResponse.json({ ok: true, recovered: missing.length, registrations });
  } catch {
    return NextResponse.json({ error: "Failed to sync imported registrations." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false }, { status: 400 });
  }

  try {
    const body = await request.json();
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((id: unknown) => String(id ?? "").trim()).filter(Boolean).slice(0, 5000)
      : [];
    if (!ids.length) return NextResponse.json({ error: "Registration IDs are required." }, { status: 400 });

    await deleteLiveRegistrationsByExternalIds(ids);
    const removed = await deleteRegistrationRecords(ids);
    return NextResponse.json({ ok: true, removed, registrations: await readRegistrationRecords() });
  } catch {
    return NextResponse.json({ error: "Failed to remove duplicate registrations." }, { status: 500 });
  }
}
