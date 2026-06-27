"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("cfl-theme", next ? "dark" : "light");
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    setDark(next);
  }

  return (
    <button
      aria-label={mounted && dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={mounted ? dark : undefined}
      className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
      onClick={toggle}
      title="Toggle dark mode"
      type="button"
    >
      {mounted && dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
