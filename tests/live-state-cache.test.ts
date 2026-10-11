import assert from "node:assert/strict";
import test from "node:test";
import { readLocalArray, saveLiveState, writeLiveStateToLocalStorage } from "../lib/live-state.ts";

test("full browser cache preserves fresh data and does not block server saves", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldFetch = globalThis.fetch;
  const cache = new Map<string, string>();
  let full = true;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: {
      getItem(key: string) { return cache.get(key) ?? null; },
      setItem(key: string, value: string) {
        if (full) throw new DOMException("Storage full", "QuotaExceededError");
        cache.set(key, value);
      }
    }
  } });
  let saved: unknown;
  globalThis.fetch = async (_url, options) => {
    saved = JSON.parse(String(options?.body));
    return Response.json({ ok: true });
  };
  try {
    const registrations = [{ id: "cache-confirmed", confirmationStatus: "confirmed" }];
    assert.equal(await saveLiveState({ registrations }), true);
    assert.deepEqual(saved, { registrations });
    assert.deepEqual(readLocalArray("cfl_registrations_v1"), registrations);
    writeLiveStateToLocalStorage({ registrations, workshops: [{ id: "workshop" }] });
    assert.deepEqual(readLocalArray("cfl_workshop_master_records_v1"), [{ id: "workshop" }]);
    full = false;
    writeLiveStateToLocalStorage({ registrations: [], workshops: [] });
    assert.deepEqual(readLocalArray("cfl_registrations_v1"), []);
    assert.equal(cache.get("cfl_registrations_v1"), "[]");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
