import { NextRequest, NextResponse } from "next/server";
import { City, Country, State } from "country-state-city";

export function GET(request: NextRequest) {
  const country = Country.getAllCountries().find(item => item.name === request.nextUrl.searchParams.get("country"));
  if (!country) return NextResponse.json([]);
  const state = State.getStatesOfCountry(country.isoCode).find(item => item.name === request.nextUrl.searchParams.get("state"));
  const cities = state ? City.getCitiesOfState(country.isoCode, state.isoCode) : [];
  return NextResponse.json([...new Set(cities.map(city => city.name))].sort(), { headers: { "Cache-Control": "public, max-age=86400" } });
}
