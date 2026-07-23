"use client";

import { activeResponseFilterCount, emptyResponseFilters, type ResponseFilterState } from "@/lib/response-filters";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

const fieldClass = "min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export function AdvancedResponseFilters({ filters, onChange, questions, resultCount, totalCount }: { filters: ResponseFilterState; onChange: (filters: ResponseFilterState) => void; questions: string[]; resultCount: number; totalCount: number }) {
  const [open, setOpen] = useState(false);
  const count = activeResponseFilterCount(filters);
  const patch = (next: Partial<ResponseFilterState>) => onChange({ ...filters, ...next });
  return (
    <div>
      <button className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${count ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} onClick={() => setOpen((value) => !value)} type="button">
        <SlidersHorizontal className="size-4" />Advanced Filters{count ? ` (${count})` : ""}
      </button>
      {open ? (
        <div aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 pt-[8vh] backdrop-blur-sm" role="dialog">
          <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">Filter responses</p><p className="mt-1 text-xs font-semibold text-slate-500">Showing {resultCount} of {totalCount} responses</p></div><button aria-label="Close filters" className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500" onClick={() => setOpen(false)} type="button"><X className="size-4" /></button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterField label="Date"><select className={fieldClass} onChange={(event) => patch({ datePreset: event.target.value as ResponseFilterState["datePreset"] })} value={filters.datePreset}><option value="all">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 days</option><option value="custom">Custom range</option></select></FilterField>
            {filters.datePreset === "custom" ? <><FilterField label="From date"><input className={fieldClass} onChange={(event) => patch({ fromDate: event.target.value })} type="date" value={filters.fromDate} /></FilterField><FilterField label="To date"><input className={fieldClass} onChange={(event) => patch({ toDate: event.target.value })} type="date" value={filters.toDate} /></FilterField></> : null}
            <FilterField label="From time"><input className={fieldClass} onChange={(event) => patch({ fromTime: event.target.value })} type="time" value={filters.fromTime} /></FilterField>
            <FilterField label="To time"><input className={fieldClass} onChange={(event) => patch({ toTime: event.target.value })} type="time" value={filters.toTime} /></FilterField>
            <FilterField label="Question"><select className={fieldClass} onChange={(event) => patch({ answer: "", question: event.target.value })} value={filters.question}><option value="">Select question</option>{questions.map((question) => <option key={question} value={question}>{question}</option>)}</select></FilterField>
            <FilterField label="Answer match"><select className={fieldClass} disabled={!filters.question} onChange={(event) => patch({ answerOperator: event.target.value as ResponseFilterState["answerOperator"] })} value={filters.answerOperator}><option value="contains">Contains</option><option value="equals">Exact answer</option><option value="contains_any">Contains any</option><option value="contains_all">Contains all</option><option value="not_contains">Does not contain</option></select></FilterField>
            <FilterField label="Answer value"><input className={fieldClass} disabled={!filters.question} onChange={(event) => patch({ answer: event.target.value })} placeholder="For multiple: value 1, value 2" value={filters.answer} /></FilterField>
          </div>
          <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-100" onClick={() => onChange({ ...emptyResponseFilters })} type="button"><RotateCcw className="size-4" />Clear filters</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({ children, label }: { children: React.ReactNode; label: string }) {
  return <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}
