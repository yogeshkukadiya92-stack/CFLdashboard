"use client";

import { useId, useState } from "react";

type Props = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  className: string;
  disabled?: boolean;
  loading?: boolean;
  placeholder: string;
};

export function LocationSearchSelect({ label, value, options, onChange, className, disabled, loading, placeholder }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const matches = options.filter(option => option.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 5);
  const expanded = open && !disabled && !loading;

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setQuery("");
    setActive(-1);
  }

  return (
    <div className="relative">
      <input
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-options`}
        aria-activedescendant={expanded && active >= 0 && matches[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={disabled || loading}
        placeholder={loading ? "Loading cities…" : placeholder}
        role="combobox"
        value={expanded ? query : value}
        onFocus={() => { setOpen(true); setQuery(""); setActive(-1); }}
        onClick={() => { if (!open) { setOpen(true); setQuery(""); setActive(-1); } }}
        onBlur={() => { setOpen(false); setQuery(""); setActive(-1); }}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive(index => matches.length ? (event.key === "ArrowDown" ? (index + 1) % matches.length : (index <= 0 ? matches.length - 1 : index - 1)) : -1);
          } else if (event.key === "Enter" && expanded) {
            event.preventDefault();
            if (matches[active]) choose(matches[active]);
            else if (matches.length === 1) choose(matches[0]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      />
      {expanded && (
        <div id={`${id}-options`} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((option, index) => (
            <div
              id={`${id}-${index}`}
              key={option}
              role="option"
              aria-selected={option === value}
              className={`cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50 ${active === index ? "bg-emerald-50" : ""}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(option)}
            >{option}</div>
          ))}
          {!matches.length && <div role="status" className="px-4 py-3 text-sm text-slate-500">No matches found. Try another spelling.</div>}
        </div>
      )}
    </div>
  );
}
