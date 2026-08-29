import { ensurePersistenceTable, getAppState, getDbPool, isDbEnabled } from "@/lib/db";
import { upsertLiveRegistration } from "@/lib/crm-db";
import { upsertLeadFromRegistration } from "@/lib/lead-utils";
import { assignRegistrationNumbers } from "@/lib/registration-confirmation";
import { syncConfirmedRegistrationToMfw } from "@/lib/mfw-registration";
import type { AttendanceEntry, BuilderForm, ReferralCodeConfig, RegistrationEntry } from "@/lib/types";
import { attendanceMatchesFinalRegistration, isDuplicateWorkshopRegistration } from "@/lib/workshop-hierarchy";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await isDbEnabled())) {
    return NextResponse.json({ dbEnabled: false });
  }

  try {
    const state = await getAppState();
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
      referralCode: String(input.referralCode ?? "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 80) || undefined,
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
    await ensurePersistenceTable();
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(`SELECT registrations, forms, workshops, leads, sales_people, attendance_entries FROM app_state WHERE id = 1 FOR UPDATE`);
      const state = selected.rows[0] ?? {};
      const current = Array.isArray(state.registrations) ? state.registrations : [];
      const forms = Array.isArray(state.forms) ? state.forms as Array<Record<string, unknown>> : [];
      const form = forms.find((value) => {
        const sameWorkshop = String(value.workshopId ?? "") === sanitizedRegistration.workshopId || String(value.workshopSlug ?? "") === sanitizedRegistration.workshopSlug;
        const formBatch = String(value.batch ?? "").trim().toLowerCase();
        return sameWorkshop && (!formBatch || formBatch === sanitizedRegistration.batch.trim().toLowerCase());
      }) ?? forms.find((value) => String(value.workshopId ?? "") === sanitizedRegistration.workshopId || String(value.workshopSlug ?? "") === sanitizedRegistration.workshopSlug);
      const duplicate = current.find((value: unknown) => {
        if (!value || typeof value !== "object") return false;
        return isDuplicateWorkshopRegistration(value as RegistrationEntry, sanitizedRegistration);
      });
      if (duplicate && duplicate.registrationStatus !== "waiting" && form?.allowDuplicate !== true) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          code: "ALREADY_REGISTERED",
          duplicate: true,
          error: "This mobile number is already registered for this batch and introduction session."
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
      const workshopRecords = Array.isArray(state.workshops) ? state.workshops as Array<Record<string, unknown>> : [];
      const workshop = workshopRecords.find((value) => String(value.id ?? "") === sanitizedRegistration.workshopId);
      const workshopBatches = Array.isArray(workshop?.batches) ? workshop.batches as Array<Record<string, unknown>> : [];
      const selectedBatch = workshopBatches.find((value) => sanitizedRegistration.batchId
        ? String(value.id ?? "") === sanitizedRegistration.batchId
        : String(value.name ?? "").trim().toLowerCase() === sanitizedRegistration.batch.trim().toLowerCase());
      const capacity = Math.max(0, Number(selectedBatch?.capacity ?? form?.registrationCapacity ?? 0) || 0);
      const requiredSessionId = String(form?.requiredAttendanceSessionId ?? "").trim();
      const attendanceRequired = form?.requireAttendanceForConfirmation === true && Boolean(requiredSessionId);
      const attendanceEntries = (Array.isArray(state.attendance_entries) ? state.attendance_entries : []) as AttendanceEntry[];
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
      const referral = submittedReferral && referralEnabled
        ? referralCodes.find((item) => item.active !== false && item.code.trim().toUpperCase().replace(/\s+/g, "") === submittedReferral)
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
      const eligible = !eligibilityConfigured || attendanceMatched || referralValid;
      const capacityFull = capacity > 0 && confirmedCount >= capacity;
      const waitingReason = form?.waitingMode === true
        ? "manual"
        : capacityFull && eligible
          ? "capacity"
          : !eligible && submittedReferral
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
        requiredAttendanceSessionId: requiredSessionId || undefined,
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
        .sort((first: Record<string, unknown>, second: Record<string, unknown>) => new Date(String(first.createdAt ?? "")).getTime() - new Date(String(second.createdAt ?? "")).getTime());
      const positions = new Map(waiting.map((entry: Record<string, unknown>, index: number) => [String(entry.id ?? ""), index + 1]));
      const positioned = unnumbered.map((item: unknown) => {
        if (!item || typeof item !== "object") return item;
        const entry = item as Record<string, unknown>;
        const position = positions.get(String(entry.id ?? ""));
        return position ? { ...entry, waitingPosition: position } : entry;
      });
      let next = assignRegistrationNumbers(positioned as RegistrationEntry[], sanitizedRegistration.workshopId);
      let finalRegistration = next.find((item: unknown) => item && typeof item === "object" && String((item as Record<string, unknown>).id ?? "") === sanitizedRegistration.id) as RegistrationEntry;
      if (attendanceMatched && !isWaiting) {
        finalRegistration = { ...finalRegistration, ...(await syncConfirmedRegistrationToMfw(finalRegistration)) };
        next = next.map((entry) => entry.id === finalRegistration.id ? finalRegistration : entry);
      }
      const workshops = Array.isArray(state.workshops) ? state.workshops : [];
      const linkedWorkshop = workshops.find((value: unknown) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const workshop = value as { id?: unknown; name?: unknown };
        return String(workshop.id ?? "") === sanitizedRegistration.workshopId
          || String(workshop.name ?? "").trim().toLowerCase() === workshopTitle.toLowerCase();
      }) as { transferLeadToCrm?: unknown } | undefined;
      const leads = linkedWorkshop?.transferLeadToCrm === true
        ? upsertLeadFromRegistration(
            Array.isArray(state.leads) ? state.leads : [],
            finalRegistration,
            Array.isArray(state.sales_people) ? state.sales_people : []
          )
        : Array.isArray(state.leads) ? state.leads : [];

      await upsertLiveRegistration(finalRegistration as unknown as Record<string, unknown>);
      await client.query(`UPDATE app_state SET leads = $1::jsonb, registrations = $2::jsonb, updated_at = NOW() WHERE id = 1`, [JSON.stringify(leads), JSON.stringify(next.slice(0, 5000))]);
      await client.query("COMMIT");
      const savedRegistration = next.find((entry) => entry.id === sanitizedRegistration.id) as RegistrationEntry;
      return NextResponse.json({ ok: true, dbEnabled: true, registration: savedRegistration, whatsapp: { configured: false, sent: false } });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ error: "Failed to save registration" }, { status: 500 });
  }
}
