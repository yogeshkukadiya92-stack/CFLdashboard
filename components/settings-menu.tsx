"use client";

import { KeyRound, Megaphone, Plug, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/settings/profile", icon: UserRound, label: "My Profile", description: "Name and mobile number" },
  { href: "/settings/sales-access", icon: KeyRound, label: "CRM Team Access", description: "Roles and permissions" },
  { href: "/settings/callflow-content", icon: Megaphone, label: "CallFlow Content", description: "Announcements and scripts" },
  { href: "/settings", icon: Plug, label: "Plugins", description: "Payments and integrations" }
];

export function SettingsMenu() {
  const pathname = usePathname();
  return <nav aria-label="Settings menu" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
    {items.map((item) => {
      const Icon = item.icon;
      const active = pathname === item.href;
      return <a className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"}`} href={item.href} key={item.href}>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${active ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-700"}`}><Icon className="size-4" /></span>
        <span className="min-w-0"><strong className="block text-sm font-black">{item.label}</strong><span className={`block truncate text-xs font-semibold ${active ? "text-slate-300" : "text-slate-500"}`}>{item.description}</span></span>
      </a>;
    })}
  </nav>;
}
