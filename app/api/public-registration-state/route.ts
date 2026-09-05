import { ensureRegistrationRecordsTable, getDbPool, isDbEnabled, reserveRegistrationNumber, upsertRegistrationRecord } from "@/lib/db";
import { upsertLiveRegistration } from "@/lib/crm-db";
import { upsertLeadFromRegistration } from "@/lib/lead-utils";
import { sendRegistrationStatusNotifications } from "@/lib/registration-confirmation";
import { syncConfirmedRegistrationToMfw } from "@/lib/mfw-registration";
import type { AttendanceEntry, BuilderForm, ReferralCodeConfig, RegistrationEntry } from "@/lib/types";
import { attendanceMatchesFinalRegistration, findRepeaterSource, isDuplicateWorkshopRegistration, shouldSendRepeaterToWaiting } from "@/lib/workshop-hierarchy";
import { resolveWorkshopSalesPersonId, type WorkshopLeadAssignmentRule } from "@/lib/workshop-lead-assignment";
import { getActiveWorkflowAssignmentSettings } from "@/lib/workflow-db";
import { NextResponse } from "next/server";
import { after } from "next/server";

export async function GET() {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false });
  }

  try {
    // Public forms do not need the registration history or CRM datasets.
    const result = await getDbPool()!.query(`SELECT forms, landing_pages AS "landingPages", registration_links AS "registrationLinks", workshops FROM app_state WHERE id = 1`);
    const state = result.rows[0];
    const publicForms = (Array.isArray(state?.forms) ? state.forms : []).map((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const { referralCodes: _privateReferralCodes, ...publicForm } = value as Record<string, unknown>;
      return publicForm;
    });
    return NextResponse.json({
      dbEnabled: true,
      forms: publicForms,
      landingPages: state?.landingPages ?? [],
      registrationLinks: state?.registrationLinks ?? {},
      workshops: state?.workshops ?? []
    });
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

    const database = getDbPool();
    if (!database) return NextResponse.json({ error: "Database is not configured." }, { status: 500 });
    await ensureRegistrationRecordsTable();
    const workflowAssignment = await getActiveWorkflowAssignmentSettings(sanitizedRegistration.workshopId).catch(() => null);
    const client = await database.connect();
    let released = false;
    try {
      await client.query("BEGIN");
      const selected = await client.query(`SELECT forms, workshops, leads, sales_people, attendance_entries FROM app_state WHERE id = 1`);
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
      const cohortKey = `${sanitizedRegistration.workshopId}:${sanitizedRegistration.batchId ?? sanitizedRegistration.batch}:${sanitizedRegistration.introductionSessionId ?? ""}`;
      if (form?.allowDuplicate !== true) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${sanitizedRegistration.workshopId}:${mobileDigits}`]);
      }
      if (needsCohortLock) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [cohortKey]);
      }
      const relevantRecords = await client.query(`SELECT payload FROM cfl_registration_records
        WHERE workshop_id = $1 OR mobile_normalized = $2
        ORDER BY created_at DESC, external_id DESC`, [sanitizedRegistration.workshopId, mobileDigits]);
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
      const responseLimit = Math.max(0, Number(form?.responseLimit ?? 0) || 0);
      const formResponseCount = current.filter((value: unknown) => {
        if (!value || typeof value !== "object") return false;
        const entry = value as RegistrationEntry;
        const sameBatch = sanitizedRegistration.batchId
          ? entry.batchId === sanitizedRegistration.batchId
          : String(entry.batch ?? "").trim().toLowerCase() === sanitizedRegistration.batch.trim().toLowerCase();
        const sameIntroduction = sanitizedRegistration.introductionSessionId
          ? entry.introductionSessionId === sanitizedRegistration.introductionSessionId
          : !entry.introductionSessionId;
        return entry.workshopId === sanitizedRegistration.workshopId && sameBatch && sameIntroduction;
      }).length;
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
      const referralUseCount = referral ? current.filter((entry: RegistrationEntry) => entry.id !== sanitizedRegistration.id && entry.referralCodeId === referral.id).length : 0;
      const referralMobileUseCount = referral ? current.filter((entry: RegistrationEntry) => entry.id !== sanitizedRegistration.id && entry.referralCodeId === referral.id && entry.mobile.replace(/\D/g, "").slice(-10) === mobileDigits).length : 0;
      const referralValid = Boolean(referral)
        && (!referral?.validFrom || new Date(referral.validFrom).getTime() <= now)
        && (!referral?.expiresAt || new Date(referral.expiresAt).getTime() >= now)
        && (!referral?.maxUses || referralUseCount < referral.maxUses)
        && (!referral?.maxUsesPerMobile || referralMobileUseCount < referral.maxUsesPerMobile);
      const confirmedCount = current.filter((value: unknown) => {
        if (!value || typeof value !== "object") return false;
        const entry = value as RegistrationEntry;
        const sameBatch = sanitizedRegistration.batchId
          ? entry.batchId === sanitizedRegistration.batchId
          : String(entry.batch ?? "").trim().toLowerCase() === sanitizedRegistration.batch.trim().toLowerCase();
        return entry.workshopId === sanitizedRegistration.workshopId && sameBatch && entry.registrationStatus !== "waiting" && entry.id !== sanitizedRegistration.id;
      }).length;
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
      const unnumbered = [
        pendingRegistration,
        ...current.filter((item: unknown) => !(item && typeof item === "object" && "id" in item && (item as { id?: string }).id === sanitizedRegistration.id))
      ];
      const waiting = unnumbered
        .filter((item: unknown) => item && typeof item === "object" && String((item as Record<string, unknown>).workshopId ?? "") === sanitizedRegistration.workshopId && (item as Record<string, unknown>).registrationStatus === "waiting")
        .sort((first, second) => new Date(String(first.createdAt ?? "")).getTime() - new Date(String(second.createdAt ?? "")).getTime());
      const positions = new Map(waiting.map((entry, index: number) => [String(entry.id ?? ""), index + 1]));
      const positioned = unnumbered.map((item: unknown) => {
        if (!item || typeof item !== "object") return item;
        const entry = item as Record<string, unknown>;
        const position = positions.get(String(entry.id ?? ""));
        return position ? { ...entry, waitingPosition: position } : entry;
      });
      let next = positioned as RegistrationEntry[];
      let finalRegistration = next.find((item: unknown) => item && typeof item === "object" && String((item as Record<string, unknown>).id ?? "") === sanitizedRegistration.id) as RegistrationEntry;
      if (!isWaiting && !finalRegistration.registrationNumber) {
        finalRegistration = { ...finalRegistration, registrationNumber: await reserveRegistrationNumber(client) };
        next = next.map((entry) => entry.id === finalRegistration.id ? finalRegistration : entry);
      }
      const workshops = Array.isArray(state.workshops) ? state.workshops : [];
      const linkedWorkshop = workshops.find((value: unknown) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const workshop = value as { id?: unknown; name?: unknown };
        return String(workshop.id ?? "") === sanitizedRegistration.workshopId
          || String(workshop.name ?? "").trim().toLowerCase() === workshopTitle.toLowerCase();
      }) as { assignedSalesPersonId?: unknown; leadAssignmentRules?: WorkshopLeadAssignmentRule[]; transferLeadToCrm?: unknown } | undefined;
      const assignmentRules = linkedWorkshop?.leadAssignmentRules?.length ? linkedWorkshop.leadAssignmentRules : workflowAssignment?.rules;
      const salesPeople = Array.isArray(state.sales_people) ? state.sales_people : [];
      const currentLeads = Array.isArray(state.leads) ? state.leads : [];
      const assignedSalesPersonId = resolveWorkshopSalesPersonId(
        finalRegistration,
        assignmentRules,
        linkedWorkshop?.assignedSalesPersonId || workflowAssignment?.defaultSalesPersonId,
        salesPeople as Array<Record<string, unknown>>,
        currentLeads as Array<Record<string, unknown>>,
        workflowAssignment?.fallbackStrategy ?? "unassigned"
      );
      const leads = linkedWorkshop?.transferLeadToCrm === true
        ? upsertLeadFromRegistration(
            currentLeads,
            finalRegistration,
            salesPeople,
            assignedSalesPersonId
          )
        : currentLeads;

      await upsertRegistrationRecord(client, finalRegistration as unknown as Record<string, unknown>);
      await client.query("COMMIT");
      // CRM takes its own pool connection. Never wait for it while holding one:
      // simultaneous submissions otherwise exhaust the pool and deadlock.
      client.release();
      released = true;
      // The participant receives the committed record immediately. Next keeps
      // the follow-up callback alive after sending the HTTP response.
      after(async () => {
      try {
        await upsertLiveRegistration(finalRegistration as unknown as Record<string, unknown>);
        if (linkedWorkshop?.transferLeadToCrm === true) {
          await database.query(`UPDATE app_state SET leads = $1::jsonb, updated_at = NOW() WHERE id = 1`, [JSON.stringify(leads)]);
        }
      } catch {
        // The registration is durable. CRM projection failures must not turn a
        // successful form submission into a user-visible failure.
      }
      let savedRegistration = next.find((entry) => entry.id === sanitizedRegistration.id) as RegistrationEntry;
      try {
        if (attendanceMatched && !isWaiting) {
          savedRegistration = { ...savedRegistration, ...(await syncConfirmedRegistrationToMfw(savedRegistration)) };
          await upsertRegistrationRecord(database, savedRegistration as unknown as Record<string, unknown>);
        }
        const notificationPatch = await sendRegistrationStatusNotifications(savedRegistration, form as Partial<BuilderForm>);
        if (Object.keys(notificationPatch).length) {
          savedRegistration = { ...savedRegistration, ...notificationPatch };
          next = next.map((entry) => entry.id === savedRegistration.id ? savedRegistration : entry);
          await upsertLiveRegistration(savedRegistration as unknown as Record<string, unknown>);
          await upsertRegistrationRecord(database, savedRegistration as unknown as Record<string, unknown>);
        }
      } catch {
        // Registration is already committed; notification failures never roll it back.
      }
      });
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
  } catch {
    return NextResponse.json({ error: "Failed to save registration" }, { status: 500 });
  }
}
