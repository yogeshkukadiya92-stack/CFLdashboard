type RecordValue = Record<string, unknown>;
type PublicConfig = { forms?: unknown[]; workshops?: unknown[]; registrationLinks?: Record<string, unknown> };
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const slugify = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Keep a public form response small without replacing the admin's browser cache. */
export function selectPublicRegistrationConfig(state: PublicConfig, slug: string, workshopId = "") {
  const links = Object.entries(state.registrationLinks ?? {}).filter(([key, value]) => key === slug || record(value).slug === slug);
  const ids = new Set([slug, workshopId, ...links.map(([, value]) => String(record(value).id ?? ""))].filter(Boolean));
  const workshops = (state.workshops ?? []).filter(value => ids.has(String(record(value).id)) || slugify(record(value).name) === slug);
  for (const value of workshops) ids.add(String(record(value).id));
  const forms = (state.forms ?? []).filter(value => ids.has(String(record(value).workshopId)) || record(value).workshopSlug === slug)
    .map(value => { const { referralCodes: _private, ...form } = record(value); return form; });
  return { dbEnabled: true, forms, workshops, registrationLinks: Object.fromEntries(links) };
}
