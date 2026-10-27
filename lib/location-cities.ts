import indiaCities from "./generated/india-cities.json" with { type: "json" };
import { countryCode } from "./location-options.ts";

type CityLists = Record<string, string[]>;
const cache = new Map<string, CityLists>([["IN", indiaCities]]);
const pending = new Map<string, Promise<CityLists>>();

export function cachedCities(country: string): CityLists | undefined {
  return cache.get(countryCode(country) ?? "");
}

/** Load once per country, before a state is chosen; repeated selections are local. */
export function loadCities(country: string): Promise<CityLists> {
  const code = countryCode(country);
  if (!code) return Promise.resolve({});
  const saved = cache.get(code);
  if (saved) return Promise.resolve(saved);
  const existing = pending.get(code);
  if (existing) return existing;
  const request = fetch(`/locations/${code}.json`)
    .then(async response => {
      if (!response.ok) throw new Error("Could not load cities. Please retry.");
      const cities = await response.json() as CityLists;
      cache.set(code, cities);
      return cities;
    }).finally(() => pending.delete(code));
  pending.set(code, request);
  return request;
}
