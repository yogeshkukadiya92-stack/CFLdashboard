import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleBuilderFields } from "../lib/builder-field-visibility.ts";
import type { BuilderField } from "../lib/types.ts";

test("switching away from Business hides dependent fields with previously entered answers", () => {
  const fields: BuilderField[] = [
    { id: "occupation", label: "Occupation", type: "dropdown", options: ["Business", "Job"] },
    { id: "business", label: "Business type", type: "dropdown", visibility: { fieldId: "occupation", operator: "equals", value: "Business" } },
    { id: "company", label: "Company name", type: "short_text", required: true, visibility: { fieldId: "business", operator: "answered" } }
  ];
  const visibleIds = (answers: Record<string, string>) => getVisibleBuilderFields(fields, answers).map((field) => field.id);
  assert.deepEqual(visibleIds({}), ["occupation"]);
  assert.deepEqual(visibleIds({ occupation: "Business", business: "Retail" }), ["occupation", "business", "company"]);
  assert.deepEqual(visibleIds({ occupation: "Job", business: "Retail" }), ["occupation"]);
});
