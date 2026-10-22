import assert from "node:assert/strict";
import test from "node:test";
import { fetchLeadManagementState } from "../lib/live-state.ts";

test("lead loading requests only the CRM scope and never writes browser state back", async () => {
  const previous = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options?.method, undefined);
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    return Response.json({ dbEnabled: true, leads: [{ id: "lead-1" }], salesPeople: [] });
  };
  try {
    const state = await fetchLeadManagementState();
    assert.deepEqual(state.leads, [{ id: "lead-1" }]);
    assert.deepEqual(calls, ["/api/state?scope=lead-management"]);
  } finally { globalThis.fetch = previous; }
});

test("failed or unavailable lead reads cannot masquerade as an empty list", async () => {
  const previous = globalThis.fetch;
  try {
    for (const response of [
      Response.json({ error: "Unauthorized" }, { status: 401 }),
      Response.json({ dbEnabled: false }),
      Response.json({ dbEnabled: true, error: "Database failed" }),
      Response.json({ dbEnabled: true })
    ]) {
      globalThis.fetch = async () => response;
      await assert.rejects(fetchLeadManagementState());
    }
    globalThis.fetch = async () => Response.json({ dbEnabled: true, leads: [] });
    assert.deepEqual((await fetchLeadManagementState()).leads, []);
  } finally { globalThis.fetch = previous; }
});

test("lead loading forwards cancellation so navigation can stop an in-flight request", async () => {
  const previous = globalThis.fetch;
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, options) => {
    assert.equal(options?.signal, controller.signal);
    options?.signal?.throwIfAborted();
    return Response.json({});
  };
  try { await assert.rejects(fetchLeadManagementState(controller.signal)); }
  finally { globalThis.fetch = previous; }
});
