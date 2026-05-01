"use client";

import { workshops } from "@/lib/data";
import type { RegistrationEntry } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const STORAGE_KEY = "cfl_registrations_v1";

function cleanMobile(value: string) {
  return value.replace(/\D/g, "");
}

export default function RegistrationPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const workshop = useMemo(() => workshops.find((item) => item.slug === slug), [slug]);
  const batch = searchParams.get("batch") ?? "main";
  const venue = searchParams.get("venue") ?? workshop?.city ?? "TBA";
  const paidEnabled = searchParams.get("paid") !== "0";
  const partEnabled = searchParams.get("part") === "1";

  const [form, setForm] = useState({
    city: "",
    email: "",
    fullName: "",
    mobile: "",
    partAmount: "",
    paymentMode: "Full" as "Full" | "Part"
  });
  const [message, setMessage] = useState("");

  if (!workshop) {
    return (
      <main className="min-h-screen bg-[#f7f8f4] p-6 text-ink-900">
        <div className="mx-auto max-w-2xl rounded-xl border border-ink-900/10 bg-white p-6">
          <h1 className="text-2xl font-bold">Registration Link Invalid</h1>
          <p className="mt-2 text-sm text-ink-500">This workshop registration link is not active.</p>
        </div>
      </main>
    );
  }

  const fullAmount = paidEnabled ? workshop.price : 0;
  const partAmountRaw = Number(form.partAmount || 0);
  const amountPaid = form.paymentMode === "Full" ? fullAmount : Math.max(0, Math.min(partAmountRaw, fullAmount));
  const amountDue = Math.max(0, fullAmount - amountPaid);

  function submitRegistration() {
    if (!workshop) {
      setMessage("Workshop link is invalid.");
      return;
    }
    const mobile = cleanMobile(form.mobile);
    if (!form.fullName.trim() || mobile.length < 10 || !form.email.trim()) {
      setMessage("Please fill name, valid mobile, and email.");
      return;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    setMessage("Registration successful. Payment recorded and dashboard entry created.");
    setForm((prev) => ({ ...prev, city: "", email: "", fullName: "", mobile: "", partAmount: "" }));
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] p-4 text-ink-900 md:p-8">
      <section className="mx-auto max-w-3xl rounded-xl border border-ink-900/10 bg-white p-6 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Workshop Registration</p>
        <h1 className="mt-2 text-3xl font-bold">{workshop.title}</h1>
        <p className="mt-2 text-sm text-ink-500">
          Batch: {batch} | Venue: {venue} | Fee: {formatCurrency(fullAmount)}
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm outline-none" placeholder="Full Name" value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
          <input className="rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm outline-none" placeholder="Mobile Number" value={form.mobile} onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))} />
          <input className="rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm outline-none" placeholder="Email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
          <input className="rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm outline-none" placeholder="City" value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} />
        </div>

        <div className="mt-4 rounded-lg border border-ink-900/10 p-4">
          <p className="text-sm font-semibold">Payment Option</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input checked={form.paymentMode === "Full"} onChange={() => setForm((prev) => ({ ...prev, paymentMode: "Full" }))} type="radio" />
              Full Payment
            </label>
            {partEnabled ? (
              <label className="inline-flex items-center gap-2">
                <input checked={form.paymentMode === "Part"} onChange={() => setForm((prev) => ({ ...prev, paymentMode: "Part" }))} type="radio" />
                Part Payment
              </label>
            ) : null}
          </div>
          {form.paymentMode === "Part" ? (
            <input className="mt-3 w-full rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm outline-none" placeholder="Enter Part Amount" value={form.partAmount} onChange={(event) => setForm((prev) => ({ ...prev, partAmount: event.target.value }))} />
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-[#f6f8f4] p-2.5">Paid: {formatCurrency(amountPaid)}</div>
            <div className="rounded-md bg-[#f6f8f4] p-2.5">Due: {formatCurrency(amountDue)}</div>
          </div>
        </div>

        <button className="mt-5 rounded-lg bg-mint-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={submitRegistration} type="button">
          Register & Pay
        </button>
        {message ? <p className="mt-3 text-sm font-semibold text-mint-700">{message}</p> : null}
      </section>
    </main>
  );
}
