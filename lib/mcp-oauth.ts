import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod/v4";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "./auth.ts";
import { getMcpConfig, MCP_SCOPE } from "./mcp-security.ts";
import { postgresOAuthStore, type OAuthStore } from "./mcp-oauth-store.ts";

const clientSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{3,80}$/),
  name: z.string().trim().min(1).max(100),
  redirectUris: z.array(z.string().url()).min(1).max(5),
  secret: z.string().min(32).max(256).optional()
}).strict();
export type OAuthClient = z.infer<typeof clientSchema>;
export type OAuthIntent = { client_id: string; redirect_uri: string; response_type: "code"; resource: string; scope: string; state: string; code_challenge: string; code_challenge_method: "S256" };

export function hashOAuthValue(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function pkceChallenge(verifier: string) { return createHash("sha256").update(verifier).digest("base64url"); }
function loopbackCallback(uri: string) { return /^http:\/\/127\.0\.0\.1(?::[0-9]+)?\//.test(uri); }
// RFC 8252 permits an ephemeral port for an explicitly registered native client.
export function matchesOAuthCallback(registered: string, actual: string) {
  if (registered === actual) return true;
  if (!loopbackCallback(registered) || !loopbackCallback(actual)) return false;
  try {
    const a = new URL(registered), b = new URL(actual);
    return !a.port && a.protocol === b.protocol && a.hostname === b.hostname && a.pathname === b.pathname && a.search === b.search
      && !b.username && !b.password && !b.hash;
  } catch { return false; }
}
function opaque(kind: string) { return `cfl_${kind}_${randomBytes(32).toString("base64url")}`; }
function equal(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}
export function getLocalOAuthSettings() {
  const config = getMcpConfig();
  if (config.mode !== "local") throw new Error("Built-in OAuth is disabled");
  // Unlike ordinary local dashboard development, OAuth never permits fallback credentials.
  if (!process.env.ADMIN_EMAIL?.trim() || !process.env.ADMIN_PASSWORD?.trim() || (process.env.AUTH_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("Explicit admin credentials and a strong AUTH_SECRET are required");
  }
  if (!process.env.DATABASE_URL) throw new Error("OAuth persistence is required");
  const clients = z.array(clientSchema).min(1).max(10).parse(JSON.parse(process.env.MCP_OAUTH_CLIENTS ?? "[]"));
  if (new Set(clients.map(c => c.id)).size !== clients.length) throw new Error("Duplicate OAuth client IDs");
  for (const client of clients) for (const uri of client.redirectUris) {
    const url = new URL(uri);
    if ((url.protocol !== "https:" && !loopbackCallback(uri)) || url.username || url.password || url.hash) throw new Error("OAuth callbacks require HTTPS or an explicitly registered 127.0.0.1 native-client callback");
  }
  const key = createHmac("sha256", process.env.AUTH_SECRET!.trim()).update("cfl-mcp-oauth-consent-v1").digest();
  const adminStamp = createHmac("sha256", key).update(JSON.stringify([process.env.ADMIN_EMAIL.trim(), process.env.ADMIN_PASSWORD])).digest("hex");
  return { ...config, clients, key, adminStamp };
}
export function oauthClientStamp(client: OAuthClient) { return hashOAuthValue(JSON.stringify(client)); }

function uniqueParams(params: URLSearchParams) {
  for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new Error("Duplicate parameter");
}
export function validateOAuthIntent(params: URLSearchParams, settings = getLocalOAuthSettings()): OAuthIntent {
  uniqueParams(params);
  const intent = z.object({
    client_id: z.string(), redirect_uri: z.string(), response_type: z.literal("code"),
    resource: z.literal(settings.resource), scope: z.literal(MCP_SCOPE).default(MCP_SCOPE),
    state: z.string().min(16).max(512), code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code_challenge_method: z.literal("S256")
  }).parse(Object.fromEntries(params));
  const client = settings.clients.find(c => c.id === intent.client_id);
  if (!client || !client.redirectUris.some(uri => matchesOAuthCallback(uri, intent.redirect_uri))) throw new Error("Unregistered client or callback");
  return intent;
}

export async function createOAuthConsent(intent: OAuthIntent | { action: "connections" }, session: string, settings = getLocalOAuthSettings()) {
  return new SignJWT({ intent, session_hash: hashOAuthValue(session), admin_stamp: settings.adminStamp })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer(settings.issuer).setAudience("cfl-oauth-consent")
    .setJti(randomUUID()).setIssuedAt().setExpirationTime("5m").sign(settings.key);
}
export async function verifyOAuthConsent(ticket: string, session: string, settings = getLocalOAuthSettings()) {
  const { payload } = await jwtVerify(ticket, settings.key, { algorithms: ["HS256"], issuer: settings.issuer, audience: "cfl-oauth-consent", requiredClaims: ["exp", "iat", "jti"] });
  if (payload.session_hash !== hashOAuthValue(session) || payload.admin_stamp !== settings.adminStamp || typeof payload.jti !== "string") throw new Error("Invalid consent session");
  return payload;
}

export function oauthMetadata(settings = getLocalOAuthSettings()) {
  return { issuer: settings.issuer, authorization_endpoint: `${settings.origin}/api/mcp-oauth/authorize`,
    token_endpoint: `${settings.origin}/api/mcp-oauth/token`, revocation_endpoint: `${settings.origin}/api/mcp-oauth/revoke`,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"], scopes_supported: [MCP_SCOPE],
    authorization_response_iss_parameter_supported: true,
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"] };
}

export async function verifyLocalAccessToken(token: string, store: OAuthStore = postgresOAuthStore) {
  const settings = getLocalOAuthSettings();
  if (!/^cfl_access_[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid access token");
  const grant = await store.access(hashOAuthValue(token), settings.resource, settings.adminStamp);
  const client = settings.clients.find(c => c.id === grant?.clientId);
  if (!grant || !client || grant.clientStamp !== oauthClientStamp(client)) throw new Error("Token expired or access revoked");
  return "cfl-admin";
}

export function authenticateOAuthClient(request: Request, params: URLSearchParams, clients: OAuthClient[]) {
  uniqueParams(params);
  let id = params.get("client_id") ?? "";
  let secret = params.get("client_secret") ?? "";
  const authorization = request.headers.get("authorization");
  if (authorization) {
    if (id || secret || !/^Basic [A-Za-z0-9+/]+=*$/.test(authorization)) throw new Error("Invalid client authentication");
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const index = decoded.indexOf(":");
    if (index < 0) throw new Error("Invalid client authentication");
    id = decodeURIComponent(decoded.slice(0, index).replace(/\+/g, " "));
    secret = decodeURIComponent(decoded.slice(index + 1).replace(/\+/g, " "));
  }
  const client = clients.find(c => c.id === id);
  if (!client || (client.secret ? !equal(secret, client.secret) : Boolean(secret || authorization))) throw new Error("Invalid client authentication");
  return client;
}

export async function exchangeOAuthTokens(request: Request, params: URLSearchParams, store: OAuthStore = postgresOAuthStore) {
  const settings = getLocalOAuthSettings();
  const client = authenticateOAuthClient(request, params, settings.clients);
  if (params.get("resource") !== settings.resource) throw new Error("invalid_target");
  if (params.has("scope") && params.get("scope") !== MCP_SCOPE) throw new Error("invalid_scope");
  const grantType = params.get("grant_type");
  if (grantType !== "authorization_code" && grantType !== "refresh_token") throw new Error("unsupported_grant_type");
  const code = params.get(grantType === "authorization_code" ? "code" : "refresh_token") ?? "";
  if (!(grantType === "authorization_code" ? /^cfl_code_[A-Za-z0-9_-]{43}$/ : /^cfl_refresh_[A-Za-z0-9_-]{43}$/).test(code)) throw new Error("invalid_grant");
  const verifier = params.get("code_verifier") ?? "";
  if (grantType === "authorization_code" && (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !client.redirectUris.some(uri => matchesOAuthCallback(uri, params.get("redirect_uri") ?? "")))) throw new Error("invalid_grant");
  const access = opaque("access"), refresh = opaque("refresh");
  const ok = await store.exchange({ kind: grantType === "authorization_code" ? "code" : "refresh", hash: hashOAuthValue(code),
    clientId: client.id, clientStamp: oauthClientStamp(client), adminStamp: settings.adminStamp, resource: settings.resource,
    redirectUri: params.get("redirect_uri") ?? undefined, challenge: grantType === "authorization_code" ? pkceChallenge(verifier) : undefined,
    accessHash: hashOAuthValue(access), refreshHash: hashOAuthValue(refresh) });
  if (!ok) throw new Error("invalid_grant");
  console.info(JSON.stringify({ event: "oauth_tokens_issued", client: client.id, flow: grantType }));
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: 900, scope: MCP_SCOPE };
}

function escape(value: unknown) { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!); }
function response(body: string, status = 200, html = false, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "Content-Type": html ? "text/html; charset=utf-8" : "application/json", "Cache-Control": "no-store",
    "Pragma": "no-cache", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", ...headers } });
}
function html(body: string) {
  return response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CFL app connection</title><style>body{font:18px/1.6 system-ui;background:#f1f5f9;color:#0f172a;padding:24px}main{max-width:640px;margin:48px auto;padding:32px;background:white;border-radius:16px}button{padding:12px 20px;margin:8px 8px 8px 0;border-radius:8px;border:1px solid #cbd5e1;cursor:pointer}button[value=approve]{background:#0f172a;color:white}code{overflow-wrap:anywhere}a{color:#0369a1}</style></head><body><main>${body}</main></body></html>`, 200, true);
}
function callback(intent: OAuthIntent, values: Record<string, string>, issuer: string) {
  const url = new URL(intent.redirect_uri);
  for (const [key, value] of Object.entries({ ...values, state: intent.state, iss: issuer })) url.searchParams.set(key, value);
  return response("", 303, false, { Location: url.href });
}
async function formBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") throw new Error("invalid_request");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_request");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new Error("invalid_request"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  uniqueParams(params); return params;
}
export async function readOAuthAdminSession(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${AUTH_COOKIE_NAME}=`));
  const session = cookie?.slice(AUTH_COOKIE_NAME.length + 1);
  if (!session || session.split(".").length !== 2 || !(await verifyAuthToken(session))) return null;
  return session;
}

export async function handleLocalOAuth(request: Request, action: string, store: OAuthStore = postgresOAuthStore,
  readSession: typeof readOAuthAdminSession = readOAuthAdminSession) {
  let settings: ReturnType<typeof getLocalOAuthSettings>;
  try { settings = getLocalOAuthSettings(); }
  catch { return response(JSON.stringify({ error: "temporarily_unavailable" }), 503); }
  if ((request.headers.get("host") ?? new URL(request.url).host) !== new URL(settings.resource).host) return response('{"error":"invalid_request"}', 400);
  try {
    if (request.method === "POST" && (action === "token" || action === "revoke")) {
      const params = await formBody(request);
      let client: OAuthClient;
      try { client = authenticateOAuthClient(request, params, settings.clients); }
      catch { return response('{"error":"invalid_client"}', 401, false, { "WWW-Authenticate": "Basic realm=\"CFL OAuth\"" }); }
      if (action === "revoke") {
        const token = params.get("token") ?? "";
        if (token.length > 200) throw new Error("invalid_request");
        await store.revokeToken(hashOAuthValue(token), client.id);
        console.info(JSON.stringify({ event: "oauth_connection_revoked", client: client.id }));
        return response("{}");
      }
      return response(JSON.stringify(await exchangeOAuthTokens(request, params, store)));
    }
    if (action !== "authorize" && action !== "connections") return response('{"error":"not_found"}', 404);
    if (request.method !== "GET" && request.method !== "POST") return response('{"error":"invalid_request"}', 405);
    const intent = action === "authorize" && request.method === "GET" ? validateOAuthIntent(new URL(request.url).searchParams, settings) : null;
    const session = await readSession(request);
    if (!session) {
      if (request.method === "POST") return response('{"error":"login_required"}', 401);
      const next = new URL(request.url).pathname + new URL(request.url).search;
      return response("", 303, false, { Location: `${settings.origin}/login?next=${encodeURIComponent(next)}` });
    }
    if (request.method === "POST") {
      // Explicitly require a same-origin browser POST, plus a session-bound signed ticket.
      if (request.headers.get("origin") !== settings.origin) return response('{"error":"invalid_request"}', 403);
      const params = await formBody(request);
      const consent = await verifyOAuthConsent(params.get("ticket") ?? "", session, settings);
      if (action === "connections") {
        if ((consent.intent as { action?: string })?.action !== "connections") throw new Error("invalid_request");
        const id = z.string().uuid().parse(params.get("grant_id"));
        await store.revokeGrant(id, settings.adminStamp);
        console.info(JSON.stringify({ event: "oauth_admin_revocation" }));
        return response("", 303, false, { Location: `${settings.origin}/api/mcp-oauth/connections` });
      }
      const approvedIntent = validateOAuthIntent(new URLSearchParams(consent.intent as Record<string, string>), settings);
      if (params.get("decision") === "deny") return callback(approvedIntent, { error: "access_denied" }, settings.issuer);
      if (params.get("decision") !== "approve") throw new Error("invalid_request");
      const client = settings.clients.find(c => c.id === approvedIntent.client_id)!;
      const code = opaque("code");
      await store.authorize({ consentId: consent.jti!, codeHash: hashOAuthValue(code), grantId: randomUUID(), clientId: client.id,
        clientStamp: oauthClientStamp(client), adminStamp: settings.adminStamp, redirectUri: approvedIntent.redirect_uri,
        resource: approvedIntent.resource, challenge: approvedIntent.code_challenge });
      console.info(JSON.stringify({ event: "oauth_consent_approved", client: client.id }));
      return callback(approvedIntent, { code }, settings.issuer);
    }
    if (action === "connections") {
      const grants = await store.connections(settings.adminStamp);
      const ticket = await createOAuthConsent({ action: "connections" }, session, settings);
      return html(`<h1>Connected apps</h1><p>Only approved workshop data and aggregate counts are shared. Revoking stops this connection immediately.</p>${grants.length ? grants.map(grant => `<section><h2>${escape(settings.clients.find(c => c.id === grant.client_id)?.name ?? grant.client_id)}</h2><p>Expires: ${escape(grant.expires_at)}</p><form method="post" action="/api/mcp-oauth/connections"><input type="hidden" name="ticket" value="${escape(ticket)}"><input type="hidden" name="grant_id" value="${escape(grant.id)}"><button>Revoke connection</button></form></section>`).join("") : "<p>No active connections.</p>"}<p><a href="/">Return to dashboard</a></p>`);
    }
    const client = settings.clients.find(c => c.id === intent!.client_id)!;
    const ticket = await createOAuthConsent(intent!, session, settings);
    return html(`<h1>Connect ${escape(client.name)}?</h1><p>You are signed in as the CFL master admin.</p><p>This app will be able to read:</p><ul><li>Workshop catalogue</li><li>Total client, workshop and registration counts</li></ul><p>It cannot read personal, health or payment records, or change your database.</p><p>Callback: <code>${escape(intent!.redirect_uri)}</code></p><p>This permission expires in seven days. You can revoke it at any time from <a href="/api/mcp-oauth/connections">Connected apps</a>.</p><form method="post" action="/api/mcp-oauth/authorize"><input type="hidden" name="ticket" value="${escape(ticket)}"><button name="decision" value="approve">Allow read-only access</button><button name="decision" value="deny">Cancel</button></form>`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = ["invalid_request", "invalid_target", "invalid_scope", "invalid_grant", "unsupported_grant_type"];
    if (safe.includes(message)) return response(JSON.stringify({ error: message }), 400);
    if (error instanceof z.ZodError || /consent|signature|JWT|Unregistered|Duplicate/.test(message)) return response('{"error":"invalid_request"}', 400);
    // No database messages, session values, authorization codes or tokens enter logs.
    return response('{"error":"temporarily_unavailable"}', 503);
  }
}
