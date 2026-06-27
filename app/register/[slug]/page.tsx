"use client";

import { workshops as seedWorkshops } from "@/lib/data";
import type { RegistrationEntry } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const REGISTRATION_STORAGE_KEY = "cfl_registrations_v1";
const WORKSHOP_MASTER_STORAGE_KEY = "cfl_workshop_master_records_v1";

type WorkshopMasterRecord = {
  id: string;
  name: string;
  facilitator?: string;
  productGroup?: string;
  isPaid?: boolean;
};

type ResolvedWorkshop = {
  id: string;
  slug: string;
  title: string;
  facilitator: string;
  city: string;
  price: number;
  isPaid: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanMobile(value: string) {
  return value.replace(/\D/g, "");
}

export default function RegistrationPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;

  const batch = searchParams.get("batch") ?? "Main Batch";
  const paidEnabled = searchParams.get("paid") !== "0";
  const partEnabled = searchParams.get("part") === "1";
  const feeParam = Number(searchParams.get("fee") || 0);

  const [ready, setReady] = useState(false);
  const [workshop, setWorkshop] = useState<ResolvedWorkshop | null>(null);
  const [form, setForm] = useState({
    city: "",
    email: "",
    fullName: "",
    mobile: "",
    partAmount: "",
    paymentMode: "Full" as "Full" | "Part"
  });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Resolve the workshop from saved master records first, then the static seed.
  useEffect(() => {
    let resolved: ResolvedWorkshop | null = null;

    try {
      const raw = window.localStorage.getItem(WORKSHOP_MASTER_STORAGE_KEY);
      const records = raw ? (JSON.parse(raw) as WorkshopMasterRecord[]) : [];
      const match = records.find((record) => slugify(record.name) === slug || record.id === slug);
      if (match) {
        resolved = {
          id: match.id,
          slug: slugify(match.name) || match.id,
          title: match.name,
          facilitator: match.facilitator || "CFL Facilitator",
          city: "TBA",
          price: feeParam > 0 ? feeParam : 0,
          isPaid: Boolean(match.isPaid)
        };
      }
    } catch {
      resolved = null;
    }

    if (!resolved) {
      const seed = seedWorkshops.find((item) => item.slug === slug);
      if (seed) {
        resolved = {
          id: seed.id,
          slug: seed.slug,
          title: seed.title,
          facilitator: seed.trainer,
          city: seed.city,
          price: feeParam > 0 ? feeParam : seed.price,
          isPaid: seed.price > 0
        };
      }
    }

    setWorkshop(resolved);
    setReady(true);
  }, [feeParam, slug]);

  const venue = searchParams.get("venue") ?? workshop?.city ?? "TBA";
  const chargeable = paidEnabled && (workshop?.isPaid ?? true);
  const fullAmount = chargeable ? workshop?.price ?? 0 : 0;
  const partAmountRaw = Number(form.partAmount || 0);
  const amountPaid = form.paymentMode === "Full" ? fullAmount : Math.max(0, Math.min(partAmountRaw, fullAmount));
  const amountDue = Math.max(0, fullAmount - amountPaid);

  const canSubmit = useMemo(() => {
    return Boolean(form.fullName.trim()) && cleanMobile(form.mobile).length >= 10 && Boolean(form.email.trim());
  }, [form.email, form.fullName, form.mobile]);

  function submitRegistration() {
    if (!workshop) {
      setMessage("Workshop link is invalid.");
      return;
    }
    const mobile = cleanMobile(form.mobile);
    if (!canSubmit) {
      setMessage("Please fill your name, a valid 10-digit mobile number, and email.");
      return;
    }

    const raw = localStorage.getItem(REGISTRATION_STORAGE_KEY);
    const current: RegistrationEntry[] = raw ? JSON.parse(raw) : [];
    const registrationId = `reg-${workshop.id}-${mobile}`;
    const existingIndex = current.findIndex((item) => item.id === registrationId);
    const payload: RegistrationEntry = {
      id: registrationId,
      workshopId: workshop.id,
      workshopSlug: workshop.slug,
      workshopTitle: workshop.title,
      fullName: form.fullName.trim(),
      mobile: `+91 ${mobile}`,
      email: form.email.trim(),
      city: form.city.trim() || "Unknown",
      paymentMode: form.paymentMode,
      amountPaid,
      amountDue,
      status: amountDue > 0 ? "Due" : "Paid",
      createdAt: new Date().toISOString().slice(0, 10)
    };

    if (existingIndex >= 0) {
      current[existingIndex] = payload;
    } else {
      current.unshift(payload);
    }
    localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(current));
    setSuccess(true);
    setMessage(
      existingIndex >= 0
        ? "Your registration was updated. See you at the workshop!"
        : "Registration confirmed. See you at the workshop!"
    );
    setForm((prev) => ({ ...prev, city: "", email: "", fullName: "", mobile: "", partAmount: "" }));
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-slate-950">
        <p className="text-sm font-bold text-slate-500">Loading registration…</p>
      </main>
    );
  }

  if (!workshop) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-black tracking-tight">Registration link is not active</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            This workshop link has expired or was never published. Please contact the CFL team for the latest registration link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 md:py-12">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
        <div className="bg-slate-950 p-6 text-white md:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">CFL Workshop Registration</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{workshop.title}</h1>
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm font-semibold text-slate-300">
            <span>Batch: {batch}</span>
            <span aria-hidden>•</span>
            <span>Facilitator: {workshop.facilitator}</span>
            <span aria-hidden>•</span>
            <span>Venue: {venue}</span>
          </p>
          <p className="mt-4 inline-flex rounded-lg bg-emerald-500 px-3 py-2 text-sm font-black text-white">
            {chargeable ? `Fee: ${formatCurrency(fullAmount)}` : "Free Registration"}
          </p>
        </div>

        <div className="p-6 md:p-8">
          {success ? (
            <div className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full Name" required value={form.fullName} onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))} placeholder="Your full name" />
            <Field label="Mobile Number" required value={form.mobile} onChange={(value) => setForm((prev) => ({ ...prev, mobile: value }))} placeholder="10-digit mobile" inputMode="tel" />
            <Field label="Email" required type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="you@example.com" />
            <Field label="City" value={form.city} onChange={(value) => setForm((prev) => ({ ...prev, city: value }))} placeholder="Your city" />
          </div>

          {chargeable ? (
            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-black text-slate-700">Payment Option</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                <label className="inline-flex items-center gap-2">
                  <input checked={form.paymentMode === "Full"} onChange={() => setForm((prev) => ({ ...prev, paymentMode: "Full" }))} type="radio" className="size-4 accent-emerald-600" />
                  Full Payment
                </label>
                {partEnabled ? (
                  <label className="inline-flex items-center gap-2">
                    <input checked={form.paymentMode === "Part"} onChange={() => setForm((prev) => ({ ...prev, paymentMode: "Part" }))} type="radio" className="size-4 accent-emerald-600" />
                    Part Payment
                  </label>
                ) : null}
              </div>
              {form.paymentMode === "Part" ? (
                <input
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  inputMode="numeric"
                  onChange={(event) => setForm((prev) => ({ ...prev, partAmount: event.target.value }))}
                  placeholder="Enter part amount"
                  value={form.partAmount}
                />
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
                <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-emerald-700">Paying now: {formatCurrency(amountPaid)}</div>
                <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-amber-700">Balance due: {formatCurrency(amountDue)}</div>
              </div>
            </div>
          ) : null}

          {!success && message ? (
            <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{message}</p>
          ) : null}

          <button
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSubmit}
            onClick={submitRegistration}
            type="button"
          >
            <ShieldCheck className="size-4" />
            {chargeable ? "Register & Pay" : "Confirm Registration"}
          </button>
          <p className="mt-3 text-center text-xs font-semibold text-slate-400">Your details are saved securely for this workshop only.</p>
        </div>
      </section>
    </main>
  );
}

function Field({
  inputMode,
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value
}: {
  inputMode?: "tel" | "numeric" | "text";
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      <input
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}
