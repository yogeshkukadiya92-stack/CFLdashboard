import "server-only";

export function usesSupabaseAuth() { return process.env.CALLFLOW_AUTH_PROVIDER === "supabase"; }
export type SupabaseUser = { id: string; email: string; user_metadata?: Record<string, unknown> };
type AuthResult = { user?: SupabaseUser; access_token?: string; error_code?: string; code?: string };

async function authRequest(path: string, body: object): Promise<AuthResult> {
  const base = process.env.CALLFLOW_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.CALLFLOW_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error("AUTH_UNAVAILABLE");
  const url = new URL(base);
  if (url.protocol !== "https:" && process.env.CALLFLOW_SUPABASE_INTERNAL_HTTP !== "true") throw new Error("AUTH_UNAVAILABLE");
  let response: Response;
  try {
    response = await fetch(`${base}/auth/v1/${path}`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error" });
  } catch { throw new Error("AUTH_UNAVAILABLE"); }
  const data = await response.json().catch(() => ({})) as AuthResult;
  if (!response.ok) {
    if (response.status === 429) throw new Error("AUTH_RATE_LIMITED");
    if ((data.code || data.error_code) === "email_not_confirmed") throw new Error("EMAIL_NOT_CONFIRMED");
    if (response.status >= 500) throw new Error("AUTH_UNAVAILABLE");
    throw new Error("INVALID_CREDENTIALS");
  }
  return data;
}
function checkedUser(data: AuthResult): SupabaseUser {
  const user = data.user;
  if (!user || !/^[0-9a-f-]{36}$/i.test(user.id) || !user.email) throw new Error("AUTH_UNAVAILABLE");
  return user;
}
export async function supabasePasswordLogin(email: string, password: string) {
  const data = await authRequest("token?grant_type=password", { email, password });
  if (!data.access_token) throw new Error("INVALID_CREDENTIALS");
  return checkedUser(data);
}
export async function supabaseSignup(input: { name: string; workspaceName: string; email: string; password: string }) {
  const data = await authRequest("signup", { email: input.email, password: input.password, data: { name: input.name, workspaceName: input.workspaceName } });
  // Without a session Supabase requires email confirmation; never provision from an unverified identity.
  if (!data.access_token) return { confirmationRequired: true as const };
  return { confirmationRequired: false as const, user: checkedUser(data) };
}
