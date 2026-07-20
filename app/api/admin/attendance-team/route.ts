import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import { hashAttendanceTeamPassword, toAttendanceTeamSummary } from "@/lib/attendance-team-auth";
import type { AttendanceSession, AttendanceTeamPermissions, AttendanceTeamUser } from "@/lib/types";

function permissions(value: unknown): AttendanceTeamPermissions {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    deleteResponses: Boolean(input.deleteResponses),
    editAttendance: Boolean(input.editAttendance),
    exportCsv: Boolean(input.exportCsv),
    revealContact: Boolean(input.revealContact),
    viewAnswers: input.viewAnswers !== false
  };
}

export async function GET() {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for team access." }, { status: 503 });
  try {
    const state = await getAppState();
    const users = (Array.isArray(state?.attendanceTeamUsers) ? state.attendanceTeamUsers : []) as AttendanceTeamUser[];
    const sessions = (Array.isArray(state?.attendanceSessions) ? state.attendanceSessions : []) as AttendanceSession[];
    return NextResponse.json({
      sessions: sessions.map((session) => ({ id: session.id, label: `${session.workshopName} · ${session.title}`, published: session.published })),
      users: [...users].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(toAttendanceTeamSummary)
    });
  } catch {
    return NextResponse.json({ error: "Could not load attendance team access." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for team access." }, { status: 503 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const state = await getAppState();
    const current = (Array.isArray(state?.attendanceTeamUsers) ? state.attendanceTeamUsers : []) as AttendanceTeamUser[];
    const existing = current.find((user) => user.id === String(body.id ?? ""));
    const name = String(body.name ?? "").trim().slice(0, 150);
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
    const password = String(body.password ?? "");
    const availableIds = new Set(((Array.isArray(state?.attendanceSessions) ? state.attendanceSessions : []) as AttendanceSession[]).map((session) => session.id));
    const sessionIds = Array.from(new Set<string>((Array.isArray(body.sessionIds) ? body.sessionIds as unknown[] : []).map(String))).filter((id) => availableIds.has(id)).slice(0, 200);
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !sessionIds.length) return NextResponse.json({ error: "Name, valid email and at least one session are required." }, { status: 400 });
    if (!existing && password.length < 8) return NextResponse.json({ error: "Create a password with at least 8 characters." }, { status: 400 });
    if (existing && password && password.length < 8) return NextResponse.json({ error: "New password must have at least 8 characters." }, { status: 400 });
    if (existing && existing.email !== email && !password) return NextResponse.json({ error: "Set a new password when changing the login email." }, { status: 400 });
    if (current.some((user) => user.email === email && user.id !== existing?.id)) return NextResponse.json({ error: "An employee with this email already exists." }, { status: 409 });
    const expiresInput = String(body.expiresAt ?? "").trim();
    const expires = expiresInput ? new Date(expiresInput) : null;
    if (expires && Number.isNaN(expires.getTime())) return NextResponse.json({ error: "Invalid expiry date." }, { status: 400 });
    const now = new Date().toISOString();
    const user: AttendanceTeamUser = {
      active: body.active !== false,
      createdAt: existing?.createdAt ?? now,
      email,
      expiresAt: expires?.toISOString(),
      id: existing?.id ?? randomUUID(),
      lastLoginAt: existing?.lastLoginAt,
      loginCount: existing?.loginCount ?? 0,
      name,
      passwordHash: password ? hashAttendanceTeamPassword(password, email) : existing?.passwordHash ?? "",
      permissions: permissions(body.permissions),
      sessionIds,
      updatedAt: now
    };
    await saveAppState({ attendanceTeamUsers: [user, ...current.filter((item) => item.id !== user.id)].slice(0, 500) });
    return NextResponse.json({ user: toAttendanceTeamSummary(user) });
  } catch {
    return NextResponse.json({ error: "Could not save attendance team access." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Database is required for team access." }, { status: 503 });
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "User id is required." }, { status: 400 });
    const state = await getAppState();
    const users = (Array.isArray(state?.attendanceTeamUsers) ? state.attendanceTeamUsers : []) as AttendanceTeamUser[];
    await saveAppState({ attendanceTeamUsers: users.filter((user) => user.id !== id) });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete attendance team access." }, { status: 500 });
  }
}
