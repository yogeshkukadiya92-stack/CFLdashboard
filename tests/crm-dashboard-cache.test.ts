import test from "node:test";
import assert from "node:assert/strict";
import { clearCrmDashboard, loadCrmDashboard, readCrmDashboard, cacheCrmDashboard } from "../lib/crm-dashboard-cache.ts";

test("CRM revisits share one request, reuse data and isolate login sessions", async () => {
  const oldFetch = globalThis.fetch;
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map<string, string>();
  const doc = { cookie: "cfl_crm_cache_session=user-a" };
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ dbEnabled: true, leads: [{ id: `lead-${calls}` }] }); };
  try {
    clearCrmDashboard();
    const [first, concurrent] = await Promise.all([loadCrmDashboard(), loadCrmDashboard()]);
    assert.deepEqual(first, concurrent);
    await loadCrmDashboard();
    assert.equal(calls, 1);
    cacheCrmDashboard({ dbEnabled: true, leads: [{ id: "updated" }] });
    assert.deepEqual((await loadCrmDashboard()).leads, [{ id: "updated" }]);
    doc.cookie = "cfl_crm_cache_session=user-b";
    assert.equal(readCrmDashboard(), null);
    await loadCrmDashboard();
    assert.equal(calls, 2);
    clearCrmDashboard();
    await loadCrmDashboard();
    assert.equal(calls, 3);
    doc.cookie = "";
    assert.equal(readCrmDashboard(), null);
  } finally {
    clearCrmDashboard(); globalThis.fetch = oldFetch;
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
    if (oldStorage) Object.defineProperty(globalThis, "sessionStorage", oldStorage); else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
