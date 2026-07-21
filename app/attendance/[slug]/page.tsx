"use client";

import { readLocalArray, writeLiveStateToLocalStorage } from "@/lib/live-state";
import type { AttendanceEntry, AttendanceSession, BuilderField } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, Loader2, ShieldCheck, Star, Video } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ATTENDANCE_SESSIONS_STORAGE_KEY = "cfl_attendance_sessions_v1";
const ATTENDANCE_ENTRIES_STORAGE_KEY = "cfl_attendance_entries_v1";

function cleanMobile(value: string) {
  return value.replace(/\D/g, "");
}

function formatSessionDate(session: AttendanceSession) {
  const parts = [
    session.sessionDate ? new Date(`${session.sessionDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
    session.startTime || "",
    session.endTime ? `to ${session.endTime}` : ""
  ].filter(Boolean);
  return parts.join(" ");
}

export default function AttendanceFormPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [autoRedirect, setAutoRedirect] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      let sessions = readLocalArray<AttendanceSession>(ATTENDANCE_SESSIONS_STORAGE_KEY);
      try {
        const response = await fetch(`/api/attendance-state?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          if (data?.attendanceSession) {
            sessions = [data.attendanceSession];
            window.localStorage.setItem(ATTENDANCE_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
          }
        } else {
          sessions = [];
        }
      } catch {
        // Use the last published local snapshot only while genuinely offline.
      }
      if (cancelled) return;
      const match = sessions.find((item) => item.slug === slug && item.published !== false) ?? null;
      setSession(match);
      setReady(true);
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!joinUrl || !autoRedirect) return;
    if (countdown <= 0) {
      window.location.assign(joinUrl);
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [autoRedirect, countdown, joinUrl]);

  const roleField = (role: NonNullable<BuilderField["role"]>) => session?.fields.find((field) => field.role === role) ?? null;
  const mobileFieldId = roleField("mobile")?.id;
  const mobileValue = mobileFieldId ? answers[mobileFieldId] ?? "" : "";

  const visibleFields = useMemo(() => {
    if (!session) return [];
    return session.fields.filter((field) => {
      if (!field.visibility) return true;
      const source = (answers[field.visibility.fieldId] ?? "").trim();
      const expected = (field.visibility.value ?? "").trim();
      if (field.visibility.operator === "answered") return Boolean(source);
      if (field.visibility.operator === "not_answered") return !source;
      if (field.visibility.operator === "not_equals") return source !== expected;
      if (field.visibility.operator === "contains") return source.toLowerCase().includes(expected.toLowerCase());
      return source === expected;
    });
  }, [answers, session]);

  const interactiveFields = visibleFields.filter((field) => field.type !== "heading" && field.type !== "divider");
  const isPaged = session?.formMode === "steps" || session?.formMode === "guided";
  const stepFields = isPaged ? [interactiveFields[currentStep]].filter(Boolean) : visibleFields;
  const currentStepField = interactiveFields[currentStep];
  const currentStepInvalid = Boolean(currentStepField?.required && !(answers[currentStepField.id] ?? "").trim());

  const missingRequired = useMemo(() => {
    if (!session) return true;
    return visibleFields.some((field) => {
      if (field.type === "heading" || field.type === "divider" || !field.required) return false;
      const value = (answers[field.id] ?? "").trim();
      if (!value) return true;
      if (field.role === "mobile") return cleanMobile(value).length < 10;
      if (field.minLength && value.length < field.minLength) return true;
      if (field.maxLength && value.length > field.maxLength) return true;
      if (field.type === "number" || field.type === "rating") {
        const numeric = Number(value);
        if (field.min !== undefined && numeric < field.min) return true;
        if (field.max !== undefined && numeric > field.max) return true;
      }
      return false;
    });
  }, [answers, session, visibleFields]);

  function setAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function toggleCheckbox(id: string, option: string) {
    setAnswers((current) => {
      const selected = (current[id] ?? "").split(" | ").filter(Boolean);
      const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
      return { ...current, [id]: next.join(" | ") };
    });
  }

  async function submitAttendance() {
    if (submitting) return;
    if (!session) return;
    if (missingRequired) {
      setMessage("Please fill all required fields with a valid 10-digit mobile number.");
      return;
    }
    setSubmitting(true);
    setMessage("");

    const nameId = roleField("name")?.id;
    const emailId = roleField("email")?.id;
    const cityId = roleField("city")?.id;
    const mobile = cleanMobile(mobileValue);
    const attendeeName = (nameId ? answers[nameId] : "").trim();
    const entry: AttendanceEntry = {
      answers: Object.fromEntries(
        session.fields
          .filter((field) => field.type !== "heading" && !field.role)
          .map((field) => [field.label, (answers[field.id] ?? "").trim()])
          .filter(([, value]) => value)
      ),
      attendeeName,
      city: cityId ? (answers[cityId] ?? "").trim() : "",
      email: emailId ? (answers[emailId] ?? "").trim() : "",
      id: `att-${session.id}-${mobile || generateId()}`,
      mobile: mobile ? `+91 ${mobile}` : "",
      sessionId: session.id,
      sessionSlug: session.slug,
      submittedAt: new Date().toISOString(),
      workshopId: session.workshopId,
      workshopName: session.workshopName
    };

    try {
      const response = await fetch("/api/attendance-state", {
        body: JSON.stringify({ entry }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save attendance.");
      const savedEntry = data.entry as AttendanceEntry;
      const current = readLocalArray<AttendanceEntry>(ATTENDANCE_ENTRIES_STORAGE_KEY);
      writeLiveStateToLocalStorage({ attendanceEntries: [savedEntry, ...current.filter((item) => item.id !== savedEntry.id)] });
      setSuccess(true);
      setJoinUrl(String(data.joinUrl || ""));
      setCountdown(Number(data.redirectDelaySeconds) || 0);
      setAutoRedirect(true);
      setMessage(String(data.successMessage || (data.duplicate ? "Attendance was already marked. You can join the session." : "Attendance marked successfully.")));
      setAnswers({});
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save attendance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-sm font-bold text-slate-500">Loading attendance form...</main>;
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-black tracking-tight">Attendance link is not active</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Please contact the CFL team for the latest session attendance link.</p>
        </div>
      </main>
    );
  }

  const theme = session.theme;
  const accent = theme?.accent || "#059669";
  const fieldRadius = theme?.fieldRadius === "square" ? "rounded-none" : theme?.fieldRadius === "soft" ? "rounded-lg" : "rounded-xl";

  return (
    <main className="min-h-screen px-4 py-8 text-slate-950 md:py-12" style={{ backgroundColor: theme?.backgroundColor || "#f1f5f9", fontFamily: theme?.fontFamily || "Inter" }}>
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)]" style={{ backgroundColor: theme?.surfaceColor || "#ffffff" }}>
        <div className="h-2.5" style={{ backgroundColor: accent }} />
        {theme?.bannerUrl ? <img alt={`${session.workshopName} cover`} className="aspect-[8/3] w-full object-cover" src={theme.bannerUrl} /> : null}
        <div className="p-6 md:p-8">
          {theme?.logoUrl ? <img alt="Workshop logo" className={`mb-5 max-h-24 max-w-[220px] object-contain ${theme.logoAlign === "center" ? "mx-auto" : theme.logoAlign === "right" ? "ml-auto" : ""}`} src={theme.logoUrl} /> : null}
          <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>CFL Session Attendance</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{session.workshopName}</h1>
          <p className="mt-2 text-lg font-black text-slate-800">{session.title}</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">{formatSessionDate(session)}{session.facilitator ? ` • ${session.facilitator}` : ""}{session.venue ? ` • ${session.venue}` : ""}</p>
          {session.description ? <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{session.description}</p> : null}
        </div>

        <div className="border-t border-slate-100 p-6 md:p-8">
          {success ? <div className="min-h-24" /> : (
            <>
              {isPaged ? <div className="mb-6"><div className="mb-2 flex justify-between text-xs font-black text-slate-500"><span>Question {Math.min(currentStep + 1, interactiveFields.length)} of {interactiveFields.length}</span><span>{Math.round(((currentStep + 1) / Math.max(1, interactiveFields.length)) * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full transition-all" style={{ backgroundColor: accent, width: `${((currentStep + 1) / Math.max(1, interactiveFields.length)) * 100}%` }} /></div></div> : null}
              <div className="grid gap-4 md:grid-cols-2">
                {stepFields.map((field) => (
                  <RenderField
                    accent={accent}
                    field={field}
                    fieldRadius={fieldRadius}
                    key={field.id}
                    onChange={(value) => setAnswer(field.id, value)}
                    onToggle={(option) => toggleCheckbox(field.id, option)}
                    value={answers[field.id] ?? ""}
                  />
                ))}
              </div>

              {message ? <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{message}</p> : null}

              {isPaged && currentStep < interactiveFields.length - 1 ? <div className="mt-6 flex gap-3">{currentStep > 0 ? <button className={`grid size-[52px] place-items-center border border-slate-200 ${fieldRadius}`} onClick={() => setCurrentStep((step) => Math.max(0, step - 1))} type="button"><ArrowLeft className="size-5" /></button> : null}<button className={`inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${fieldRadius}`} disabled={currentStepInvalid} onClick={() => setCurrentStep((step) => Math.min(interactiveFields.length - 1, step + 1))} style={{ backgroundColor: accent }} type="button">Continue<ArrowRight className="size-4" /></button></div> : <div className="mt-6 flex gap-3">{isPaged && currentStep > 0 ? <button className={`grid size-[52px] shrink-0 place-items-center border border-slate-200 ${fieldRadius}`} onClick={() => setCurrentStep((step) => Math.max(0, step - 1))} type="button"><ArrowLeft className="size-5" /></button> : null}<button
                className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_12px_28px_-15px_rgba(5,150,105,0.7)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 ${fieldRadius}`}
                disabled={submitting}
                onClick={submitAttendance}
                style={{ backgroundColor: accent }}
                type="button"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {submitting ? "Saving Attendance" : (session.submitButtonText || "Mark Attendance")}
              </button></div>}
              <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400">
                <ClipboardCheck className="size-3.5" />
                Your attendance is saved for this session only.
              </p>
            </>
          )}
        </div>
      </section>
      {success ? (
        <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog">
          <section className="w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="h-1.5 bg-emerald-600" />
            <div className="p-6 text-center sm:p-8">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-8" /></span>
              <h2 className="mt-5 text-2xl font-black text-slate-950">Attendance Confirmed</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{message}</p>
              {joinUrl ? (
                <>
                  {autoRedirect ? <p className="mt-5 inline-flex items-center gap-2 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600"><Clock3 className="size-4 text-emerald-600" />Opening Zoom in {countdown} second{countdown === 1 ? "" : "s"}</p> : null}
                  <a className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700" href={joinUrl}><Video className="size-5" />Join Zoom Session<ArrowRight className="size-4" /></a>
                  {autoRedirect ? <button className="mt-3 text-xs font-black text-slate-500 hover:text-slate-800" onClick={() => setAutoRedirect(false)} type="button">Stay on this page</button> : null}
                </>
              ) : <p className="mt-5 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">Attendance is saved. The Zoom link has not been configured for this session.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function RenderField({
  accent,
  field,
  fieldRadius,
  onChange,
  onToggle,
  value
}: {
  accent: string;
  field: BuilderField;
  fieldRadius: string;
  onChange: (value: string) => void;
  onToggle: (option: string) => void;
  value: string;
}) {
  if (field.type === "heading") {
    return <h3 className="border-b border-slate-100 pb-1 text-base font-black text-slate-900 md:col-span-2">{field.label}</h3>;
  }
  if (field.type === "divider") return <hr className="my-2 border-slate-200 md:col-span-2" />;

  const inputClass = `w-full border border-slate-200 bg-slate-50/50 px-4 py-3 text-base sm:text-sm font-semibold outline-none transition-all focus:bg-white focus:ring-4 focus:ring-slate-100 ${fieldRadius}`;
  const wide = field.width === "full" || field.type === "paragraph" || field.type === "radio" || field.type === "checkbox" || field.type === "consent" || field.type === "rating";
  const options = (field.options ?? []).map((option) => option.trim()).filter(Boolean);
  let control: React.ReactNode;

  if (field.type === "paragraph") {
    control = <textarea className={inputClass} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={3} value={value} />;
  } else if (field.type === "dropdown") {
    control = (
      <select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Select...</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  } else if (field.type === "radio" || field.type === "checkbox") {
    const selected = value.split(" | ").filter(Boolean);
    control = (
      <div className="space-y-1.5">
        {options.map((option) => (
          <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-slate-700" key={option}>
            <input
              checked={field.type === "radio" ? value === option : selected.includes(option)}
              className="size-5"
              style={{ accentColor: accent }}
              name={field.id}
              onChange={() => (field.type === "radio" ? onChange(option) : onToggle(option))}
              type={field.type === "radio" ? "radio" : "checkbox"}
            />
            {option}
          </label>
        ))}
      </div>
    );
  } else if (field.type === "yes_no") {
    control = <div className="grid grid-cols-2 gap-2">{["Yes", "No"].map((option) => <button className={`min-h-11 border px-4 text-sm font-black ${fieldRadius} ${value === option ? "text-white" : "border-slate-200 bg-white text-slate-600"}`} key={option} onClick={() => onChange(option)} style={value === option ? { backgroundColor: accent, borderColor: accent } : undefined} type="button">{option}</button>)}</div>;
  } else if (field.type === "rating") {
    const maximum = Math.min(10, Math.max(1, field.max || 5));
    control = <div className="flex flex-wrap gap-2">{Array.from({ length: maximum }, (_, index) => index + 1).map((rating) => <button aria-label={`Rate ${rating}`} className="grid size-11 place-items-center border border-slate-200 bg-white" key={rating} onClick={() => onChange(String(rating))} type="button"><Star className="size-6" fill={Number(value) >= rating ? accent : "transparent"} style={{ color: Number(value) >= rating ? accent : "#cbd5e1" }} /></button>)}</div>;
  } else if (field.type === "consent") {
    control = <label className="flex min-h-12 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input checked={value === "Accepted"} className="mt-0.5 size-5" onChange={(event) => onChange(event.target.checked ? "Accepted" : "")} style={{ accentColor: accent }} type="checkbox" /><span>{field.placeholder || "I agree and give my consent."}</span></label>;
  } else {
    const inputType = field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text";
    control = (
      <input
        className={inputClass}
        inputMode={field.type === "mobile" ? "tel" : field.type === "number" ? "numeric" : undefined}
        max={field.max}
        maxLength={field.maxLength}
        min={field.min}
        minLength={field.minLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        type={inputType}
        value={value}
      />
    );
  }

  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm font-black text-slate-700">
        {field.label}
        {field.required ? <span className="text-emerald-600"> *</span> : null}
      </span>
      {control}
      {field.helpText ? <span className="mt-1.5 block text-xs font-semibold text-slate-400">{field.helpText}</span> : null}
    </label>
  );
}
