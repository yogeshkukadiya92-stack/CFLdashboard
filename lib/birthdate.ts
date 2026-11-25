export function isBirthdateField(field: { label: string; type?: string }) {
  return /birth|\bd\.?o\.?b\.?\b|જન્મ|जन्म/i.test(field.label);
}

export function latestBirthdate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = get("year") - 12;
  const month = get("month");
  const day = Math.min(get("day"), new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function validBirthdate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= latestBirthdate(now);
}

export function hasInvalidBirthdateAnswer(answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return false;
  return Object.entries(answers).some(([label, value]) => isBirthdateField({ label }) && String(value ?? "").trim() !== "" && !validBirthdate(String(value).trim()));
}

export function ageFromBirthdate(value: string, now = new Date()) {
  if (!validBirthdate(value, now)) return "";
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return String(Number(today.slice(0, 4)) - Number(value.slice(0, 4)) - Number(today.slice(5) < value.slice(5)));
}
