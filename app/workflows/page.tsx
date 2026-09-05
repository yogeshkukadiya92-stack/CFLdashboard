"use client";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, LayoutTemplate, Plus, Workflow } from "lucide-react";
import { AdminPlatformShell } from "@/components/admin-platform-shell";

export default function WorkflowsPage() {
  return <AdminPlatformShell activeLabel="Workflow Automation" description="Build and manage your business automations." title="Workflow Automation">
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="p-6 sm:p-10"><span className="grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Workflow className="size-7" /></span><h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">Your workflows. One workspace.</h2><p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">Open the full-screen workspace to manage active workflows, edit drafts and create something new.</p><Link className="mt-7 inline-flex items-center gap-3 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700" href="/workflows/studio">Open Workflow <ArrowUpRight className="size-5" /></Link></div>
      <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 p-6 sm:grid-cols-3 sm:px-10">{[{icon:CheckCircle2,title:"Active & inactive",text:"All your workflows in one place."},{icon:LayoutTemplate,title:"Templates",text:"Start with a ready-made journey."},{icon:Plus,title:"New workflow",text:"Build your own, step by step."}].map(item=><div className="flex gap-3" key={item.title}><item.icon className="mt-0.5 size-5 shrink-0 text-emerald-600" /><div><h3 className="text-sm font-bold text-slate-800">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p></div></div>)}</div>
    </section>
  </AdminPlatformShell>;
}
