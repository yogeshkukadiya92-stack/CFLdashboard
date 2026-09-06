import { ensurePersistenceTable, ensureRegistrationRecordsTable, getAppState, getDbPool, isDbEnabled, mutateAttendanceEntries, readRegistrationRecords, upsertRegistrationRecord } from "@/lib/db";
import { attendanceWindow } from "@/lib/attendance-window";
import { assignRegistrationNumbers } from "@/lib/registration-confirmation";
import { syncConfirmedRegistrationToMfw } from "@/lib/mfw-registration";
import { executeWorkflow } from "@/lib/workflow-engine";
import { confirmWorkflowWaiting } from "@/lib/workflow-waiting-confirmation";
import { listActiveWorkflowsForTrigger, recordWorkflowExecution } from "@/lib/workflow-db";
import { attendanceCanConfirmWaitingRegistration } from "@/lib/workshop-hierarchy";
import type { AttendanceEntry, AttendanceSession, BuilderField, BuilderForm, RegistrationEntry } from "@/lib/types";
import { after, NextResponse } from "next/server";

function cleanText(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanMobile(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function validZoomUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const trustedHost = hostname === "zoom.us" || hostname.endsWith(".zoom.us") || hostname === "zoom.tagmango.com";
    return url.protocol === "https:" && trustedHost && !url.username && !url.password ? url.toString() : "";
  } catch {
    return "";
  }
}

function publicSession(session: AttendanceSession) {
  const { zoomJoinUrl: _privateZoomJoinUrl, ...safe } = session;
  return {
    ...safe,
    attendanceWindow: attendanceWindow(session)
  };
}

function cleanAnswers(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(input)
      .slice(0, 100)
      .map(([key, answer]) => [key.slice(0, 200), cleanText(answer, 2000)])
  );
}

function fieldIsVisible(field: BuilderField, fields: BuilderField[], answers: Record<string, string>) {
  if (!field.visibility) return true;
  const sourceField = fields.find((item) => item.id === field.visibility?.fieldId);
  const source = sourceField ? (answers[sourceField.label] ?? "").trim() : "";
  const expected = (field.visibility.value ?? "").trim();
  if (field.visibility.operator === "answered") return Boolean(source);
  if (field.visibility.operator === "not_answered") return !source;
  if (field.visibility.operator === "not_equals") return source !== expected;
  if (field.visibility.operator === "contains") return source.toLowerCase().includes(expected.toLowerCase());
  return source === expected;
}

function requiredCustomFields(fields: BuilderField[], answers: Record<string, string>) {
  return fields.filter((field) => field.required && field.type !== "heading" && field.type !== "divider" && !field.role && fieldIsVisible(field, fields, answers));
}

async function promoteAttendanceWaitingRegistrations(attendance: AttendanceEntry) {
  const database = getDbPool();
  if (!database) return 0;
  await ensurePersistenceTable();
  await ensureRegistrationRecordsTable();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query(`SELECT forms, attendance_sessions FROM app_state WHERE id = 1 FOR UPDATE`);
    const registrations = await readRegistrationRecords(client) as RegistrationEntry[];
    const forms = (Array.isArray(selected.rows[0]?.forms) ? selected.rows[0].forms : []) as BuilderForm[];
    const sessions = (Array.isArray(selected.rows[0]?.attendance_sessions) ? selected.rows[0].attendance_sessions : []) as AttendanceSession[];
    const mobile = attendance.mobile.replace(/\D/g, "").slice(-10);
    const affectedWorkshops = new Set<string>();
    const promotedRegistrationIds = new Set<string>();
    const promotedByWorkshop = new Map<string, number>();
    let promoted = 0;
    let next = registrations.map((registration) => {
      if (registration.registrationStatus !== "waiting" || !["eligibility_pending", "attendance_pending", "session_mismatch"].includes(registration.waitingReason || "")) return registration;
      if (registration.mobile.replace(/\D/g, "").slice(-10) !== mobile) return registration;
      const form = forms.find((item) => item.workshopId === registration.workshopId);
      const attendanceSession = sessions.find((item) => item.id === attendance.sessionId);
      if (!attendanceCanConfirmWaitingRegistration(attendance, registration, form, attendanceSession)) return registration;
      const capacity = Math.max(0, Number(form?.registrationCapacity ?? 0) || 0);
      const confirmedCount = registrations.filter((item) => item.workshopId === registration.workshopId && item.registrationStatus !== "waiting" && item.id !== registration.id).length;
      const workshopPromotions = promotedByWorkshop.get(registration.workshopId) ?? 0;
      if (capacity > 0 && confirmedCount + workshopPromotions >= capacity) return { ...registration, attendanceMatched: true, waitingReason: "capacity" as const };
      promoted += 1;
      promotedRegistrationIds.add(registration.id);
      promotedByWorkshop.set(registration.workshopId, workshopPromotions + 1);
      affectedWorkshops.add(registration.workshopId);
      return {
        ...registration,
        attendanceMatched: true,
        confirmationSource: "attendance" as const,
        confirmationStatus: "confirmed" as const,
        confirmationUpdatedAt: new Date().toISOString(),
        confirmationUpdatedBy: "Intro session attendance",
        registrationStatus: "confirmed" as const,
        waitingPosition: undefined,
        waitingReason: undefined
      };
    });
    affectedWorkshops.forEach((workshopId) => { next = assignRegistrationNumbers(next, workshopId); });
    for (const registration of next.filter((entry) => promotedRegistrationIds.has(entry.id))) {
      const mfwSync = await syncConfirmedRegistrationToMfw(registration);
      next = next.map((entry) => entry.id === registration.id ? { ...entry, ...mfwSync } : entry);
    }
    if (promoted > 0) {
      for (const registration of next.filter((entry) => promotedRegistrationIds.has(entry.id))) {
        await upsertRegistrationRecord(client, registration as unknown as Record<string, unknown>);
      }
      await client.query(`UPDATE app_state SET registrations = $1::jsonb, updated_at = NOW() WHERE id = 1`, [JSON.stringify(next)]);
    }
    await client.query("COMMIT");
    return promoted;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function runAttendanceWorkflows(attendance: AttendanceEntry, promotedRegistrations: number) {
  const state = await getAppState();
  if (!state) return;
  const trigger = attendance.status === "late" ? "Late attendance submitted" : "Attendance submitted";
  const workflows = await listActiveWorkflowsForTrigger([trigger, "Attendance submitted"]);
  await Promise.all(workflows.map(async (workflow) => {
    const started = Date.now();
    const event = {
      id: attendance.id,
      fullName: attendance.attendeeName,
      mobile: attendance.mobile,
      city: attendance.city,
      workshopId: attendance.workshopId,
      workshopTitle: attendance.workshopName,
      batch: attendance.batch,
      attendanceStatus: attendance.status || "checked_in",
      attendanceSessionId: attendance.sessionId,
      source: attendance.source || "attendance_form",
      promotedRegistrations,
      createdAt: attendance.submittedAt
    };
    const result = executeWorkflow({
      nodes: workflow.nodes,
      connections: workflow.connections,
      registration: event,
      salesPeople: Array.isArray(state.salesPeople) ? state.salesPeople as Array<Record<string, unknown>> : [],
      leads: Array.isArray(state.leads) ? state.leads as Array<Record<string, unknown>> : [],
      mode: "production"
    });
    await confirmWorkflowWaiting({ nodes: workflow.nodes, connections: workflow.connections, attendance, result, workflowId: workflow.id });
    await recordWorkflowExecution({
      id: `EXE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      workflowId: workflow.id,
      mode: "production",
      status: result.status,
      trigger,
      participant: `${attendance.attendeeName} · ${attendance.workshopName}`,
      registration: event,
      output: { summary: result.summary, promotedRegistrations },
      steps: result.steps,
      durationMs: Date.now() - started
    });
  }));
}

export async function GET(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ dbEnabled: false });
  try {
    const state = await getAppState();
    const sessions = (Array.isArray(state?.attendanceSessions) ? state.attendanceSessions : []) as AttendanceSession[];
    const entries = (Array.isArray(state?.attendanceEntries) ? state.attendanceEntries : []) as AttendanceEntry[];
    const slug = new URL(request.url).searchParams.get("slug")?.trim();
    if (slug) {
      const session = sessions.find((item) => item.slug === slug && item.published !== false);
      return session
        ? NextResponse.json({
            attendanceSession: publicSession(session),
            dbEnabled: true,
            responseCount: entries.filter((entry) => entry.sessionId === session.id).length
          })
        : NextResponse.json({ error: "Attendance link is not active." }, { status: 404 });
    }
    return NextResponse.json({
      attendanceSessions: sessions.filter((session) => session.published !== false).map(publicSession),
      dbEnabled: true
    });
  } catch {
    return NextResponse.json({ error: "Failed to read attendance state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) return NextResponse.json({ error: "Attendance server is not configured." }, { status: 503 });
  try {
    const body = await request.json().catch(() => null) as { entry?: Record<string, unknown> } | null;
    const input = body?.entry;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid attendance entry." }, { status: 400 });
    }

    const state = await getAppState();
    const sessions = (Array.isArray(state?.attendanceSessions) ? state.attendanceSessions : []) as AttendanceSession[];
    const sessionId = cleanText(input.sessionId, 200);
    const sessionSlug = cleanText(input.sessionSlug, 200);
    const session = sessions.find((item) => item.id === sessionId && item.slug === sessionSlug && item.published !== false);
    if (!session) return NextResponse.json({ error: "Attendance session is not active." }, { status: 404 });

    const currentEntries = (Array.isArray(state?.attendanceEntries) ? state.attendanceEntries : []) as AttendanceEntry[];
    const sessionEntries = currentEntries.filter((entry) => entry.sessionId === session.id);
    const responseLimit = cleanNumber(session.responseLimit, 0, 0, 20_000);
    if (responseLimit > 0 && sessionEntries.length >= responseLimit) {
      return NextResponse.json({ error: cleanText(session.closedMessage, 300) || "This attendance form is no longer accepting responses." }, { status: 403 });
    }

    const windowStatus = attendanceWindow(session);
    if (!windowStatus.allowed) return NextResponse.json({ error: windowStatus.reason }, { status: 403 });

    const mobileDigits = cleanMobile(input.mobile);
    const attendeeName = cleanText(input.attendeeName, 200);
    const email = cleanText(input.email, 254);
    const answers = cleanAnswers(input.answers);
    if (!attendeeName || mobileDigits.length !== 10 || !/^[6-9]/.test(mobileDigits)) {
      return NextResponse.json({ error: "Name and a valid 10-digit mobile number are required." }, { status: 400 });
    }
    const missingField = requiredCustomFields(session.fields, answers).find((field) => !answers[field.label]?.trim());
    if (missingField) return NextResponse.json({ error: `${missingField.label} is required.` }, { status: 400 });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const stableId = session.allowDuplicate
      ? `att-${session.id}-${mobileDigits}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : `att-${session.id}-${mobileDigits}`;
    const zoomJoinUrl = validZoomUrl(session.zoomJoinUrl);
    const responseMeta = {
      joinUrl: zoomJoinUrl,
      redirectDelaySeconds: cleanNumber(session.redirectDelaySeconds, 3, 0, 15),
      successMessage: cleanText(session.successMessage, 500) || "Attendance marked successfully. You can now join the live session."
    };
    const now = new Date().toISOString();
    const proposedEntry: AttendanceEntry = {
      answers,
      attendeeName,
      batch: cleanText(input.batch, 120) || session.batch || "",
      checkInAt: now,
      city: cleanText(input.city, 150),
      email,
      id: stableId,
      mobile: `+91 ${mobileDigits}`,
      sessionId: session.id,
      sessionSlug: session.slug,
      source: "attendance_form",
      status: windowStatus.late ? "late" : "checked_in",
      submittedAt: now,
      workshopId: session.workshopId,
      workshopName: session.workshopName
    };
    const saved = await mutateAttendanceEntries((rawEntries) => {
      const entries = rawEntries as AttendanceEntry[];
      const existing = session.allowDuplicate ? undefined : entries.find((entry) => entry.id === stableId);
      if (existing) {
        return {
          entries,
          result: {
            duplicate: true,
            entry: existing,
            responseCount: entries.filter((entry) => entry.sessionId === session.id).length
          }
        };
      }
      const nextEntries = [proposedEntry, ...entries].slice(0, 20_000);
      return {
        entries: nextEntries,
        result: {
          duplicate: false,
          entry: proposedEntry,
          responseCount: nextEntries.filter((entry) => entry.sessionId === session.id).length
        }
      };
    });
    if (saved.duplicate) {
      return NextResponse.json({
        code: "ALREADY_REGISTERED",
        duplicate: true,
        error: "This mobile number is already registered for this attendance session."
      }, { status: 409 });
    }
    const promotedRegistrations = await promoteAttendanceWaitingRegistrations(saved.entry).catch(() => 0);
    after(() => runAttendanceWorkflows(saved.entry, promotedRegistrations).catch((error) => {
      console.error("Attendance workflow execution failed", error instanceof Error ? error.message : "Unknown error");
    }));
    return NextResponse.json({ ...saved, ok: true, promotedRegistrations, ...responseMeta });
  } catch {
    return NextResponse.json({ error: "Failed to save attendance." }, { status: 500 });
  }
}
