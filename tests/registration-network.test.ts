import assert from "node:assert/strict";
import test from "node:test";
import { savePublicRegistration } from "../lib/live-state.ts";

test("lost registration response retries the identical payload and tolerates full browser storage", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldFetch = globalThis.fetch;
  const bodies: unknown[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay === 20_000 ? delay : 0),
    clearTimeout,
    localStorage: { setItem() { throw new Error("Storage full"); } }
  } });
  globalThis.fetch = async (_url, options) => {
    bodies.push(options?.body);
    if (bodies.length === 1) throw new TypeError("Network response lost");
    return Response.json({ ok: true, registration: { id: "retry-1" } });
  };
  try {
    const result = await savePublicRegistration({ id: "retry-1" }, []);
    assert.equal(result && result.ok, true);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
    bodies.length = 0;
    globalThis.fetch = async () => {
      bodies.push("attempt");
      return Response.json({ error: "Closed" }, { status: 403 });
    };
    const rejected = await savePublicRegistration({ id: "retry-2" }, []);
    assert.equal(rejected && rejected.ok, false);
    assert.equal(bodies.length, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
