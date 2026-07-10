"use client";

export const LIVE_STATE_STORAGE_KEYS = {
  clients: "cfl_clients_v1",
  facilitators: "cfl_facilitators_v1",
  forms: "cfl_forms_v1",
  leads: "cfl_leads_v1",
  registrationLinks: "cfl_registration_link_configs_v1",
  registrations: "cfl_registrations_v1",
  salesPeople: "cfl_sales_people_v1",
  schedules: "cfl_event_schedules_v1",
  workshopTypes: "cfl_workshop_types_v1",
  workshops: "cfl_workshop_master_records_v1"
} as const;

type ArrayStateKey = Exclude<keyof typeof LIVE_STATE_STORAGE_KEYS, "registrationLinks">;

export type LiveStatePatch = Partial<Record<ArrayStateKey, unknown[]> & {
  integrations: Record<string, unknown>;
  registrationLinks: Record<string, unknown>;
}>;

export type LiveState = LiveStatePatch & {
  dbEnabled?: boolean;
  error?: string;
};

export function readLocalArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function readLocalObject<T extends Record<string, unknown>>(key: string): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

export function writeLiveStateToLocalStorage(patch: LiveStatePatch) {
  Object.entries(LIVE_STATE_STORAGE_KEYS).forEach(([stateKey, storageKey]) => {
    const value = patch[stateKey as keyof LiveStatePatch];
    if (value === undefined) return;
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  });
}

export async function fetchLiveState(): Promise<LiveState | null> {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as LiveState;
  } catch {
    return null;
  }
}

export async function hydrateLiveState(): Promise<LiveState | null> {
  const state = await fetchLiveState();
  if (!state?.dbEnabled) return state;

  const localPatch: LiveStatePatch = {};
  (Object.keys(LIVE_STATE_STORAGE_KEYS) as Array<keyof typeof LIVE_STATE_STORAGE_KEYS>).forEach((key) => {
    const value = state[key];
    if (Array.isArray(value) || (key === "registrationLinks" && value && typeof value === "object")) {
      Object.assign(localPatch, { [key]: value });
    }
  });
  writeLiveStateToLocalStorage(localPatch);
  return state;
}

export async function saveLiveState(patch: LiveStatePatch) {
  writeLiveStateToLocalStorage(patch);
  try {
    const response = await fetch("/api/state", {
      body: JSON.stringify(patch),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function hydratePublicRegistrationState(): Promise<LiveState | null> {
  try {
    const response = await fetch("/api/public-registration-state", { cache: "no-store" });
    if (!response.ok) return null;
    const state = (await response.json()) as LiveState;
    if (!state.dbEnabled) return state;
    writeLiveStateToLocalStorage({
      forms: Array.isArray(state.forms) ? state.forms : undefined,
      registrationLinks: state.registrationLinks && typeof state.registrationLinks === "object" ? state.registrationLinks : undefined,
      workshops: Array.isArray(state.workshops) ? state.workshops : undefined
    });
    return state;
  } catch {
    return null;
  }
}

export async function savePublicRegistration(registration: unknown, registrations: unknown[]) {
  writeLiveStateToLocalStorage({ registrations });
  try {
    const response = await fetch("/api/public-registration-state", {
      body: JSON.stringify({ registration }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    return response.ok;
  } catch {
    return false;
  }
}
