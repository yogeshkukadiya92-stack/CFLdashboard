import parsePhoneNumber, { getCountryCallingCode } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

/** Canonical international number; unprefixed legacy numbers default to India. */
export function internationalPhone(value: unknown, country: string = "IN"): string {
  const text = String(value ?? "").trim();
  if (!text || !/^[+\d\s().-]+$/.test(text)) return "";
  const phone = parsePhoneNumber(text, { defaultCountry: country as CountryCode, extract: false });
  if (!phone?.isPossible() || phone.ext) return "";
  if (phone.countryCallingCode === "91" && !/^[6-9]\d{9}$/.test(phone.nationalNumber)) return "";
  return phone.number;
}

/** Preserve existing Indian lookup keys while keeping foreign country codes. */
export function registrationPhoneKey(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (String(value ?? "").trim().startsWith("+") || digits.length > 10) return digits ? `+${digits}` : "";
  return digits;
}

export function phoneCallingCode(country: string): string {
  try { return getCountryCallingCode(country as CountryCode); } catch { return ""; }
}
