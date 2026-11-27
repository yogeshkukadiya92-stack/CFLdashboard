// Only public form configuration is shared here. Submission eligibility always
// reads current database state inside its transaction, never this display cache.
import { getDbPool } from "./db";
import { selectPublicRegistrationConfig } from "./public-registration-config";
type PublicConfig = Parameters<typeof selectPublicRegistrationConfig>[0];
let cached: { value: string; until: number } | undefined;
let inFlight: Promise<string> | undefined;
let scopedCache: { config: PublicConfig; until: number } | undefined;
let scopedInFlight: Promise<PublicConfig> | undefined;
export async function publicRegistrationJson(slug = "", workshopId = ""): Promise<string> {
  if (slug) return JSON.stringify(selectPublicRegistrationConfig(await scopedPublicConfig(), slug, workshopId));
  return fullPublicRegistrationJson();
}
async function scopedPublicConfig(): Promise<PublicConfig> {
  if (scopedCache && scopedCache.until > Date.now()) return scopedCache.config;
  scopedInFlight ??= (async () => {
    // Landing pages can contain large embedded images. Registration forms need
    // neither those pages nor serialization of every other form in the system.
    const result = await getDbPool()!.query(`SELECT forms, registration_links AS "registrationLinks", workshops FROM app_state WHERE id=1`);
    const config = result.rows[0] ?? {};
    scopedCache = { config, until: Date.now() + 1000 };
    return config;
  })().finally(() => { scopedInFlight = undefined; });
  return scopedInFlight;
}
async function fullPublicRegistrationJson(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.value;
  inFlight ??= (async () => {
    const result = await getDbPool()!.query(`SELECT forms, landing_pages AS "landingPages", registration_links AS "registrationLinks", workshops FROM app_state WHERE id=1`);
    const state = result.rows[0];
    const forms = (Array.isArray(state?.forms) ? state.forms : []).map((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const { referralCodes: _private, ...publicForm } = value as Record<string, unknown>;
      return publicForm;
    });
    const config = { dbEnabled:true, forms, landingPages:state?.landingPages ?? [], registrationLinks:state?.registrationLinks ?? {}, workshops:state?.workshops ?? [] };
    const value = JSON.stringify(config);
    cached = { value, until:Date.now()+1000 };
    return value;
  })().finally(() => { inFlight=undefined; });
  return inFlight;
}
