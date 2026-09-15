import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { createAuthToken, AUTH_COOKIE_NAME } from "../lib/auth.ts";
import { getLocalOAuthSettings, validateOAuthIntent, pkceChallenge, handleLocalOAuth, verifyLocalAccessToken,
  hashOAuthValue, oauthMetadata, createOAuthConsent, verifyOAuthConsent, oauthClientStamp, matchesOAuthCallback } from "../lib/mcp-oauth.ts";
import { createPostgresOAuthStore, type Authorization, type Exchange, type OAuthStore } from "../lib/mcp-oauth-store.ts";

const root = "https://cfl.example";
const verifier = "a".repeat(64);
const variables = { MCP_ENABLED: "true", MCP_OAUTH_MODE: "local", MCP_RESOURCE_URL: `${root}/api/mcp`, DATABASE_URL: "postgres://unused",
  ADMIN_EMAIL: "synthetic@example.com", ADMIN_PASSWORD: "synthetic-test-password", AUTH_SECRET: "synthetic-secret-that-is-at-least-32-characters",
  MCP_OAUTH_CLIENTS: JSON.stringify([{ id: "chatgpt_test", name: "Test ChatGPT", redirectUris: ["https://chatgpt.example/callback"] }]) };

async function configured(run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(variables).map(key => [key, process.env[key]]));
  Object.assign(process.env, variables);
  try { await run(); }
  finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}

class MemoryStore implements OAuthStore {
  grants = new Map<string, Authorization & { revoked: boolean }>();
  codes = new Map<string, { grantId: string; used: boolean }>();
  tokens = new Map<string, { grantId: string; kind: string; used: boolean }>();
  async authorize(value: Authorization) {
    if ([...this.grants.values()].some(g => g.consentId === value.consentId)) throw new Error("Consent replay");
    this.grants.set(value.grantId, { ...value, revoked: false });
    this.codes.set(value.codeHash, { grantId: value.grantId, used: false });
  }
  async exchange(value: Exchange) {
    const token = value.kind === "code" ? this.codes.get(value.hash) : this.tokens.get(value.hash);
    const grant = this.grants.get(token?.grantId ?? "");
    if (!token || !grant || grant.revoked || grant.clientId !== value.clientId || grant.clientStamp !== value.clientStamp || grant.adminStamp !== value.adminStamp || grant.resource !== value.resource) return false;
    if (value.kind === "code" && (grant.challenge !== value.challenge || grant.redirectUri !== value.redirectUri)) return false;
    if (value.kind === "refresh" && (!("kind" in token) || token.kind !== "refresh")) return false;
    if (token.used) { grant.revoked = true; return false; }
    token.used = true;
    this.tokens.set(value.accessHash, { grantId: grant.grantId, kind: "access", used: false });
    this.tokens.set(value.refreshHash, { grantId: grant.grantId, kind: "refresh", used: false });
    return true;
  }
  async access(hash: string, resource: string, stamp: string) {
    const token = this.tokens.get(hash), grant = this.grants.get(token?.grantId ?? "");
    return token?.kind === "access" && grant && !grant.revoked && grant.resource === resource && grant.adminStamp === stamp ? { clientId: grant.clientId, clientStamp: grant.clientStamp } : null;
  }
  async revokeToken(hash: string, clientId: string) {
    const grant = this.grants.get(this.tokens.get(hash)?.grantId ?? "");
    if (grant?.clientId === clientId) grant.revoked = true;
  }
  async connections(stamp: string) { return [...this.grants.values()].filter(g => !g.revoked && g.adminStamp === stamp).map(g => ({ id: g.grantId, client_id: g.clientId, expires_at: "synthetic expiry" })); }
  async revokeGrant(id: string, stamp: string) { const grant = this.grants.get(id); if (grant?.adminStamp === stamp) grant.revoked = true; }
}

function intentParams() { return new URLSearchParams({ client_id: "chatgpt_test", redirect_uri: "https://chatgpt.example/callback", response_type: "code",
  resource: `${root}/api/mcp`, scope: "cfl:read", state: "synthetic-state-with-entropy", code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" }); }
function post(action: string, params: URLSearchParams, cookie?: string, origin = root) { return new Request(`${root}/api/mcp-oauth/${action}`, { method: "POST", body: params,
  headers: { origin, ...(cookie ? { cookie: `${AUTH_COOKIE_NAME}=${cookie}` } : {}) } }); }
async function approved(store: MemoryStore, session: string) {
  const page = await handleLocalOAuth(new Request(`${root}/api/mcp-oauth/authorize?${intentParams()}`, { headers: { cookie: `${AUTH_COOKIE_NAME}=${session}` } }), "authorize", store);
  assert.equal(page.status, 200);
  const text = await page.text();
  assert.ok(text.includes("cannot read personal"));
  const ticket = /name="ticket" value="([^"]+)"/.exec(text)![1];
  const reply = await handleLocalOAuth(post("authorize", new URLSearchParams({ ticket, decision: "approve" }), session), "authorize", store);
  assert.equal(reply.status, 303);
  const url = new URL(reply.headers.get("location")!);
  assert.equal(url.searchParams.get("iss"), root);
  assert.equal(url.searchParams.get("state"), intentParams().get("state"));
  return { code: url.searchParams.get("code")!, ticket };
}
function codeParams(code: string) { return new URLSearchParams({ client_id: "chatgpt_test", grant_type: "authorization_code", code,
  redirect_uri: "https://chatgpt.example/callback", resource: `${root}/api/mcp`, code_verifier: verifier }); }

test("built-in OAuth metadata advertises predefined clients and PKCE without external service", () => configured(async () => {
  const metadata = oauthMetadata();
  assert.equal(metadata.issuer, root);
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  assert.equal(metadata.authorization_response_iss_parameter_supported, true);
  assert.ok(!("registration_endpoint" in metadata));
  delete process.env.ADMIN_PASSWORD;
  assert.throws(getLocalOAuthSettings, /Explicit admin/);
}));

test("untrusted callbacks, clients, resources, scopes, duplicate parameters and weak PKCE are rejected", () => configured(async () => {
  for (const [key, value] of [["redirect_uri", "https://evil.example"], ["client_id", "attacker"], ["resource", "https://other.example"], ["scope", "cfl:write"], ["code_challenge_method", "plain"]]) {
    const params = intentParams(); params.set(key, value); assert.throws(() => validateOAuthIntent(params));
  }
  const params = intentParams(); params.append("redirect_uri", "https://evil.example"); assert.throws(() => validateOAuthIntent(params));
}));

test("native-client callback permits only a registered loopback host/path with variable port", () => configured(async () => {
  const registered = "http://127.0.0.1/callback";
  assert.ok(matchesOAuthCallback(registered, "http://127.0.0.1:54321/callback"));
  for (const uri of ["http://localhost:54321/callback", "http://127.0.0.1.evil.example/callback", "http://127.0.0.1:54321/other", "http://127.0.0.1:54321/callback?evil=1", "http://127.0.0.1:54321/callback#fragment", "https://127.0.0.1/callback"]) {
    assert.equal(matchesOAuthCallback(registered, uri), false);
  }
  assert.equal(matchesOAuthCallback("http://127.0.0.1:1234/callback", "http://127.0.0.1:54321/callback"), false);
  process.env.MCP_OAUTH_CLIENTS = JSON.stringify([{ id: "desktop_test", name: "Desktop", redirectUris: [registered] }]);
  const params = intentParams(); params.set("client_id", "desktop_test"); params.set("redirect_uri", "http://127.0.0.1:54321/callback");
  assert.equal(validateOAuthIntent(params).redirect_uri, "http://127.0.0.1:54321/callback");
}));

test("consent requires admin login and a session-bound signed ticket; cancel grants nothing", () => configured(async () => {
  const store = new MemoryStore(), session = await createAuthToken(process.env.ADMIN_EMAIL!);
  const noLogin = await handleLocalOAuth(new Request(`${root}/api/mcp-oauth/authorize?${intentParams()}`), "authorize", store);
  assert.equal(noLogin.status, 303); assert.ok(noLogin.headers.get("location")!.startsWith(`${root}/login?next=`));
  const intent = validateOAuthIntent(intentParams()), ticket = await createOAuthConsent(intent, session);
  await assert.rejects(() => verifyOAuthConsent(ticket, "different-session"));
  const forged = await handleLocalOAuth(post("authorize", new URLSearchParams({ ticket: ticket + "x", decision: "approve" }), session), "authorize", store);
  assert.ok(forged.status >= 400);
  const crossOrigin = await handleLocalOAuth(post("authorize", new URLSearchParams({ ticket, decision: "approve" }), session, "https://evil.example"), "authorize", store);
  assert.equal(crossOrigin.status, 403);
  const cancel = await handleLocalOAuth(post("authorize", new URLSearchParams({ ticket, decision: "deny" }), session), "authorize", store);
  assert.equal(new URL(cancel.headers.get("location")!).searchParams.get("error"), "access_denied");
  assert.equal(store.grants.size, 0);
}));

test("authorization-code flow binds PKCE, emits only opaque tokens, and prevents approval replay", () => configured(async () => {
  const store = new MemoryStore(), session = await createAuthToken(process.env.ADMIN_EMAIL!);
  const { code, ticket } = await approved(store, session);
  const wrongProof = codeParams(code); wrongProof.set("code_verifier", "b".repeat(64));
  assert.equal((await handleLocalOAuth(post("token", wrongProof), "token", store)).status, 400);
  const result = await handleLocalOAuth(post("token", codeParams(code)), "token", store);
  assert.equal(result.status, 200);
  const tokens = await result.json();
  assert.equal(tokens.scope, "cfl:read"); assert.match(tokens.access_token, /^cfl_access_/);
  assert.equal(await verifyLocalAccessToken(tokens.access_token, store), "cfl-admin");
  assert.ok(!JSON.stringify([...store.tokens.keys()]).includes(tokens.access_token));
  const replay = await handleLocalOAuth(post("authorize", new URLSearchParams({ ticket, decision: "approve" }), session), "authorize", store);
  assert.ok(replay.status >= 400); assert.equal(store.grants.size, 1);
  const consumed = await handleLocalOAuth(post("token", codeParams(code)), "token", store);
  assert.equal(consumed.status, 400);
  await assert.rejects(() => verifyLocalAccessToken(tokens.access_token, store));
}));

test("refresh rotation and replay revoke a whole connection", () => configured(async () => {
  const store = new MemoryStore(), session = await createAuthToken(process.env.ADMIN_EMAIL!);
  const { code } = await approved(store, session);
  const tokens = await (await handleLocalOAuth(post("token", codeParams(code)), "token", store)).json();
  const params = new URLSearchParams({ client_id: "chatgpt_test", grant_type: "refresh_token", resource: `${root}/api/mcp`, refresh_token: tokens.refresh_token });
  const freshResponse = await handleLocalOAuth(post("token", params), "token", store);
  assert.equal(freshResponse.status, 200); const fresh = await freshResponse.json();
  assert.notEqual(fresh.refresh_token, tokens.refresh_token);
  assert.equal(await verifyLocalAccessToken(fresh.access_token, store), "cfl-admin");
  assert.equal((await handleLocalOAuth(post("token", params), "token", store)).status, 400);
  await assert.rejects(() => verifyLocalAccessToken(fresh.access_token, store));
}));

test("removing a client, changing admin credentials and explicit revocation deny access", () => configured(async () => {
  const store = new MemoryStore(), session = await createAuthToken(process.env.ADMIN_EMAIL!);
  const { code } = await approved(store, session);
  const tokens = await (await handleLocalOAuth(post("token", codeParams(code)), "token", store)).json();
  process.env.ADMIN_PASSWORD = "changed-password";
  await assert.rejects(() => verifyLocalAccessToken(tokens.access_token, store));
  process.env.ADMIN_PASSWORD = variables.ADMIN_PASSWORD;
  process.env.MCP_OAUTH_CLIENTS = JSON.stringify([{ id: "another_client", name: "Another", redirectUris: ["https://another.example/callback"] }]);
  await assert.rejects(() => verifyLocalAccessToken(tokens.access_token, store));
  process.env.MCP_OAUTH_CLIENTS = variables.MCP_OAUTH_CLIENTS;
  const revoke = await handleLocalOAuth(post("revoke", new URLSearchParams({ client_id: "chatgpt_test", token: tokens.refresh_token })), "revoke", store);
  assert.equal(revoke.status, 200);
  await assert.rejects(() => verifyLocalAccessToken(tokens.access_token, store));
}));

test("admin connections screen supports session-bound revocation and refuses untrusted requests", () => configured(async () => {
  const store = new MemoryStore(), session = await createAuthToken(process.env.ADMIN_EMAIL!);
  await approved(store, session);
  const page = await handleLocalOAuth(new Request(`${root}/api/mcp-oauth/connections`, { headers: { cookie: `${AUTH_COOKIE_NAME}=${session}` } }), "connections", store);
  const text = await page.text(); const ticket = /name="ticket" value="([^"]+)"/.exec(text)![1];
  const params = new URLSearchParams({ ticket, grant_id: [...store.grants.keys()][0] });
  assert.equal((await handleLocalOAuth(post("connections", params), "connections", store)).status, 401);
  assert.equal((await handleLocalOAuth(post("connections", params, session), "connections", store)).status, 303);
  assert.ok([...store.grants.values()][0].revoked);
}));

test("confidential clients require the correct secret; wrong resource and unsupported grants fail", () => configured(async () => {
  process.env.MCP_OAUTH_CLIENTS = JSON.stringify([{ id: "chatgpt_test", name: "Confidential", redirectUris: ["https://chatgpt.example/callback"], secret: "s".repeat(40) }]);
  const store = new MemoryStore();
  const params = codeParams(`cfl_code_${"a".repeat(43)}`);
  assert.equal((await handleLocalOAuth(post("token", params), "token", store)).status, 401);
  params.set("client_secret", "s".repeat(40)); params.set("resource", "https://wrong.example");
  assert.equal((await (await handleLocalOAuth(post("token", params), "token", store)).json()).error, "invalid_target");
  params.set("resource", `${root}/api/mcp`); params.set("grant_type", "password");
  assert.equal((await (await handleLocalOAuth(post("token", params), "token", store)).json()).error, "unsupported_grant_type");
}));

test("PostgreSQL exchange locks rows, rejects expired/revoked grants, and commits replay revocation", async () => {
  const value: Exchange = { kind: "code", hash: "hashed-code", clientId: "test", clientStamp: "stamp", adminStamp: "admin", resource: `${root}/api/mcp`,
    redirectUri: "https://chatgpt.example/callback", challenge: "proof", accessHash: "hashed-access", refreshHash: "hashed-refresh" };
  const base = { grant_id: randomUUID(), client_id: "test", client_stamp: "stamp", admin_stamp: "admin", resource: value.resource,
    redirect_uri: value.redirectUri, challenge: "proof", live: true, consumed_at: null, revoked_at: null, grant_expiry: new Date(Date.now() + 10000) };
  for (const [override, expected] of [[{}, true], [{ live: false }, false], [{ revoked_at: new Date() }, false], [{ client_id: "wrong" }, false], [{ consumed_at: new Date() }, false]] as const) {
    const calls: string[] = []; let released = false;
    const client = { query: async (sql: string) => { calls.push(sql); return { rows: sql.startsWith("SELECT") ? [{ ...base, ...override }] : [] }; }, release: () => { released = true; } };
    const store = createPostgresOAuthStore(() => ({ connect: async () => client as unknown as PoolClient } as unknown as Pick<Pool, "query" | "connect">));
    assert.equal(await store.exchange(value), expected);
    assert.ok(calls.some(sql => sql.includes("FOR UPDATE OF item, g")));
    assert.equal(calls.at(-1), "COMMIT"); assert.ok(released);
    if ("consumed_at" in override) assert.ok(calls.some(sql => sql.includes("SET revoked_at")));
    if (expected) assert.ok(calls.some(sql => sql.startsWith("INSERT INTO cfl_oauth.tokens")));
  }
});
