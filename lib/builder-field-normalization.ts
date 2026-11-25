import type { BuilderField } from "./types";

export function isAgeField(field: { label: string }) {
  return /^(?:age(?:\s*\(?(?:in )?years\)?)?|ઉંમર|उम्र)$/i.test(field.label.trim());
}

export function normalizeAgeField(field: BuilderField): BuilderField {
  if (!isAgeField(field)) return field;
  return { ...field, type: "number", role: undefined, options: undefined, allowOther: false };
}

/** Repairs legacy forms where a renamed core contact field kept its old type/role. */
export function normalizeCoreFieldRequirements(fields: BuilderField[]) {
  return fields.map((field) => {
    if (isAgeField(field)) return normalizeAgeField(field);
    if (field.role === "name" || field.role === "mobile") return { ...field, required: true };
    return field;
  });
}
