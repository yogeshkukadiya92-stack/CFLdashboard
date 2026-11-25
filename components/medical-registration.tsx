"use client";
import { useEffect, useState } from "react";
import type { MedicalSlot } from "@/lib/mfw-medical";

type Access = { registrationId: string; secret: string };
type Status = {
  slots?: MedicalSlot[];
  enrolled?: boolean;
  receipt?: { id: string; startsAt: string };
};
const time = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

async function send(
  access: Access,
  action: string,
  slot?: string
): Promise<Status> {
  const response = await fetch("/api/medical-booking", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...access, action, slot }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || "Could not load medical slots.");
  return data;
}

export function useMedicalRegistration() {
  const [access, setAccess] = useState<Access | null>(null);
  const [status, setStatus] = useState<Status>({});
  const [error, setError] = useState("");
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!access || busy || status.receipt) return;
    let active = true;
    async function load() {
      try {
        const data = await send(access!, "status");
        if (active) {
          setStatus(data);
          setSlot((previous) =>
            data.slots?.some((s) => s.id === previous) ? previous : ""
          );
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Please retry.");
      }
    }
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [access, busy, status.receipt, refresh]);
  async function book() {
    if (!access || !slot || busy) return;
    setBusy(true);
    setError("");
    try {
      setStatus(await send(access, "book", slot));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed.");
      setRefresh((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }
  const selectedSlot = status.slots?.find((item) => item.id === slot);
  const result = access && (
    <section
      className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4"
      aria-label="Medical appointment"
    >
      {status.receipt ? (
        <p role="status">
          Medical appointment confirmed: {time(status.receipt.startsAt)} IST ·
          Booking {status.receipt.id}
        </p>
      ) : (
        <>
          <p className="text-sm font-bold text-emerald-700" role="status" aria-live="polite">
            {!status.slots
              ? "Loading available time slots…"
              : selectedSlot
                ? `Spaces remaining at selected time: ${selectedSlot.remainingCount}`
                : "Select a time to see remaining spaces."}
          </p>
          <label>
            Choose your medical appointment (IST)
            <select
              className="block w-full rounded border p-2"
              value={slot}
              disabled={busy}
              onChange={(e) => setSlot(e.target.value)}
            >
              <option value="">Select a time</option>
              {status.slots?.map((s) => (
                <option key={s.id} value={s.id}>
                  {time(s.startsAt)} · {s.remainingCount} spaces left
                </option>
              ))}
            </select>
          </label>
          {status.enrolled === false && <p>Submit to complete enrollment and book your selected time.</p>}
          {status.slots?.length === 0 && (
            <p>No appointments currently available.</p>
          )}
          {error && (
            <p role="alert">
              {error}{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRefresh((n) => n + 1);
                }}
              >
                Refresh
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
  return {
    active: Boolean(access),
    confirmed: Boolean(status.receipt),
    submitButton: access && !status.receipt ? (
      <button
        className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        disabled={!slot || busy}
        onClick={book}
      >
        {busy ? "Submitting…" : "Submit"}
      </button>
    ) : null,
    result,
    open: (registrationId: string, secret: string) =>
      setAccess({ registrationId, secret }),
    reset: () => {
      setAccess(null);
      setSlot("");
      setError("");
      setStatus({});
    },
  };
}
