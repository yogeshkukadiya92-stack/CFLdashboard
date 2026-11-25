export type MedicalAnswers = Record<string, string | boolean | string[]>;
export type MedicalField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  dataTarget: string;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  logic?: {
    sourceKey?: string;
    operator?: string;
    action?: string;
    value?: string;
  };
};

export function visibleMedicalField(
  field: MedicalField,
  answers: MedicalAnswers
) {
  const logic = field.logic;
  if (!logic?.sourceKey) return true;
  const actual = answers[logic.sourceKey];
  const expected = logic.value ?? "";
  let match: boolean;
  switch (logic.operator) {
    case "IS_ANSWERED":
      match = actual != null && String(actual) !== "";
      break;
    case "CONTAINS":
      match = Array.isArray(actual)
        ? actual.includes(expected)
        : String(actual ?? "").includes(expected);
      break;
    case "NOT_EQUALS":
      match = String(actual ?? "") !== expected;
      break;
    case "GREATER_THAN":
      match = Number(actual) > Number(expected);
      break;
    case "LESS_THAN":
      match = Number(actual) < Number(expected);
      break;
    default:
      match = String(actual ?? "") === expected;
  }
  return logic.action === "HIDE" ? !match : match;
}

export function medicalAnswerError(
  fields: MedicalField[],
  answers: MedicalAnswers
) {
  for (const field of fields) {
    if (
      !visibleMedicalField(field, answers) ||
      ["SECTION", "PAGE_BREAK"].includes(field.type)
    )
      continue;
    const value = answers[field.key];
    if (!value || !String(value).trim()) {
      if (field.required) return "Please complete: " + field.label;
      continue;
    }
    const limits = field.validation;
    if (["NUMBER", "RATING", "SCALE", "HEALTH_METRIC"].includes(field.type)) {
      const number = Number(value);
      if (
        !Number.isFinite(number) ||
        (limits?.min != null && number < limits.min) ||
        (limits?.max != null && number > limits.max)
      )
        return "Check the value for " + field.label;
    }
    if (
      (limits?.minLength != null && String(value).length < limits.minLength) ||
      (limits?.maxLength != null && String(value).length > limits.maxLength)
    )
      return "Check the length of " + field.label;
  }
  return "";
}
