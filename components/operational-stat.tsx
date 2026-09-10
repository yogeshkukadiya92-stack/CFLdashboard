import type { ReactNode } from "react";

type OperationalStatTone = "danger" | "default" | "info" | "success" | "warning";

export function OperationalStat({
  active = false,
  label,
  onClick,
  suffix = "",
  tone = "default",
  value
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
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

  const className = `inline-flex min-h-7 items-baseline gap-1.5 border-r border-slate-200 px-2.5 last:border-r-0 ${onClick ? "cursor-pointer rounded-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" : ""} ${active ? "bg-white shadow-sm ring-1 ring-inset ring-emerald-300" : ""}`;
  const content = <>
      <span className={`text-sm font-black tabular-nums ${toneClass}`}>{value}{suffix}</span>
      <span className="text-[10px] font-bold text-slate-500">{label}</span>
    </>;

  if (onClick) return <button aria-label={`${label}: ${String(value)}${suffix}. Show ${label.toLowerCase()} responses`} aria-pressed={active} className={className} onClick={onClick} type="button">{content}</button>;

  return <div aria-label={`${label}: ${String(value)}${suffix}`} className={className}>{content}</div>;
}
