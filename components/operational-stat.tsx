import type { ReactNode } from "react";

type OperationalStatTone = "danger" | "default" | "info" | "success" | "warning";

export function OperationalStat({
  label,
  suffix = "",
  tone = "default",
  value
}: {
  label: string;
  suffix?: string;
  tone?: OperationalStatTone;
  value: ReactNode;
}) {
  const toneClass = {
    danger: "text-rose-700",
    default: "text-slate-900",
    info: "text-indigo-700",
    success: "text-emerald-700",
    warning: "text-amber-800"
  }[tone];

  return (
    <div aria-label={`${label}: ${String(value)}${suffix}`} className="inline-flex min-h-7 items-baseline gap-1.5 border-r border-slate-200 px-2.5 last:border-r-0">
      <span className={`text-sm font-black tabular-nums ${toneClass}`}>{value}{suffix}</span>
      <span className="text-[10px] font-bold text-slate-500">{label}</span>
    </div>
  );
}
