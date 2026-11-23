import type { BuilderField } from "./types.ts";

function matchesVisibilityRule(field: BuilderField, answers: Record<string, string>) {
  const rule = field.visibility;
  if (!rule?.fieldId) return true;
  const sourceValue = (answers[rule.fieldId] ?? "").trim();
  const expected = (rule.value ?? "").trim();
  if (rule.operator === "answered") return Boolean(sourceValue);
  if (rule.operator === "not_answered") return !sourceValue;
  if (rule.operator === "not_equals") return sourceValue !== expected;
  if (rule.operator === "contains") return sourceValue.toLowerCase().includes(expected.toLowerCase());
  return sourceValue === expected;
}

export function getVisibleBuilderFields(fields: BuilderField[], answers: Record<string, string>) {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const visibility = new Map<string, boolean>();

  function isVisible(field: BuilderField): boolean {
    const cached = visibility.get(field.id);
    if (cached !== undefined) return cached;

    // A field in its own dependency chain cannot be revealed.
    visibility.set(field.id, false);
    const dependency = field.visibility?.fieldId;
    const controllingField = dependency ? fieldsById.get(dependency) : undefined;
    const visible = (!dependency || (controllingField && isVisible(controllingField))) &&
      matchesVisibilityRule(field, answers);
    visibility.set(field.id, Boolean(visible));
    return Boolean(visible);
  }

  return fields.filter(isVisible);
}
