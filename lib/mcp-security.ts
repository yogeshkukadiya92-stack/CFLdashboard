import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const MCP_SCOPE = "cfl:read";

function httpsUrl(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a credential-free HTTPS URL`);
  }
  return url;
}

export function getMcpConfig() {
  if (process.env.MCP_ENABLED !== "true") throw new Error("MCP is disabled");
  const resource = httpsUrl(process.env.MCP_RESOURCE_URL, "MCP_RESOURCE_URL");
  if (resource.pathname !== "/api/mcp") throw new Error("MCP_RESOURCE_URL must end in /api/mcp");
  const mode = process.env.MCP_OAUTH_MODE ?? "external";
  if (mode !== "local" && mode !== "external") throw new Error("Invalid OAuth mode");
  if (mode === "external") httpsUrl(process.env.MCP_OAUTH_ISSUER, "MCP_OAUTH_ISSUER");
  // Preserve exact issuer matching, including whether its trailing slash is present.
  const exactIssuer = mode === "local" ? resource.origin : process.env.MCP_OAUTH_ISSUER!;
  const jwksUrl = mode === "local" ? "" : httpsUrl(process.env.MCP_OAUTH_JWKS_URL, "MCP_OAUTH_JWKS_URL").href;
  const subjects = mode === "local" ? ["cfl-admin"] : (process.env.MCP_ALLOWED_SUBJECTS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!subjects.length) throw new Error("MCP_ALLOWED_SUBJECTS is required");
  const origins = [resource.origin, ...(process.env.MCP_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean).map(value => {
    const url = httpsUrl(value.trim(), "MCP_ALLOWED_ORIGINS");
    if (url.pathname !== "/") throw new Error("Allowed origins must not have paths");
    return url.origin;
  })];
  return { resource: resource.href, origin: resource.origin, issuer: exactIssuer, jwksUrl, subjects, origins, mode };
}

let cachedKeys: { url: string; keys: JWTVerifyGetKey } | undefined;
export async function verifyMcpToken(token: string, config: ReturnType<typeof getMcpConfig>, keys?: JWTVerifyGetKey) {
  if (config.mode === "local") {
    const { verifyLocalAccessToken } = await import("./mcp-oauth.ts");
    return verifyLocalAccessToken(token);
  }
  if (!keys) {
    if (cachedKeys?.url !== config.jwksUrl) cachedKeys = {
      url: config.jwksUrl,
      keys: createRemoteJWKSet(new URL(config.jwksUrl), { timeoutDuration: 5000 })
    };
    keys = cachedKeys!.keys;
  }
  const { payload } = await jwtVerify(token, keys, {
    issuer: config.issuer,
    audience: config.resource,
    algorithms: ["RS256", "ES256"],
    requiredClaims: ["exp", "iat", "sub", "aud", "iss"],
    clockTolerance: 5
  });
  if (!payload.sub || !config.subjects.includes(payload.sub)) throw new Error("Account not allowed");
  if (typeof payload.scope !== "string" || !payload.scope.split(" ").includes(MCP_SCOPE)) throw new Error("Missing scope");
  return payload.sub;
}

export async function readMcpBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new Error("JSON content type required");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) { await reader.cancel(); throw new Error("Request too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
}
