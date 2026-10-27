import assert from "node:assert/strict";
import test from "node:test";
import { cachedCities, loadCities } from "../lib/location-cities.ts";
import { statesForCountry } from "../lib/location-options.ts";

test("India states and cities are available immediately without a network request", () => {
  assert.ok(statesForCountry("India").includes("Gujarat"));
  assert.ok(cachedCities("India")?.Gujarat.includes("Surat"));
  assert.ok(cachedCities("India")?.Maharashtra.includes("Mumbai"));
});

test("country city loading shares in-flight requests, caches results, and retries failures", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ Dubai: ["Dubai"] }); };
  try {
    const first = loadCities("United Arab Emirates");
    assert.equal(first, loadCities("United Arab Emirates"));
    assert.deepEqual(await first, { Dubai: ["Dubai"] });
    await loadCities("United Arab Emirates");
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response("failure", { status: 503 });
    await assert.rejects(loadCities("United Kingdom"));
    assert.equal(cachedCities("United Kingdom"), undefined);
    globalThis.fetch = async () => Response.json({ England: ["London"] });
    assert.deepEqual(await loadCities("United Kingdom"), { England: ["London"] });
  } finally { globalThis.fetch = originalFetch; }
});
