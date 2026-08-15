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
import type { RegistrationConfirmationActivity, RegistrationConfirmationStatus, RegistrationEntry, ResponseAccessGrant } from "@/lib/types";
import { syncConfirmedRegistrationToMfw } from "@/lib/mfw-registration";

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
  const canManage = grant.permissions.manageConfirmations;
  return {
    id: entry.id,
    workshopId: entry.workshopId,
    workshopTitle: entry.workshopTitle,
    fullName: entry.fullName,
    mobile: grant.permissions.revealContact || canManage ? entry.mobile : maskResponseMobile(entry.mobile),
    email: grant.permissions.revealContact || canManage ? entry.email : maskResponseEmail(entry.email),
    city: entry.city,
    facilitator: entry.facilitator,
    status: entry.status,
    amountPaid: entry.amountPaid,
    amountDue: entry.amountDue,
    whatsappVerificationStatus: entry.whatsappVerificationStatus,
    source: entry.source,
    createdAt: entry.createdAt,
    batch: entry.batch,
    answers: grant.permissions.viewAnswers ? entry.answers : undefined,
    confirmationStatus: entry.confirmationStatus ?? "pending",
    confirmationNote: canManage ? entry.confirmationNote : undefined,
    confirmationUpdatedAt: entry.confirmationUpdatedAt,
    confirmationUpdatedBy: entry.confirmationUpdatedBy,
    isRepeater: entry.isRepeater,
    carriedForwardToWorkshopId: entry.carriedForwardToWorkshopId,
    carriedForwardToWorkshopTitle: entry.carriedForwardToWorkshopTitle,
    confirmationHistory: canManage ? entry.confirmationHistory : undefined
  };
}

function activeWorkshopOptions(state: Awaited<ReturnType<typeof getAppState>>) {
  const workshops = Array.isArray(state?.workshops) ? state.workshops : [];
  return workshops.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const item = value as { archived?: boolean; id?: string; name?: string };
    if (item.archived || !item.id || !item.name) return [];
    return [{ id: item.id, name: item.name }];
  });
}

function responseData(state: Awaited<ReturnType<typeof getAppState>>, grant: ResponseAccessGrant) {
  const registrations = (Array.isArray(state?.registrations) ? state.registrations : []) as RegistrationEntry[];
  const workshopNames = new Map(grant.workshopIds.map((id, index) => [id, grant.workshopNames[index] ?? id]));
  const allowedRegistrationIds = grant.registrationIds?.length ? new Set(grant.registrationIds) : null;
  const eligible = registrations.filter((entry) => !allowedRegistrationIds || allowedRegistrationIds.has(entry.id));
  const workshopEntries = new Map(grant.workshopIds.map((id) => {
    const exactMatches = eligible.filter((entry) => entry.workshopId === id);
    if (exactMatches.length) return [id, exactMatches] as const;
    const legacyName = (workshopNames.get(id) ?? "").trim().toLowerCase();
    return [id, eligible.filter((entry) => entry.workshopTitle.trim().toLowerCase() === legacyName)] as const;
  }));
  const filtered = Array.from(new Map(
    grant.workshopIds.flatMap((id) => workshopEntries.get(id) ?? []).map((entry) => [entry.id, entry])
  ).values());
  return {
    grant: {
      recipientName: grant.recipientName,
      permissions: grant.permissions,
      expiresAt: grant.expiresAt,
      workshopIds: grant.workshopIds,
      workshopNames: grant.workshopNames
    },
    carryForwardTargets: activeWorkshopOptions(state),
    workshops: grant.workshopIds.map((id) => ({ id, name: workshopNames.get(id) ?? id, count: workshopEntries.get(id)?.length ?? 0 })),
    registrations: filtered.map((entry) => sanitizeRegistration(entry, grant))
  };
}

function grantAllowsRegistration(grant: ResponseAccessGrant, entry: RegistrationEntry, registrations: RegistrationEntry[]) {
  if (grant.registrationIds?.length && !grant.registrationIds.includes(entry.id)) return false;
  if (grant.workshopIds.includes(entry.workshopId)) return true;
  return grant.workshopIds.some((id, index) => {
    if (registrations.some((registration) => registration.workshopId === id)) return false;
    return entry.workshopTitle.trim().toLowerCase() === (grant.workshopNames[index] ?? "").trim().toLowerCase();
  });
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

export async function PATCH(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Response access is unavailable." }, { status: 503 });
  try {
    const { token } = await context.params;
    const { grant, state } = await findGrant(token);
    const error = unavailable(grant);
    if (error || !grant) return NextResponse.json({ error }, { status: 404 });
    if (!verifyResponseViewerSession(request.cookies.get(RESPONSE_VIEWER_COOKIE)?.value, grant)) {
      return NextResponse.json({ error: "Your response access session has expired." }, { status: 401 });
    }
    if (!grant.permissions.manageConfirmations) {
      return NextResponse.json({ error: "You do not have confirmation permission." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const registrationId = String(body.registrationId ?? "").trim();
    const action = String(body.action ?? "").trim() as RegistrationConfirmationActivity["action"];
    const note = String(body.note ?? "").trim().slice(0, 2000);
    const allowedActions: RegistrationConfirmationActivity["action"][] = ["status", "note", "carry_forward", "repeater"];
    if (!registrationId || !allowedActions.includes(action)) {
      return NextResponse.json({ error: "Registration and a valid action are required." }, { status: 400 });
    }

    const registrations = (Array.isArray(state?.registrations) ? state.registrations : []) as RegistrationEntry[];
    const current = registrations.find((entry) => entry.id === registrationId);
    if (!current || !grantAllowsRegistration(grant, current, registrations)) {
      return NextResponse.json({ error: "Registration is outside your assigned workshop access." }, { status: 404 });
    }

    const validStatuses: RegistrationConfirmationStatus[] = ["pending", "confirmed", "not_confirmed", "no_answer", "callback", "cancelled"];
    let status = String(body.status ?? current.confirmationStatus ?? "pending") as RegistrationConfirmationStatus;
    let targetWorkshopId: string | undefined;
    let targetWorkshopTitle: string | undefined;
    let forwardedRegistration: RegistrationEntry | undefined;
    if (action === "status" && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Choose a valid call confirmation status." }, { status: 400 });
    }
    if (action === "note" && !note) {
      return NextResponse.json({ error: "Write a note before saving." }, { status: 400 });
    }
    if (action === "repeater") status = "repeater";
    if (action === "carry_forward") {
      targetWorkshopId = String(body.targetWorkshopId ?? "").trim();
      const target = activeWorkshopOptions(state).find((workshop: { id: string; name: string }) => workshop.id === targetWorkshopId);
      if (!target || target.id === current.workshopId) {
        return NextResponse.json({ error: "Select a different active workshop." }, { status: 400 });
      }
      targetWorkshopTitle = target.name;
      status = "carried_forward";
      const alreadyForwarded = registrations.some((entry) =>
        entry.carriedForwardFromRegistrationId === current.id &&
        entry.workshopId === target.id
      );
      if (!alreadyForwarded) {
        forwardedRegistration = {
          ...current,
          id: crypto.randomUUID(),
          workshopId: target.id,
          workshopSlug: "",
          workshopTitle: target.name,
          source: "manual",
          createdAt: new Date().toISOString(),
          confirmationStatus: "pending",
          confirmationNote: "",
          confirmationUpdatedAt: undefined,
          confirmationUpdatedBy: undefined,
          confirmationHistory: [],
          carriedForwardFromRegistrationId: current.id,
          carriedForwardToWorkshopId: undefined,
          carriedForwardToWorkshopTitle: undefined
        };
      }
    }

    const now = new Date().toISOString();
    const activity: RegistrationConfirmationActivity = {
      id: crypto.randomUUID(),
      action,
      status,
      note: note || undefined,
      targetWorkshopId,
      targetWorkshopTitle,
      actorGrantId: grant.id,
      actorName: grant.recipientName,
      createdAt: now
    };
    const mfwSync = action === "status" && status === "confirmed" ? await syncConfirmedRegistrationToMfw(current) : {};
    const updated: RegistrationEntry = {
      ...current,
      ...mfwSync,
      confirmationStatus: action === "note" ? current.confirmationStatus ?? "pending" : status,
      confirmationNote: note || current.confirmationNote,
      confirmationUpdatedAt: now,
      confirmationUpdatedBy: grant.recipientName,
      isRepeater: action === "repeater" ? true : current.isRepeater,
      carriedForwardToWorkshopId: targetWorkshopId ?? current.carriedForwardToWorkshopId,
      carriedForwardToWorkshopTitle: targetWorkshopTitle ?? current.carriedForwardToWorkshopTitle,
      confirmationHistory: [activity, ...(current.confirmationHistory ?? [])].slice(0, 200)
    };
    const next = registrations.map((entry) => entry.id === current.id ? updated : entry);
    if (forwardedRegistration) next.unshift(forwardedRegistration);
    await saveAppState({ registrations: next });
    const nextState = { ...state, registrations: next };
    return NextResponse.json({ ok: true, ...responseData(nextState, grant) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update registration confirmation." }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ httpOnly: true, maxAge: 0, name: RESPONSE_VIEWER_COOKIE, path: "/", sameSite: "strict", value: "" });
  return response;
}
