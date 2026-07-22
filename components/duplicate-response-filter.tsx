import { ListFilter } from "lucide-react";

export function DuplicateResponseFilter({ checked, onChange, rawCount, visibleCount }: { checked: boolean; onChange: (checked: boolean) => void; rawCount: number; visibleCount: number }) {
  const hidden = Math.max(0, rawCount - visibleCount);
  return (
    <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${checked ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
      <input checked={checked} className="size-4 accent-emerald-600" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <ListFilter className="size-4" />
      Hide duplicates{checked && hidden ? ` (${hidden})` : ""}
    </label>
  );
}
