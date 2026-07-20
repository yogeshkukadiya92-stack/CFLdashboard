"use client";

import { ArrowRight, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass = "w-full border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export default function AttendanceTeamLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/attendance-team/login", { body: JSON.stringify({ email, password }), headers: { "Content-Type": "application/json" }, method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      router.replace("/attendance-team");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign in."); }
    finally { setLoading(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10"><section className="w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/70"><div className="h-1.5 bg-emerald-600" /><div className="p-6 sm:p-8"><img alt="Coach For Life" className="mx-auto h-20 w-auto max-w-[220px] object-contain" src="/brand/coach-for-life-logo-stacked.png" /><div className="mt-7 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck className="size-6" /></span><h1 className="mt-5 text-2xl font-black">Attendance Team</h1><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Sign in to view the workshop attendance sessions assigned to you.</p></div>{error ? <p className="mt-5 border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}<form className="mt-6 space-y-4" onSubmit={login}><label className="block"><span className="mb-2 block text-sm font-black text-slate-700">Email</span><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input autoComplete="email" className={`${inputClass} pl-10`} onChange={(event) => setEmail(event.target.value)} placeholder="employee@example.com" type="email" value={email} /></div></label><label className="block"><span className="mb-2 block text-sm font-black text-slate-700">Password</span><div className="relative"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input autoComplete="current-password" className={`${inputClass} pl-10`} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" type="password" value={password} /></div></label><button className="inline-flex w-full items-center justify-center gap-2 bg-emerald-600 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60" disabled={loading} type="submit">{loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{loading ? "Signing in..." : "Open Attendance"}<ArrowRight className="size-4" /></button></form><p className="mt-6 text-center text-xs font-bold text-slate-400">Secure employee access · Coach For Life</p></div></section></main>;
}
