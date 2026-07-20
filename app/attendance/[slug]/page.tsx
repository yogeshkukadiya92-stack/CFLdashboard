"use client";

import { readLocalArray, writeLiveStateToLocalStorage } from "@/lib/live-state";
import type { AttendanceEntry, AttendanceSession, BuilderField } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, Loader2, ShieldCheck, Video } from "lucide-react";
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

  const missingRequired = useMemo(() => {
    if (!session) return true;
    return session.fields.some((field) => {
      if (field.type === "heading" || !field.required) return false;
      const value = (answers[field.id] ?? "").trim();
      if (!value) return true;
      if (field.role === "mobile") return cleanMobile(value).length < 10;
      return false;
    });
  }, [answers, session]);

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50 px-4 py-8 text-slate-950 md:py-12">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)]">
        <div className="h-2.5 bg-gradient-to-r from-emerald-600 to-teal-400" />
        <div className="p-6 md:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">CFL Session Attendance</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{session.workshopName}</h1>
          <p className="mt-2 text-lg font-black text-slate-800">{session.title}</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">{formatSessionDate(session)}{session.facilitator ? ` • ${session.facilitator}` : ""}{session.venue ? ` • ${session.venue}` : ""}</p>
          {session.description ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{session.description}</p> : null}
        </div>

        <div className="border-t border-slate-100 p-6 md:p-8">
          {success ? <div className="min-h-24" /> : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {session.fields.map((field) => (
                  <RenderField
                    field={field}
                    key={field.id}
                    onChange={(value) => setAnswer(field.id, value)}
                    onToggle={(option) => toggleCheckbox(field.id, option)}
                    value={answers[field.id] ?? ""}
                  />
                ))}
              </div>

              {message ? <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{message}</p> : null}

              <button
                className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_12px_28px_-15px_rgba(5,150,105,0.7)] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={submitting}
                onClick={submitAttendance}
                type="button"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {submitting ? "Saving Attendance" : "Mark Attendance"}
              </button>
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
  field,
  onChange,
  onToggle,
  value
}: {
  field: BuilderField;
  onChange: (value: string) => void;
  onToggle: (option: string) => void;
  value: string;
}) {
  if (field.type === "heading") {
    return <h3 className="border-b border-slate-100 pb-1 text-base font-black text-slate-900 md:col-span-2">{field.label}</h3>;
  }

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-base sm:text-sm font-semibold outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100";
  const wide = field.type === "paragraph" || field.type === "radio" || field.type === "checkbox";
  let control: React.ReactNode;

  if (field.type === "paragraph") {
    control = <textarea className={inputClass} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={3} value={value} />;
  } else if (field.type === "dropdown") {
    control = (
      <select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Select...</option>
        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  } else if (field.type === "radio" || field.type === "checkbox") {
    const selected = value.split(" | ").filter(Boolean);
    control = (
      <div className="space-y-1.5">
        {(field.options ?? []).map((option) => (
          <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-slate-700" key={option}>
            <input
              checked={field.type === "radio" ? value === option : selected.includes(option)}
              className="size-5 accent-emerald-600"
              name={field.id}
              onChange={() => (field.type === "radio" ? onChange(option) : onToggle(option))}
              type={field.type === "radio" ? "radio" : "checkbox"}
            />
            {option}
          </label>
        ))}
      </div>
    );
  } else {
    const inputType = field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
    control = (
      <input
        className={inputClass}
        inputMode={field.type === "mobile" ? "tel" : field.type === "number" ? "numeric" : undefined}
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
    </label>
  );
}
