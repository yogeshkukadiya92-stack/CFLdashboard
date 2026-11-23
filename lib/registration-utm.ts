export const registrationUtmFields = [
  ["utm_source", "UTM Source"],
  ["utm_medium", "UTM Medium"],
  ["utm_campaign", "UTM Campaign"],
  ["utm_content", "UTM Content"],
  ["utm_term", "UTM Term"]
] as const;

export function registrationUtmValue(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export function registrationUtmDetails(answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return [];
  const values = answers as Record<string, unknown>;
  return registrationUtmFields.flatMap(([, label]) => {
    const value = registrationUtmValue(values[label]);
    return value ? [`${label}: ${value}`] : [];
  });
}

export function leadUtmDetails(sourceDetails: string[] = []) {
  return sourceDetails.filter((detail) =>
    registrationUtmFields.some(([, label]) => detail.startsWith(`${label}: `))
  );
}
