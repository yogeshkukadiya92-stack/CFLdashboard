// Only public form configuration is shared here. Submission eligibility always
// reads current database state inside its transaction, never this display cache.
import { getDbPool } from "./db";
let cached: { value: string; until: number } | undefined;
let inFlight: Promise<string> | undefined;
export async function publicRegistrationJson() {
  if (cached && cached.until > Date.now()) return cached.value;
  inFlight ??= (async () => {
    const result = await getDbPool()!.query(`SELECT forms, landing_pages AS "landingPages", registration_links AS "registrationLinks", workshops FROM app_state WHERE id=1`);
    const state = result.rows[0];
    const forms = (Array.isArray(state?.forms) ? state.forms : []).map((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const { referralCodes: _private, ...publicForm } = value as Record<string, unknown>;
      return publicForm;
    });
    const value = JSON.stringify({ dbEnabled:true, forms, landingPages:state?.landingPages ?? [], registrationLinks:state?.registrationLinks ?? {}, workshops:state?.workshops ?? [] });
    cached = { value, until:Date.now()+1000 };
    return value;
  })().finally(() => { inFlight=undefined; });
  return inFlight;
}
