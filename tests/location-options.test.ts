import assert from "node:assert/strict";
import test from "node:test";
import { COUNTRY_OPTIONS, ensureLocationFields, statesForCountry } from "../lib/location-options.ts";

test("worldwide countries and dependent states are available", () => {
  assert.ok(COUNTRY_OPTIONS.length > 200);
  assert.ok(statesForCountry("India").includes("Gujarat"));
  assert.ok(!statesForCountry("Canada").includes("Gujarat"));
  assert.deepEqual(statesForCountry("unknown"), []);
});

test("legacy forms gain ordered location dropdowns and preserve existing IDs", () => {
  const fields = ensureLocationFields([{ id: "old-city", type: "short_text", label: "City", required: false, role: "city" }]);
  assert.deepEqual(fields.map(field => field.role), ["country", "state", "city"]);
  assert.equal(fields[2].id, "old-city");
  assert.ok(fields.every(field => field.type === "dropdown"));
  assert.deepEqual(ensureLocationFields(fields), fields);
});
