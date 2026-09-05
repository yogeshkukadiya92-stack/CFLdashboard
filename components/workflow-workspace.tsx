"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, FileText, LayoutTemplate, Loader2, Plus, Search, Workflow, X } from "lucide-react";
import { workflowTemplates, type WorkflowTemplate } from "@/lib/workflow-templates";

const Editor = dynamic(() => import("./workflow-playground").then(module => module.WorkflowPlayground), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center bg-slate-50"><span className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-5 animate-spin" />Opening workflow…</span></div>
});
type Item = { id: string; name: string; status: "active" | "draft"; version: number; nodeCount: number; updatedAt: string };
type Filter = "all" | "active" | "draft" | "templates";

export function WorkflowWorkspace() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<WorkflowTemplate | undefined>();
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const createIdRef = useRef("");
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setOffset(0); }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (filter === "templates" || selectedId) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    if (offset === 0) setItems([]);
    fetch(`/api/workflows?${new URLSearchParams({view:"library", status:filter, q:search, offset:String(offset)})}`, {signal:controller.signal, cache:"no-store"})
      .then(async response => { if (!response.ok) throw new Error("Could not load workflows. Please retry."); return response.json(); })
      .then((data: {workflows:Item[]; hasMore:boolean}) => { if (controller.signal.aborted) return; setItems(current => offset ? [...current, ...data.workflows] : data.workflows); setHasMore(data.hasMore); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, search, offset, refresh, selectedId]);

  function closeDialog() {
    if (creatingRef.current) return;
    setNewOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  }
  useEffect(() => {
    if (!newOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeDialog(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newOpen]);

  async function createWorkflow(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || creatingRef.current) return;
    creatingRef.current = true; setCreating(true); setError("");
    try {
      const id = createIdRef.current;
      const response = await fetch("/api/workflows", {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        id, name:name.trim(), status:"draft", nodes:template?.nodes ?? [], connections:template?.connections ?? [], note:""
      })});
      if (!response.ok) throw new Error("Could not create workflow. Please retry.");
      setNewOpen(false); setSelectedId(id);
    } catch(error) { setError(error instanceof Error ? error.message : "Could not create workflow."); }
    finally { creatingRef.current = false; setCreating(false); }
  }

  function openNew(button: HTMLButtonElement, recipe?: WorkflowTemplate) {
    createIdRef.current = crypto.randomUUID();
    openerRef.current = button; setTemplate(recipe); setName(recipe?.name ?? ""); setError(""); setNewOpen(true);
  }
  if (selectedId) return <Editor fullScreen onOpenWorkflow={setSelectedId} initialWorkflowId={selectedId} key={selectedId} onExit={() => { setSelectedId(null); setOffset(0); setRefresh(value=>value+1); }} />;

  return <div className="flex h-dvh flex-col overflow-hidden bg-[#f6f8fa] text-slate-900">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-7">
      <div className="flex min-w-0 items-center gap-3"><Link aria-label="Back to dashboard" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" href="/workflows"><ArrowLeft className="size-5" /></Link><span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white"><Workflow className="size-5" /></span><div><h1 className="text-base font-bold">Workflows</h1><p className="text-xs text-slate-500">Your automation workspace</p></div></div>
      <button className="workflow-button-primary" onClick={event=>openNew(event.currentTarget)} type="button"><Plus className="size-4" /><span>New Workflow</span></button>
    </header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav aria-label="Workflow library" className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 md:w-56 md:flex-col md:border-b-0 md:border-r md:p-4">
        {([{id:"all",label:"All workflows",icon:Workflow},{id:"active",label:"Active",icon:CheckCircle2},{id:"draft",label:"Inactive",icon:FileText},{id:"templates",label:"Templates",icon:LayoutTemplate}] as const).map(item=><button aria-current={filter===item.id ? "page" : undefined} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${filter===item.id ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`} key={item.id} onClick={()=>{setFilter(item.id);setOffset(0);}} type="button"><item.icon className="size-4" />{item.label}</button>)}
        <p className="mt-auto hidden px-3 pt-8 text-xs leading-5 text-slate-400 md:block">Create a draft, test your steps, then activate when ready.</p>
      </nav>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-7">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight">{filter === "templates" ? "Start with a template" : filter === "active" ? "Active workflows" : filter === "draft" ? "Inactive workflows" : "All workflows"}</h2><p className="mt-1 text-sm text-slate-500">{filter === "templates" ? "Choose a starting point and make it yours." : "Open a workflow to build, test and manage it."}</p></div><label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:w-72"><Search className="size-4 text-slate-400" /><input aria-label="Search workflows" className="min-w-0 flex-1 bg-transparent text-sm outline-none" onChange={event=>setQuery(event.target.value)} placeholder="Search workflows…" value={query} /></label></div>
          {error && !newOpen ? <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}<button className="font-bold underline" onClick={()=>setRefresh(value=>value+1)} type="button">Retry</button></div> : null}
          {filter === "templates" ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{workflowTemplates.filter(item=>`${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())).map(item=><article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5" key={item.id}><div className="flex items-center justify-between"><span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{item.category}</span><LayoutTemplate className="size-5 text-indigo-300" /></div><h3 className="mt-5 font-bold">{item.name}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{item.description}</p><button className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-emerald-700" onClick={event=>openNew(event.currentTarget,item)} type="button">Use template <ArrowUpRight className="size-4" /></button></article>)}</div> : <>
            {loading && offset===0 ? <div aria-live="polite" className="flex items-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="size-5 animate-spin" />Loading workflows…</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(item=><button className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-emerald-400 focus-visible:outline-emerald-600" key={item.id} onClick={()=>setSelectedId(item.id)} type="button"><div className="flex w-full items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-slate-50 text-slate-600"><Workflow className="size-5" /></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.status === "active" ? "Active" : "Inactive · Draft"}</span></div><h3 className="mt-5 font-bold">{item.name}</h3><p className="mt-2 text-xs text-slate-500">{item.nodeCount} {item.nodeCount === 1 ? "step" : "steps"} · Version {item.version}</p><div className="mt-5 flex w-full items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400"><span>Updated {new Date(item.updatedAt).toLocaleDateString("en-IN")}</span><ArrowUpRight className="size-4 text-emerald-600" /></div></button>)}</div>}
            {!loading && !error && !items.length ? <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center"><Workflow className="mx-auto size-8 text-slate-300" /><h3 className="mt-4 font-bold">{search ? "No matching workflows" : "No workflows here yet"}</h3><p className="mt-2 text-sm text-slate-500">{search ? "Try a different name or filter." : "Create your first workflow or choose a template."}</p></div> : null}
            {hasMore && !error ? <button className="workflow-button-secondary mt-5" disabled={loading} onClick={()=>setOffset(value=>value+50)} type="button">{loading ? "Loading…" : "Load more"}</button> : null}
          </>}
        </div>
      </main>
    </div>
    {newOpen ? <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/40 p-4" onMouseDown={event=>{if(event.target===event.currentTarget) closeDialog();}}><form aria-labelledby="new-workflow-title" aria-modal="true" role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onSubmit={createWorkflow} onKeyDown={event=>{if(event.key!=="Tab")return;const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}>
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold" id="new-workflow-title">{template ? "Create from template" : "New Workflow"}</h2><button aria-label="Close new workflow" disabled={creating} onClick={closeDialog} type="button"><X className="size-5 text-slate-400" /></button></div><p className="mt-2 text-sm text-slate-500">Your workflow starts as an inactive draft.</p><label className="mt-6 block text-sm font-semibold" htmlFor="new-workflow-name">Workflow name</label><input autoFocus className="workflow-input mt-2" disabled={creating} id="new-workflow-name" maxLength={160} onChange={event=>setName(event.target.value)} placeholder="e.g. Workshop welcome journey" required value={name} />{error ? <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p> : null}<button className="workflow-button-primary mt-6 w-full justify-center" disabled={creating || !name.trim()} type="submit">{creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{creating ? "Creating…" : "Create workflow"}</button>
    </form></div> : null}
  </div>;
}
