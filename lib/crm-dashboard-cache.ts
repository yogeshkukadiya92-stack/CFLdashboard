"use client";

import type { LiveState } from "./live-state";

const KEY = "cfl_crm_dashboard_v1";
let memory: { session: string; state: LiveState } | null = null;
let pending: { session: string; promise: Promise<LiveState> } | null = null;

function sessionKey() {
  return document.cookie.split("; ").find((part) => part.startsWith("cfl_crm_cache_session="))?.split("=")[1] || "";
}

export function cacheCrmDashboard(state: LiveState) {
  const session = sessionKey();
  if (!session) return;
  memory = { session, state };
  try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* Memory still works when storage is full. */ }
}

export function readCrmDashboard(): LiveState | null {
  const session = sessionKey();
  if (!session) return null;
  if (memory?.session === session) return memory.state;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (saved?.session === session && Array.isArray(saved.state?.leads)) {
      memory = saved;
      return saved.state;
    }
  } catch { /* Ignore an unavailable or damaged cache. */ }
  return null;
}

export function clearCrmDashboard() {
  memory = null;
  pending = null;
  try { sessionStorage.removeItem(KEY); } catch { /* Optional browser cache. */ }
}

export function loadCrmDashboard(): Promise<LiveState> {
  const cached = readCrmDashboard();
  if (cached) return Promise.resolve(cached);
  const session = sessionKey();
  if (pending?.session === session) return pending.promise;
  const promise = fetch("/api/state?scope=crm-today", { cache: "no-store", signal: AbortSignal.timeout(20_000) })
    .then(async (response) => {
      if (!response.ok) throw new Error("Could not load leads");
      const state = await response.json() as LiveState;
      if (state.error || (state.dbEnabled !== false && !Array.isArray(state.leads))) throw new Error("Lead data unavailable");
      // A login/logout during this request must never cache the previous user's response.
      if (sessionKey() !== session && session) throw new Error("Session changed");
      if (state.dbEnabled !== false) cacheCrmDashboard(state);
      return state;
    }).finally(() => { if (pending?.promise === promise) pending = null; });
  pending = { session, promise };
  return promise;
}
