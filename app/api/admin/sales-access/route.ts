import { NextResponse } from "next/server";
import { getAppState, saveAppState } from "@/lib/db";
import { normalizeCrmTeamRoles, permissionsAllowedForRoles } from "@/lib/sales-permissions";
import type { SalesTeamUser } from "@/lib/types";

export async function GET() {
  const state = await getAppState();
  if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const users = (state.salesTeamUsers as SalesTeamUser[]).map(({ passwordHash: _passwordHash, ...user }) => { const roles=normalizeCrmTeamRoles(user.roles);return { ...user, roles, permissions: permissionsAllowedForRoles(user.permissions,roles) }; });
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { userId?: string; permissions?: unknown; roles?: unknown };
    const state = await getAppState();
    if (!state) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    const users = state.salesTeamUsers as SalesTeamUser[];
    const existing = users.find((user) => user.id === body.userId);
    if (!existing) return NextResponse.json({ error: "Salesperson login not found." }, { status: 404 });
    const roles = normalizeCrmTeamRoles(body.roles);
    if (!roles.length) return NextResponse.json({ error: "Select Sales, Observer, or both roles." }, { status: 400 });
    const updated = { ...existing, roles, permissions: permissionsAllowedForRoles(body.permissions, roles), updatedAt: new Date().toISOString() };
    await saveAppState({ salesTeamUsers: [updated, ...users.filter((user) => user.id !== updated.id)] });
    return NextResponse.json({ ok: true, user: { ...updated, passwordHash: undefined } });
  } catch {
    return NextResponse.json({ error: "Could not update access permissions." }, { status: 500 });
  }
}
