import { publicRegistrationJson } from "@/lib/public-registration-cache";
import { ensureRegistrationHotPath } from "@/lib/registration-hot-path";
import { drainRegistrationJobs, ensureRegistrationJobs } from "@/lib/registration-jobs";
import { ensureRegistrationRecordsTable, getRegistrationDbPool, isDbEnabled, reserveRegistrationNumber, upsertRegistrationRecord } from "@/lib/db";
import type { AttendanceEntry, BuilderForm, ReferralCodeConfig, RegistrationEntry } from "@/lib/types";
import { attendanceMatchesFinalRegistration, findRepeaterSource, isDuplicateWorkshopRegistration, shouldSendRepeaterToWaiting } from "@/lib/workshop-hierarchy";
import { NextResponse } from "next/server";
import { after } from "next/server";

export async function GET() {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false });
  }

  try {
    return new NextResponse(await publicRegistrationJson(), { headers: { "Content-Type":"application/json", "Cache-Control":"no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to read registration state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false }, { status: 400 });
  }

  try {
    const body = await request.json();
    const registration = body?.registration;
    if (!registration || typeof registration !== "object" || Array.isArray(registration)) {
      return NextResponse.json({ error: "Invalid registration" }, { status: 400 });
    }

    const input = registration as Record<string, unknown>;
    const fullName = String(input.fullName ?? "").trim().slice(0, 200);
    const mobileDigits = String(input.mobile ?? "").replace(/\D/g, "").slice(-10);
    const workshopTitle = String(input.workshopTitle ?? "").trim().slice(0, 300);
    if (!fullName || !workshopTitle || mobileDigits.length !== 10 || !/^[6-9]/.test(mobileDigits)) {
      return NextResponse.json({ error: "Name, workshop and valid 10-digit mobile are required." }, { status: 400 });
    }

    const amountPaid = Math.min(10_000_000, Math.max(0, Number(input.amountPaid ?? 0) || 0));
    const amountDue = Math.min(10_000_000, Math.max(0, Number(input.amountDue ?? 0) || 0));
    const createdAtInput = String(input.createdAt ?? "");
    const createdAt = Number.isNaN(new Date(createdAtInput).getTime()) ? new Date().toISOString() : createdAtInput;
    const answersInput = input.answers && typeof input.answers === "object" && !Array.isArray(input.answers)
      ? input.answers as Record<string, unknown>
      : null;
    const answers = answersInput
      ? Object.fromEntries(Object.entries(answersInput).slice(0, 100).map(([key, value]) => [key.slice(0, 200), String(value ?? "").slice(0, 2000)]))
      : undefined;
    const sanitizedRegistration = {
      amountDue,
      amountPaid,
      answers,
      batch: String(input.batch ?? "Main Batch").trim().slice(0, 200),
      batchId: String(input.batchId ?? "").trim().slice(0, 300) || undefined,
      city: String(input.city ?? "").trim().slice(0, 150),
      createdAt,
      email: String(input.email ?? "").trim().slice(0, 254),
      facilitator: String(input.facilitator ?? "CFL Facilitator").trim().slice(0, 200),
      fullName,
      id: String(input.id ?? "").trim().slice(0, 300),
      introductionSessionId: String(input.introductionSessionId ?? "").trim().slice(0, 300) || undefined,
      referralCode: String(input.referralCode ?? "").replace(/\D/g, "").slice(-10) || undefined,
      mobile: `+91 ${mobileDigits}`,
      landingPageSlug: String(input.landingPageSlug ?? "").trim().slice(0, 300) || undefined,
      paymentMode: input.paymentMode === "Part" ? "Part" : "Full",
      status: amountDue > 0 ? "Due" : "Paid",
      source: input.source === "landing_page" ? "landing_page" : input.source === "manual" ? "manual" : "registration_link",
      whatsappVerificationStatus: input.whatsappVerificationStatus === "verified"
        ? "verified"
        : input.whatsappVerificationStatus === "not_verified"
          ? "not_verified"
          : "not_required",
      workshopId: String(input.workshopId ?? workshopTitle).trim().slice(0, 300),
      workshopSlug: String(input.workshopSlug ?? "").trim().slice(0, 300),
      workshopTitle
    };

    const database = getRegistrationDbPool();
    if (!database) return NextResponse.json({ error: "Database is not configured." }, { status: 500 });
    await ensureRegistrationRecordsTable();
    await ensureRegistrationJobs();
    await ensureRegistrationHotPath();
    const client = await database.connect();
    let released = false;
    try {
      await client.query("BEGIN");
      const selected = await client.query(`SELECT
        COALESCE((SELECT jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(f)
          WHERE key=ANY(ARRAY['workshopId','workshopSlug','batch','registrationCapacity','waitingMode',
            'requireAttendanceForConfirmation','allowReferralConfirmation','responseLimit','repeaterSourceWorkshopIds',
            'repeaterWaitingMode','allowDuplicate','closedMessage','requiredAttendanceSessionId','attendanceOnlyConfirmation','referralCodes'])))
          FROM jsonb_array_elements(forms) f
          WHERE f->>'workshopId' = $1 OR f->>'workshopSlug' = $2), '[]'::jsonb) AS forms,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',w->'id','batches',w->'batches')) FROM jsonb_array_elements(workshops) w
          WHERE w->>'id' = $1 OR lower(w->>'name') = lower($3)), '[]'::jsonb) AS workshops,
        COALESCE((SELECT jsonb_agg(payload) FROM cfl_attendance_lookup
          WHERE mobile_normalized = $4), '[]'::jsonb) AS attendance_entries
        FROM app_state WHERE id = 1`, [sanitizedRegistration.workshopId, sanitizedRegistration.workshopSlug, workshopTitle, mobileDigits]);
      const state = selected.rows[0] ?? {};
      const forms = Array.isArray(state.forms) ? state.forms as Array<Record<string, unknown>> : [];
      const form = forms.find((value) => {
        const sameWorkshop = String(value.workshopId ?? "") === sanitizedRegistration.workshopId || String(value.workshopSlug ?? "") === sanitizedRegistration.workshopSlug;
        const formBatch = String(value.batch ?? "").trim().toLowerCase();
        return sameWorkshop && (!formBatch || formBatch === sanitizedRegistration.batch.trim().toLowerCase());
      }) ?? forms.find((value) => String(value.workshopId ?? "") === sanitizedRegistration.workshopId || String(value.workshopSlug ?? "") === sanitizedRegistration.workshopSlug);
      const workshopRecords = Array.isArray(state.workshops) ? state.workshops as Array<Record<string, unknown>> : [];
      const workshop = workshopRecords.find((value) => String(value.id ?? "") === sanitizedRegistration.workshopId);
      const workshopBatches = Array.isArray(workshop?.batches) ? workshop.batches as Array<Record<string, unknown>> : [];
      const selectedBatch = workshopBatches.find((value) => sanitizedRegistration.batchId
        ? String(value.id ?? "") === sanitizedRegistration.batchId
        : String(value.name ?? "").trim().toLowerCase() === sanitizedRegistration.batch.trim().toLowerCase());
      const capacity = Math.max(0, Number(selectedBatch?.capacity ?? form?.registrationCapacity ?? 0) || 0);
      const needsCohortLock = Boolean(form?.waitingMode || form?.requireAttendanceForConfirmation || form?.allowReferralConfirmation
        || Number(form?.responseLimit ?? 0) > 0 || capacity > 0 || (Array.isArray(form?.repeaterSourceWorkshopIds) && form.repeaterSourceWorkshopIds.length));
      // Capacity is batch-wide and referral quotas/waiting positions are workshop-wide.
      // Intro-specific locks did not protect those shared limits.
      const cohortKey = `registration-workshop:${sanitizedRegistration.workshopId}`;
      // Even when repeat entries are allowed, retries of the same identity must serialize.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${sanitizedRegistration.workshopId}:${mobileDigits}`]);
      const relevantRecords = await client.query(`SELECT payload FROM cfl_registration_records
        WHERE mobile_normalized = $1
        ORDER BY created_at DESC, external_id DESC`, [mobileDigits]);
      const current = relevantRecords.rows.map((row) => row.payload) as RegistrationEntry[];
      const previousRegistration = current.find((value: unknown) => value && typeof value === "object" && (value as RegistrationEntry).id === sanitizedRegistration.id) as RegistrationEntry | undefined;
      // A lost HTTP response must be safe to retry without allocating another
      // registration number or dispatching the same notifications again.
      if (previousRegistration && isDuplicateWorkshopRegistration(previousRegistration, sanitizedRegistration)) {
        await client.query("COMMIT");
        return NextResponse.json({ ok: true, dbEnabled: true, registration: previousRegistration });
      }
      const duplicate = current.find((value: unknown) => {
        if (!value || typeof value !== "object") return false;
        return isDuplicateWorkshopRegistration(value as RegistrationEntry, sanitizedRegistration);
      });
      if (duplicate && form?.allowDuplicate !== true) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          code: "ALREADY_REGISTERED",
          duplicate: true,
          error: "This mobile number is already registered for this workshop."
        }, { status: 409 });
      }
      if (needsCohortLock) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [cohortKey]);
      }
      const responseLimit = Math.max(0, Number(form?.responseLimit ?? 0) || 0);
      const countsResult = await client.query(`SELECT
        COALESCE(sum(responses) FILTER (WHERE
          CASE WHEN $2 <> '' THEN batch_id=$2 ELSE batch_name=$3 END
          AND intro_session=$4),0) AS responses,
        COALESCE(sum(confirmed) FILTER (WHERE CASE WHEN $2 <> '' THEN batch_id=$2 ELSE batch_name=$3 END),0) AS confirmed,
        GREATEST(COALESCE(sum(waiting),0),COALESCE((SELECT NULLIF(payload->>'waitingPosition','')::bigint
          FROM cfl_registration_records WHERE workshop_id=$1 AND payload->>'registrationStatus'='waiting'
          ORDER BY NULLIF(payload->>'waitingPosition','')::bigint DESC NULLS LAST LIMIT 1),0)) AS waiting
        FROM cfl_registration_totals WHERE workshop_id=$1`,
        [sanitizedRegistration.workshopId, sanitizedRegistration.batchId ?? '', sanitizedRegistration.batch.trim().toLowerCase(),
          sanitizedRegistration.introductionSessionId ?? '']);
      const counts = countsResult.rows[0];
      const formResponseCount = Number(counts.responses);
      if (responseLimit > 0 && formResponseCount >= responseLimit) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: String(form?.closedMessage ?? "This registration form is no longer accepting responses.").slice(0, 300) }, { status: 403 });
      }
      const requiredSessionId = String(form?.requiredAttendanceSessionId ?? "").trim();
      const attendanceRequired = form?.requireAttendanceForConfirmation === true && Boolean(requiredSessionId);
      const attendanceOnlyConfirmation = attendanceRequired && form?.attendanceOnlyConfirmation === true;
      const attendanceEntries = (Array.isArray(state.attendance_entries) ? state.attendance_entries : []) as AttendanceEntry[];
      const repeaterSourceWorkshopIds = Array.isArray(form?.repeaterSourceWorkshopIds)
        ? form.repeaterSourceWorkshopIds.map((value) => String(value ?? "").trim()).filter(Boolean).slice(0, 500)
        : [];
      const repeaterSource = findRepeaterSource(current as RegistrationEntry[], attendanceEntries, sanitizedRegistration, repeaterSourceWorkshopIds);
      const repeaterWaitingMode = shouldSendRepeaterToWaiting(form);
      const attendanceMatched = attendanceRequired
        ? attendanceEntries.some((entry) => attendanceMatchesFinalRegistration(entry, sanitizedRegistration, requiredSessionId))
        : false;
      const hasAttendanceForAnotherSession = attendanceRequired && !attendanceMatched && attendanceEntries.some((entry) => {
        const incomingMobile = sanitizedRegistration.mobile.replace(/\D/g, "").slice(-10);
        return entry.mobile.replace(/\D/g, "").slice(-10) === incomingMobile;
      });
      const referralCodes = (Array.isArray(form?.referralCodes) ? form.referralCodes : []) as ReferralCodeConfig[];
      const submittedReferral = sanitizedRegistration.referralCode;
      const now = Date.now();
      const referralEnabled = form?.allowReferralConfirmation === true;
      const referral = submittedReferral && referralEnabled && /^[6-9]\d{9}$/.test(submittedReferral)
        ? referralCodes.find((item) => item.active !== false && item.code.replace(/\D/g, "").slice(-10) === submittedReferral)
        : undefined;
      const referralCounts = referral ? (await client.query(`SELECT count(*) AS total,
        count(*) FILTER (WHERE mobile_normalized = $3) AS mobile
        FROM cfl_registration_records WHERE workshop_id = $1 AND payload->>'referralCodeId' = $2 AND external_id <> $4`,
        [sanitizedRegistration.workshopId, referral.id, mobileDigits, sanitizedRegistration.id])).rows[0] : undefined;
      const referralUseCount = Number(referralCounts?.total ?? 0);
      const referralMobileUseCount = Number(referralCounts?.mobile ?? 0);
      const referralValid = Boolean(referral)
        && (!referral?.validFrom || new Date(referral.validFrom).getTime() <= now)
        && (!referral?.expiresAt || new Date(referral.expiresAt).getTime() >= now)
        && (!referral?.maxUses || referralUseCount < referral.maxUses)
        && (!referral?.maxUsesPerMobile || referralMobileUseCount < referral.maxUsesPerMobile);
      const confirmedCount = Number(counts.confirmed);
      const eligibilityConfigured = attendanceRequired || referralEnabled;
      const eligible = attendanceOnlyConfirmation
        ? attendanceMatched
        : !eligibilityConfigured || attendanceMatched || referralValid;
      const capacityFull = capacity > 0 && confirmedCount >= capacity;
      const waitingReason = repeaterSource && repeaterWaitingMode
        ? "repeater_review"
        : form?.waitingMode === true
          ? "manual"
        : capacityFull && eligible
          ? "capacity"
          : !eligible && attendanceOnlyConfirmation && hasAttendanceForAnotherSession
            ? "session_mismatch"
            : !eligible && attendanceOnlyConfirmation
              ? "attendance_pending"
          : !eligible && referralEnabled && !referralValid
            ? "invalid_referral"
            : !eligible && hasAttendanceForAnotherSession
              ? "session_mismatch"
              : !eligible && attendanceRequired
                ? "attendance_pending"
                : !eligible
                  ? "eligibility_pending"
                : undefined;
      const isWaiting = Boolean(waitingReason);
      const confirmationSource = !isWaiting
        ? attendanceMatched && referralValid
          ? "attendance_and_referral"
          : referralValid
            ? "referral"
            : attendanceMatched
              ? "attendance"
              : undefined
        : undefined;
      const pendingRegistration = {
        ...sanitizedRegistration,
        attendanceMatched,
        confirmationStatus: !isWaiting && attendanceMatched ? "confirmed" as const : undefined,
        confirmationUpdatedAt: !isWaiting && attendanceMatched ? new Date().toISOString() : undefined,
        confirmationUpdatedBy: !isWaiting && attendanceMatched ? "Intro session attendance" : undefined,
        confirmationSource,
        referralCodeId: referralValid ? referral?.id : undefined,
        referrerName: referralValid ? referral?.referrerName : undefined,
        confirmationWhatsappSentAt: previousRegistration?.confirmationWhatsappSentAt,
        confirmationWhatsappStatus: previousRegistration?.confirmationWhatsappStatus,
        confirmationWhatsappError: previousRegistration?.confirmationWhatsappError,
        waitingWhatsappSentAt: previousRegistration?.waitingWhatsappSentAt,
        waitingWhatsappStatus: previousRegistration?.waitingWhatsappStatus,
        waitingWhatsappError: previousRegistration?.waitingWhatsappError,
        referrerWaitingWhatsappSentAt: previousRegistration?.referrerWaitingWhatsappSentAt,
        referrerWaitingWhatsappStatus: previousRegistration?.referrerWaitingWhatsappStatus,
        referrerWaitingWhatsappError: previousRegistration?.referrerWaitingWhatsappError,
        requiredAttendanceSessionId: requiredSessionId || undefined,
        isRepeater: Boolean(repeaterSource),
        repeaterDetectedAt: repeaterSource ? new Date().toISOString() : undefined,
        repeaterSourceRegistrationId: repeaterSource?.registrationId,
        repeaterSourceWorkshopId: repeaterSource?.workshopId,
        repeaterSourceWorkshopTitle: repeaterSource?.workshopTitle,
        registrationStatus: isWaiting ? "waiting" : "confirmed",
        waitingReason,
        waitingPosition: undefined
      };
      let finalRegistration = {
        ...pendingRegistration,
        waitingPosition: isWaiting ? Number(counts.waiting) + 1 : undefined
      } as RegistrationEntry;
      if (!isWaiting && !finalRegistration.registrationNumber) {
        finalRegistration = { ...finalRegistration, registrationNumber: await reserveRegistrationNumber(client) };
      }
      const inserted = await upsertRegistrationRecord(client, finalRegistration as unknown as Record<string, unknown>, true, true);
      if (!inserted) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Registration identity already exists. Please reload the form." }, { status: 409 });
      }
      await client.query("COMMIT");
      // CRM takes its own pool connection. Never wait for it while holding one:
      // simultaneous submissions otherwise exhaust the pool and deadlock.
      client.release();
      released = true;
      // The participant receives the committed record immediately. Next keeps
      // the follow-up callback alive after sending the HTTP response.
      after(() => process.env.REGISTRATION_WORKER_ENABLED === "false" ? Promise.resolve() : drainRegistrationJobs());
      return NextResponse.json({
        ok: true,
        dbEnabled: true,
        registration: finalRegistration,
        whatsapp: {
          participant: finalRegistration.registrationStatus === "waiting" ? finalRegistration.waitingWhatsappStatus : finalRegistration.confirmationWhatsappStatus,
          referrer: finalRegistration.referrerWaitingWhatsappStatus
        }
      });
    } catch (error) {
      if (!released) await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      if (!released) client.release();
    }
  } catch (error) {
    console.error("Registration save failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Failed to save registration" }, { status: 500 });
  }
}
