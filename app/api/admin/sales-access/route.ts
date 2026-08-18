import { NextResponse } from "next/server";
import { getAppState, saveAppState } from "@/lib/db";
import { normalizeSalesPermissions } from "@/lib/sales-permissions";
import type { SalesTeamUser } from "@/lib/types";

export async function GET() {
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const users = (state.salesTeamUsers as SalesTeamUser[]).map(({ passwordHash: _passwordHash, ...user }) => ({ ...user, permissions: normalizeSalesPermissions(user.permissions) }));
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { userId?: string; permissions?: unknown };
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    const users = state.salesTeamUsers as SalesTeamUser[];
    const existing = users.find((user) => user.id === body.userId);
    if (!existing) return NextResponse.json({ error: "Salesperson login not found." }, { status: 404 });
    const updated = { ...existing, permissions: normalizeSalesPermissions(body.permissions), updatedAt: new Date().toISOString() };
    await saveAppState({ salesTeamUsers: [updated, ...users.filter((user) => user.id !== updated.id)] });
    return NextResponse.json({ ok: true, user: { ...updated, passwordHash: undefined } });
  } catch {
    return NextResponse.json({ error: "Could not update access permissions." }, { status: 500 });
  }
}
