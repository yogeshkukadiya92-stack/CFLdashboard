import assert from "node:assert/strict";
import test from "node:test";
import { hydrateLiveState, readLocalArray, saveLiveState, writeLiveStateToLocalStorage } from "../lib/live-state.ts";

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


test("an empty server salesperson list clears stale cache without restoring deleted people", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldFetch = globalThis.fetch;
  const cache = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: {
      getItem(key: string) { return cache.get(key) ?? null; },
      setItem(key: string, value: string) { cache.set(key, value); }
    }
  } });
  let writes = 0;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "POST") writes++;
    return Response.json({ dbEnabled: true, salesPeople: [] });
  };
  try {
    writeLiveStateToLocalStorage({ salesPeople: [{ id: "deleted-person" }] });
    await hydrateLiveState();
    assert.deepEqual(readLocalArray("cfl_sales_people_v1"), []);
    assert.equal(writes, 0);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("save reports authentication, storage and network failures without accepting a login page as success", async () => {
  const { saveLiveStateResult } = await import("../lib/live-state.ts");
  const oldFetch = globalThis.fetch;
  try {
    for (const [response, expected] of [
      [Response.json({ message: "Unauthorized" }, { status: 401 }), /login session/],
      [Response.json({ message: "Forbidden" }, { status: 403 }), /permission/],
      [new Response("Too large", { status: 413 }), /too large/],
      [Response.json({ dbEnabled: false }, { status: 400 }), /storage is unavailable/],
      [new Response("<html>Sign in</html>"), /could not save/],
      [Response.json({ ok: false }, { status: 500 }), /HTTP 500/],
    ] as const) {
      globalThis.fetch = async () => response;
      const result = await saveLiveStateResult({});
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, expected);
    }
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const result = await saveLiveStateResult({});
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /connection/);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("workshop and registration form are sent together and require server acknowledgment", async () => {
  const oldFetch = globalThis.fetch;
  const calls: unknown[] = [];
  try {
    globalThis.fetch = async (_url, options) => {
      calls.push(JSON.parse(String(options?.body)));
      return Response.json({ ok: true, dbEnabled: true });
    };
    const patch = { workshops: [{ id: "workshop-atomic" }], forms: [{ id: "form-atomic", workshopId: "workshop-atomic" }] };
    assert.equal(await saveLiveState(patch), true);
    assert.deepEqual(calls, [patch]);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
