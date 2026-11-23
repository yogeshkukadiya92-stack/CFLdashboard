"use client";

import { useState } from "react";
import { latestBirthdate, validBirthdate } from "@/lib/birthdate";

export function BirthdateInput({ value, onChange, className, label = "Birthdate" }: { value?: string; onChange?: (value: string) => void; className: string; label?: string }) {
  const [local, setLocal] = useState("");
  const current = value ?? local;
  const [year = "", month = "", day = ""] = current.split("-");
  const maximum = latestBirthdate();
  const maxYear = Number(maximum.slice(0, 4));
  const maxMonth = Number(year) === maxYear ? Number(maximum.slice(5, 7)) : 12;
  const days = month ? new Date(Date.UTC(Number(year) || 2000, Number(month), 0)).getUTCDate() : 31;
  const maxDay = Number(year) === maxYear && month === maximum.slice(5, 7) ? Math.min(days, Number(maximum.slice(8, 10))) : days;
  function update(index: number, next: string) {
    const parts = [year, month, day];
    parts[index] = next;
    if (Number(parts[0]) === maxYear && Number(parts[1]) > Number(maximum.slice(5, 7))) parts[1] = "";
    const limit = parts[1] ? new Date(Date.UTC(Number(parts[0]) || 2000, Number(parts[1]), 0)).getUTCDate() : 31;
    if (Number(parts[2]) > limit || (parts[0] === String(maxYear) && parts[1] === maximum.slice(5, 7) && Number(parts[2]) > Number(maximum.slice(8, 10)))) parts[2] = "";
    const result = parts.some(Boolean) ? parts.join("-") : "";
    setLocal(result);
    onChange?.(result);
  }
  return <div role="group" aria-label={label}>
    <div className="grid grid-cols-3 gap-2">
      <select aria-label={`${label}: Year`} className={className} value={year} onChange={(e) => update(0, e.target.value)}><option value="">Year</option>{Array.from({ length: maxYear - 1899 }, (_, i) => maxYear - i).map((y) => <option key={y} value={y}>{y}</option>)}</select>
      <select aria-label={`${label}: Month`} className={className} value={month} onChange={(e) => update(1, e.target.value)}><option value="">Month</option>{Array.from({ length: maxMonth }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{new Date(2000, i, 1).toLocaleString("en", { month: "short" })}</option>)}</select>
      <select aria-label={`${label}: Day`} className={className} value={day} onChange={(e) => update(2, e.target.value)}><option value="">Day</option>{Array.from({ length: maxDay }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{i + 1}</option>)}</select>
    </div>
    <p className="mt-1 text-xs text-slate-500">Select year, month and day. Minimum age: 12 years.</p>
    {current && !validBirthdate(current) ? <p role="alert" className="mt-1 text-xs text-red-600">Please select a complete birthdate. Age must be at least 12 years.</p> : null}
  </div>;
}
