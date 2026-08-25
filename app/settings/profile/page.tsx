"use client";

import { AdminPlatformShell } from "@/components/admin-platform-shell";
import { SettingsMenu } from "@/components/settings-menu";
import { Mail, Phone, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Profile = { email: string; mobile: string; name: string; role: "admin" | "sales" | "none" };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({ email: "", mobile: "", name: "", role: "none" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile unavailable");
        const data = await response.json();
        setProfile({ email: data.email || "", mobile: data.mobile || "", name: data.name || "User", role: data.role || "none" });
      })
      .catch(() => setProfile((current) => ({ ...current, name: "Profile unavailable" })))
      .finally(() => setLoading(false));
  }, []);

  const initials = (profile.name || "User").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return <AdminPlatformShell activeLabel="My Profile" description="View the identity and contact details linked to your signed-in account." title="My Profile">
    <SettingsMenu />
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-950 px-6 py-8 text-white sm:px-8"><div className="flex flex-wrap items-center gap-5">
        <div className="grid size-20 place-items-center rounded-3xl bg-emerald-500 text-2xl font-black">{loading ? "…" : initials}</div>
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Signed-in user</p><h2 className="mt-2 text-3xl font-black">{loading ? "Loading profile…" : profile.name}</h2><p className="mt-1 text-sm font-semibold capitalize text-slate-300">{profile.role === "admin" ? "Master Admin" : profile.role}</p></div>
      </div></div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
        <Detail icon={UserRound} label="Full name" value={profile.name || "Not available"} />
        <Detail icon={Phone} label="Mobile number" value={profile.mobile || "Not added"} />
        {profile.email ? <Detail icon={Mail} label="Email address" value={profile.email} /> : null}
        <Detail icon={ShieldCheck} label="Account access" value={profile.role === "admin" ? "Master Admin" : "CRM Team Member"} />
      </div>
    </section>
  </AdminPlatformShell>;
}

function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><Icon className="size-5" /></span><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-base font-black text-slate-950">{value}</p></div></div>;
}
