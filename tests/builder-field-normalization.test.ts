import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCoreFieldRequirements } from "../lib/builder-field-normalization.ts";
import type { BuilderField } from "../lib/types.ts";

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
