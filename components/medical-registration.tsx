"use client";
import { useEffect, useState } from "react";
import {
  medicalAnswerError,
  visibleMedicalField,
  type MedicalField,
  type MedicalAnswers as Answers,
} from "@/lib/medical-form-fields";
import type { MedicalSlot } from "@/lib/mfw-medical";

type Form = {
  title: string;
  fields: MedicalField[];
  slots: MedicalSlot[];
  mobileKey?: string;
};
type Status = {
  state: string;
  receipt?: { id: string; startsAt: string };
  slots?: MedicalSlot[];
};
const formatTime = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
async function request(body: Record<string, unknown>) {
  const res = await fetch("/api/medical-booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save medical booking.");
  return data;
}
export function useMedicalRegistration(workshop?: string) {
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [slot, setSlot] = useState("");
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<Status>({ state: "pending" });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    if (!workshop) return;
    setForm(null);
    setError("");
    setLoaded("");
    fetch("/api/medical-booking?workshop=" + encodeURIComponent(workshop), {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load medical booking settings.");
        const data = await r.json();
        if (active) {
          setForm(data);
          setLoaded(workshop);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [workshop, refresh]);
  useEffect(() => {
    if (!secret || status.state !== "pending") return;
    let active = true;
    const poll = () =>
      request({ action: "status", secret })
        .then((data) => {
          if (active) setStatus(data);
        })
        .catch(() => {});
    const timer = setInterval(poll, 3500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [secret, status.state]);
  function prefill(
    f: MedicalField,
    name: string,
    mobile: string,
    email: string
  ) {
    if (f.dataTarget === "USER_MOBILE" || f.key === form?.mobileKey)
      return /^\+?91\d{10}$/.test(mobile) ? mobile.slice(-10) : mobile;
    if (/^full name$/i.test(f.label.trim())) return name;
    if (f.dataTarget === "USER_FIRST_NAME") return name.trim().split(/\s+/)[0];
    if (f.dataTarget === "USER_LAST_NAME")
      return name.trim().split(/\s+/).slice(1).join(" ");
    if (f.dataTarget === "USER_EMAIL") return email;
    return "";
  }
  async function prepare(
    name: string,
    mobile: string,
    email: string,
    registrationId: string
  ) {
    if (loaded !== workshop)
      throw new Error(error || "Please wait for the registration settings.");
    if (!form) return undefined;
    const values = { ...answers };
    for (const f of form.fields) {
      const value = prefill(f, name, mobile, email);
      if (value) values[f.key] = value;
    }
    const invalid = medicalAnswerError(form.fields, values);
    if (invalid) throw new Error(invalid);
    if (!slot) throw new Error("Please choose a medical appointment time.");
    const nextSecret = crypto.randomUUID();
    const data = await request({
      action: "prepare",
      workshop,
      registrationId,
      secret: nextSecret,
      answers: values,
      slot,
    }).catch((err) => {
      setRefresh((x) => x + 1);
      throw err;
    });
    setStatus({ state: "pending" });
    setSecret(nextSecret);
    return String(data.key);
  }
  function fields(name: string, mobile: string, email: string) {
    if (error)
      return (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRefresh(refresh + 1)}>
            Retry
          </button>
        </p>
      );
    if (!form) return null;
    const values = { ...answers };
    for (const field of form.fields) {
      const value = prefill(field, name, mobile, email);
      if (value) values[field.key] = value;
    }
    return (
      <fieldset className="mt-5 grid gap-3 rounded-xl border p-4">
        <legend>{form.title}</legend>
        {form.fields.map((f) => {
          if (
            prefill(f, name, mobile, email) ||
            !visibleMedicalField(f, values)
          )
            return null;
          if (["SECTION", "PAGE_BREAK"].includes(f.type))
            return <h3 key={f.key}>{f.label}</h3>;
          const set = (v: Answers[string]) =>
            setAnswers((a) => ({ ...a, [f.key]: v }));
          const value = answers[f.key];
          return (
            <label className="grid gap-1 text-sm font-semibold" key={f.key}>
              {f.label}
              {f.required ? " *" : ""}
              {f.type === "CHECKBOX" ? (
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => set(e.target.checked)}
                />
              ) : f.options?.length ? (
                <select
                  className="rounded border p-2"
                  multiple={f.type === "MULTI_CHOICE"}
                  value={
                    (value as string | string[]) ??
                    (f.type === "MULTI_CHOICE" ? [] : "")
                  }
                  onChange={(e) =>
                    set(
                      f.type === "MULTI_CHOICE"
                        ? Array.from(e.target.selectedOptions, (o) => o.value)
                        : e.target.value
                    )
                  }
                >
                  {f.type !== "MULTI_CHOICE" && (
                    <option value="">Select</option>
                  )}
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "LONG_TEXT" ? (
                <textarea
                  className="rounded border p-2"
                  value={String(value ?? "")}
                  onChange={(e) => set(e.target.value)}
                />
              ) : (
                <input
                  className="rounded border p-2"
                  type={
                    f.type === "DATE"
                      ? "date"
                      : f.type === "NUMBER" || f.type === "HEALTH_METRIC"
                      ? "number"
                      : "text"
                  }
                  value={String(value ?? "")}
                  onChange={(e) => set(e.target.value)}
                />
              )}
            </label>
          );
        })}
        <label>
          Medical appointment (IST)
          <select
            className="block w-full rounded border p-2"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
          >
            <option value="">Choose time</option>
            {form.slots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatTime(s.startsAt)}
              </option>
            ))}
          </select>
        </label>
        {!form.slots.length && <p>No appointments available.</p>}
      </fieldset>
    );
  }
  const result = secret && (
    <div className="mt-4 rounded-xl bg-slate-50 p-3" role="status">
      {status.receipt ? (
        `Medical appointment: ${formatTime(
          status.receipt.startsAt
        )} IST · Booking ${status.receipt.id}`
      ) : status.state === "review" ? (
        "Your appointment needs verification by the workshop team."
      ) : status.state === "choose_slot" ? (
        <>
          That time is full. Choose another time.
          {status.slots?.map((s) => (
            <button
              className="block p-2 underline"
              type="button"
              key={s.id}
              onClick={() =>
                request({ action: "reselect", secret, slot: s.id })
                  .then(setStatus)
                  .catch((e) => setError(e.message))
              }
            >
              {formatTime(s.startsAt)}
            </button>
          ))}
          {!status.slots?.length && "No open times are available yet."}
          <button
            type="button"
            className="underline"
            onClick={() =>
              request({ action: "status", secret })
                .then(setStatus)
                .catch((e) => setError(e.message))
            }
          >
            Refresh times
          </button>
          {error}
        </>
      ) : (
        "Your medical slot confirmation is pending."
      )}
    </div>
  );
  function reset() {
    setSecret("");
    setAnswers({});
    setStatus({ state: "pending" });
    setSlot("");
    setRefresh((x) => x + 1);
  }
  return { prepare, fields, result, active: Boolean(form), reset };
}
