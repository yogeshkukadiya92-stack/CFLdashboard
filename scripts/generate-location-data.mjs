// Refresh the compact registration data after updating country-state-city.
import { Country, State, City } from "country-state-city";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("lib/generated", { recursive: true });
mkdirSync("public/locations", { recursive: true });
const countries = Country.getAllCountries().map(({ name, isoCode, phonecode }) => ({ name, isoCode, phonecode }));
const cityGroups = new Map();
for (const city of City.getAllCities()) {
  const key = `${city.countryCode}:${city.stateCode}`;
  if (!cityGroups.has(key)) cityGroups.set(key, new Set());
  cityGroups.get(key).add(city.name);
}
const states = {};
for (const country of countries) {
  const list = State.getStatesOfCountry(country.isoCode);
  states[country.name] = list.map(state => state.name);
  const cities = Object.fromEntries(list.map(state => [state.name, [...(cityGroups.get(`${country.isoCode}:${state.isoCode}`) ?? [])].sort()]));
  const file = country.isoCode === "IN" ? "lib/generated/india-cities.json" : `public/locations/${country.isoCode}.json`;
  writeFileSync(file, JSON.stringify(cities));
}
writeFileSync("lib/generated/countries.json", JSON.stringify(countries));
writeFileSync("lib/generated/states.json", JSON.stringify(states));
