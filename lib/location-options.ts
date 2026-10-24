import { Country, State } from "country-state-city";
import type { BuilderField } from "./types";

export const COUNTRY_OPTIONS = Country.getAllCountries().map(country => country.name);

export function countryCode(country: string) {
  return Country.getAllCountries().find(item => item.name === country)?.isoCode;
}

export function statesForCountry(country: string) {
  const code = countryCode(country);
  return code ? State.getStatesOfCountry(code).map(state => state.name) : [];
}

/** Keep saved field IDs so existing responses and form rules remain associated. */
export function ensureLocationFields(fields: BuilderField[]): BuilderField[] {
  const roles = ["country", "state", "city"] as const;
  const location = roles.map(role => {
    const existing = fields.find(field => field.role === role);
    return { ...existing, id: existing?.id ?? `location-${role}`, type: "dropdown" as const,
      label: existing?.label ?? role[0].toUpperCase() + role.slice(1), role,
      required: role === "country", allowOther: role !== "country",
      options: role === "country" ? [...COUNTRY_OPTIONS] : undefined };
  });
  const first = fields.findIndex(field => roles.some(role => role === field.role));
  const rest = fields.filter(field => !roles.some(role => role === field.role));
  rest.splice(first < 0 ? rest.length : first, 0, ...location);
  return rest;
}
