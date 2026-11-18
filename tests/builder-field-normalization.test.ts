import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCoreFieldRequirements } from "../lib/builder-field-normalization.ts";
import { ensureLocationFields } from "../lib/location-options.ts";
import type { BuilderField } from "../lib/types.ts";

test("required choices survive saving and reopening the registration form", () => {
  for (const required of [true, false]) {
    const fields: BuilderField[] = ["country", "state", "city", "email"].map(role => ({
      id: role, label: role, role: role as BuilderField["role"], type: "dropdown", required
    }));
    const saved = ensureLocationFields(normalizeCoreFieldRequirements(fields));
    const reopened = ensureLocationFields(normalizeCoreFieldRequirements(JSON.parse(JSON.stringify(saved))));
    for (const field of reopened) assert.equal(field.required, required, field.role);
    assert.deepEqual(reopened, saved);
  }
});

test("repairs Age fields that retained a renamed email core-field configuration", () => {
  const fields: BuilderField[] = [
    { id: "age", label: "Age", required: false, role: "email", type: "email" },
    { id: "mobile", label: "Mobile Number", required: false, role: "mobile", type: "mobile" }
  ];

  assert.deepEqual(normalizeCoreFieldRequirements(fields), [
    { id: "age", label: "Age", required: false, role: undefined, type: "number" },
    { id: "mobile", label: "Mobile Number", required: true, role: "mobile", type: "mobile" }
  ]);
});

test("repairs Age fields that were accidentally created with the mobile type", () => {
  const fields: BuilderField[] = [
    { id: "age", label: " Age ", required: true, type: "mobile" }
  ];

  assert.deepEqual(normalizeCoreFieldRequirements(fields), [
    { id: "age", label: " Age ", required: true, type: "number", role: undefined }
  ]);
});
