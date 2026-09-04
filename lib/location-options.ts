export const COUNTRY_OPTIONS = [
  "India",
  "United Arab Emirates",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Singapore",
  "Other"
] as const;

// Kept local so the registration page remains fast and works without a third-party API.
// The "Other" option lets a participant enter a city not included in this curated list.
const citiesByCountry: Record<string, readonly string[]> = {
  India: ["Ahmedabad", "Bengaluru", "Chandigarh", "Chennai", "Delhi", "Hyderabad", "Jaipur", "Kolkata", "Mumbai", "Pune", "Surat", "Vadodara"],
  "United Arab Emirates": ["Abu Dhabi", "Ajman", "Al Ain", "Dubai", "Ras Al Khaimah", "Sharjah"],
  "United States": ["Chicago", "Dallas", "Houston", "Los Angeles", "New York", "San Francisco"],
  "United Kingdom": ["Birmingham", "Leeds", "London", "Manchester"],
  Canada: ["Calgary", "Montreal", "Toronto", "Vancouver"],
  Australia: ["Adelaide", "Brisbane", "Melbourne", "Perth", "Sydney"],
  Singapore: ["Singapore"]
};

export function citiesForCountry(country: string) {
  return citiesByCountry[country] ?? [];
}
