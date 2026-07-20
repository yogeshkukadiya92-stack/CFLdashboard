"use client";

export const LIVE_STATE_STORAGE_KEYS = {
  attendanceEntries: "cfl_attendance_entries_v1",
  attendanceSessions: "cfl_attendance_sessions_v1",
  clients: "cfl_clients_v1",
  facilitators: "cfl_facilitators_v1",
  formAnalytics: "cfl_form_analytics_v1",
  forms: "cfl_forms_v1",
  leads: "cfl_leads_v1",
  landingPages: "cfl_landing_pages_v1",
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

function hasLocalArrayData(key: string) {
  return readLocalArray<unknown>(key).length > 0;
}

function hasLocalObjectData(key: string) {
  return Object.keys(readLocalObject<Record<string, unknown>>(key)).length > 0;
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
  const repairPatch: LiveStatePatch = {};
  (Object.keys(LIVE_STATE_STORAGE_KEYS) as Array<keyof typeof LIVE_STATE_STORAGE_KEYS>).forEach((key) => {
    const storageKey = LIVE_STATE_STORAGE_KEYS[key];
    const value = state[key];
    if (Array.isArray(value)) {
      if (value.length > 0 || !hasLocalArrayData(storageKey)) {
        Object.assign(localPatch, { [key]: value });
      } else {
        Object.assign(repairPatch, { [key]: readLocalArray(storageKey) });
      }
      return;
    }
    if (key === "registrationLinks" && value && typeof value === "object") {
      const remoteHasData = Object.keys(value).length > 0;
      if (remoteHasData || !hasLocalObjectData(storageKey)) {
        Object.assign(localPatch, { [key]: value });
      } else {
        Object.assign(repairPatch, { [key]: readLocalObject(storageKey) });
      }
    }
  });
  writeLiveStateToLocalStorage(localPatch);

  if (Object.keys(repairPatch).length > 0) {
    void saveLiveState(repairPatch);
  }

  return state;
}

export async function saveLiveState(patch: LiveStatePatch) {
  writeLiveStateToLocalStorage(patch);
  try {
    const response = await fetch("/api/state", {
      body: JSON.stringify(patch),
      credentials: "same-origin",
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

    const patch: LiveStatePatch = {};
    const repairPatch: LiveStatePatch = {};
    if (Array.isArray(state.forms)) {
      if (state.forms.length > 0 || !hasLocalArrayData(LIVE_STATE_STORAGE_KEYS.forms)) {
        patch.forms = state.forms;
      } else {
        repairPatch.forms = readLocalArray(LIVE_STATE_STORAGE_KEYS.forms);
      }
    }
    if (Array.isArray(state.workshops)) {
      if (state.workshops.length > 0 || !hasLocalArrayData(LIVE_STATE_STORAGE_KEYS.workshops)) {
        patch.workshops = state.workshops;
      } else {
        repairPatch.workshops = readLocalArray(LIVE_STATE_STORAGE_KEYS.workshops);
      }
    }
    if (Array.isArray(state.landingPages)) {
      if (state.landingPages.length > 0 || !hasLocalArrayData(LIVE_STATE_STORAGE_KEYS.landingPages)) {
        patch.landingPages = state.landingPages;
      } else {
        repairPatch.landingPages = readLocalArray(LIVE_STATE_STORAGE_KEYS.landingPages);
      }
    }
    if (state.registrationLinks && typeof state.registrationLinks === "object") {
      if (Object.keys(state.registrationLinks).length > 0 || !hasLocalObjectData(LIVE_STATE_STORAGE_KEYS.registrationLinks)) {
        patch.registrationLinks = state.registrationLinks;
      } else {
        repairPatch.registrationLinks = readLocalObject(LIVE_STATE_STORAGE_KEYS.registrationLinks);
      }
    }
    writeLiveStateToLocalStorage(patch);
    if (Object.keys(repairPatch).length > 0) {
      void saveLiveState(repairPatch);
    }

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
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST"
    });
    return response.ok;
  } catch {
    return false;
  }
}
