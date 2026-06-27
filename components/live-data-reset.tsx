"use client";

import { useEffect } from "react";

const RESET_MARKER = "cfl_live_clean_reset_2026_05_12";

export function LiveDataReset() {
  useEffect(() => {
    if (window.localStorage.getItem(RESET_MARKER) === "done") return;

    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("cfl_"))
      .forEach((key) => window.localStorage.removeItem(key));

    window.localStorage.setItem(RESET_MARKER, "done");
  }, []);

  return null;
}
