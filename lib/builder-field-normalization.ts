import type { BuilderField } from "./types";

function normalizedLabel(field: BuilderField) {
  return field.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Repairs legacy forms where a renamed core contact field kept its old type/role. */
export function normalizeCoreFieldRequirements(fields: BuilderField[]) {
  return fields.map((field) => {
    if (normalizedLabel(field) === "age" && (field.type === "email" || field.type === "mobile")) {
      return { ...field, type: "number" as const, role: undefined };
    }
    if (field.role === "name" || field.role === "mobile") return { ...field, required: true };
    if (field.role === "email" || field.role === "city") return { ...field, required: false };
    return field;
  });
}
