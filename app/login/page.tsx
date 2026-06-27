"use client";

import { LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("coachforlife107@gmail.com");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      setNextPath(next);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Login failed." }));
        setError(data.message ?? "Login failed.");
        setLoading(false);
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setError("Login request failed. Check deployment environment variables and try again.");
      setLoading(false);
    } finally {
      window.clearTimeout(timer);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 text-slate-950">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel lg:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-slate-950 p-8 text-white md:p-10">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-emerald-500 text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">CFL Admin</p>
              <h1 className="text-2xl font-black">Master Login</h1>
            </div>
          </div>

          <div className="mt-12">
            <p className="text-4xl font-black tracking-tight">Secure access for your business dashboard.</p>
            <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-slate-300">
              Only the master admin can access CRM, workshop, reports and settings screens.
            </p>
          </div>

          <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm font-black text-white">Master Admin</p>
            <p className="mt-1 text-sm font-semibold text-slate-300">coachforlife107@gmail.com</p>
          </div>
        </div>

        <div className="p-8 md:p-10">
          <div className="mx-auto max-w-md">
            <span className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <LockKeyhole className="size-5" />
            </span>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Enter the master credentials to continue to CFL Admin.
            </p>

            <form className="mt-8 space-y-5" onSubmit={submit}>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Admin Email</span>
                <input
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Password</span>
                <input
                  autoComplete="current-password"
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  type="password"
                  value={password}
                />
              </label>

              {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
                type="submit"
              >
                <LogIn className="size-4" />
                {loading ? "Signing in..." : "Login as Master Admin"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
