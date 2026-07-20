import { NextRequest, NextResponse } from "next/server";
import { getAppState, isDbEnabled, saveAppState } from "@/lib/db";
import {
  createResponseViewerSession,
  isResponseAccessExpired,
  maskResponseEmail,
  maskResponseMobile,
  RESPONSE_VIEWER_COOKIE,
  responseViewerSessionMaxAge,
  verifyResponseAccessCode,
  verifyResponseViewerSession
} from "@/lib/response-access";
import type { RegistrationEntry, ResponseAccessGrant } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ATTEMPTS = (globalThis as unknown as { __cflResponseAccessAttempts?: Map<string, { count: number; resetAt: number }> }).__cflResponseAccessAttempts ?? new Map<string, { count: number; resetAt: number }>();
(globalThis as unknown as { __cflResponseAccessAttempts?: typeof ATTEMPTS }).__cflResponseAccessAttempts = ATTEMPTS;

async function findGrant(token: string) {
  const state = await getAppState();
  const grants = (Array.isArray(state?.responseAccessGrants) ? state.responseAccessGrants : []) as ResponseAccessGrant[];
  return { grant: grants.find((item) => item.token === token), grants, state };
}

function unavailable(grant?: ResponseAccessGrant) {
  if (!grant) return "This response link is invalid.";
  if (!grant.active) return "This response access has been revoked.";
  if (isResponseAccessExpired(grant)) return "This response access has expired.";
  return "";
}

function sanitizeRegistration(entry: RegistrationEntry, grant: ResponseAccessGrant) {
  return {
    id: entry.id,
    workshopId: entry.workshopId,
    workshopTitle: entry.workshopTitle,
    fullName: entry.fullName,
    mobile: grant.permissions.revealContact ? entry.mobile : maskResponseMobile(entry.mobile),
    email: grant.permissions.revealContact ? entry.email : maskResponseEmail(entry.email),
    city: entry.city,
    facilitator: entry.facilitator,
    status: entry.status,
    amountPaid: entry.amountPaid,
    amountDue: entry.amountDue,
    whatsappVerificationStatus: entry.whatsappVerificationStatus,
    source: entry.source,
    createdAt: entry.createdAt,
    batch: entry.batch,
    answers: grant.permissions.viewAnswers ? entry.answers : undefined
  };
}

function responseData(state: Awaited<ReturnType<typeof getAppState>>, grant: ResponseAccessGrant) {
  const registrations = (Array.isArray(state?.registrations) ? state.registrations : []) as RegistrationEntry[];
  const workshopNames = new Map(grant.workshopIds.map((id, index) => [id, grant.workshopNames[index] ?? id]));
  const allowedNames = new Set(grant.workshopNames.map((name) => name.trim().toLowerCase()));
  const filtered = registrations.filter((entry) => grant.workshopIds.includes(entry.workshopId) || allowedNames.has(entry.workshopTitle.trim().toLowerCase()));
  return {
    grant: {
      recipientName: grant.recipientName,
      permissions: grant.permissions,
      expiresAt: grant.expiresAt,
      workshopIds: grant.workshopIds,
      workshopNames: grant.workshopNames
    },
    workshops: grant.workshopIds.map((id) => ({ id, name: workshopNames.get(id) ?? id, count: filtered.filter((entry) => entry.workshopId === id || entry.workshopTitle.trim().toLowerCase() === (workshopNames.get(id) ?? "").trim().toLowerCase()).length })),
    registrations: filtered.map((entry) => sanitizeRegistration(entry, grant))
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Response access is unavailable." }, { status: 503 });
  try {
    const { token } = await context.params;
    const { grant, state } = await findGrant(token);
    const error = unavailable(grant);
    if (error || !grant) return NextResponse.json({ error }, { status: 404 });
    const authorized = verifyResponseViewerSession(request.cookies.get(RESPONSE_VIEWER_COOKIE)?.value, grant);
    if (!authorized) return NextResponse.json({ authorized: false, requiresAccessCode: true });
    return NextResponse.json({ authorized: true, ...responseData(state, grant) });
  } catch {
    return NextResponse.json({ error: "Could not load workshop responses." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Response access is unavailable." }, { status: 503 });
  try {
    const { token } = await context.params;
    const { grant, grants, state } = await findGrant(token);
    const error = unavailable(grant);
    if (error || !grant) return NextResponse.json({ error }, { status: 404 });
    const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const attemptKey = `${token}:${client}`;
    const now = Date.now();
    const attempt = ATTEMPTS.get(attemptKey);
    if (attempt && attempt.resetAt > now && attempt.count >= 8) {
      return NextResponse.json({ error: "Too many incorrect attempts. Please try again later." }, { status: 429 });
    }
    const body = await request.json().catch(() => ({})) as { accessCode?: string };
    const accessCode = String(body.accessCode ?? "").trim();
    if (!verifyResponseAccessCode(accessCode, grant.token, grant.pinHash)) {
      ATTEMPTS.set(attemptKey, !attempt || attempt.resetAt <= now ? { count: 1, resetAt: now + 15 * 60 * 1000 } : { ...attempt, count: attempt.count + 1 });
      return NextResponse.json({ error: "Incorrect access code." }, { status: 401 });
    }
    ATTEMPTS.delete(attemptKey);
    const accessedGrant = { ...grant, accessCount: grant.accessCount + 1, lastAccessedAt: new Date().toISOString() };
    await saveAppState({ responseAccessGrants: [accessedGrant, ...grants.filter((item) => item.id !== grant.id)] });
    const response = NextResponse.json({ authorized: true, ...responseData(state, accessedGrant) });
    response.cookies.set({
      httpOnly: true,
      maxAge: responseViewerSessionMaxAge(accessedGrant),
      name: RESPONSE_VIEWER_COOKIE,
      path: "/",
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      value: createResponseViewerSession(accessedGrant)
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not verify access code." }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ httpOnly: true, maxAge: 0, name: RESPONSE_VIEWER_COOKIE, path: "/", sameSite: "strict", value: "" });
  return response;
}
