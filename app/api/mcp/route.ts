import { createHash } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createCflMcpServer } from "../../../lib/mcp-server.ts";
import { getMcpConfig, MCP_SCOPE, readMcpBody, verifyMcpToken } from "../../../lib/mcp-security.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function finish(response: Response, request: Request, origins: string[] = []) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin");
  const origin = request.headers.get("origin");
  if (origin && origins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, MCP-Protocol-Version");
  }
  return response;
}

async function handle(request: Request) {
  let config: ReturnType<typeof getMcpConfig>;
  try {
    config = getMcpConfig();
    if (!process.env.MCP_DATABASE_URL) throw new Error("Missing database configuration");
  } catch { return finish(Response.json({ error: "MCP is not enabled or configured." }, { status: 503 }), request); }
  const origin = request.headers.get("origin");
  if ((request.headers.get("host") ?? new URL(request.url).host) !== new URL(config.resource).host || (origin && !config.origins.includes(origin))) {
    return finish(Response.json({ error: "Invalid host or origin." }, { status: 403 }), request);
  }
  if (request.method === "OPTIONS") return finish(new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id"
  } }), request, config.origins);
  const challenge = `Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource/api/mcp", scope="${MCP_SCOPE}"`;
  let subject: string;
  try {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
    if (!match) throw new Error("Missing token");
    subject = await verifyMcpToken(match[1], config);
  } catch { return finish(Response.json({ error: "OAuth login with an approved account is required." }, {
    status: 401, headers: { "WWW-Authenticate": challenge }
  }), request, config.origins); }
  if (request.method !== "POST") return finish(new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } }), request, config.origins);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return finish(Response.json({ error: "JSON content type required." }, { status: 415 }), request, config.origins);
  }
  let body: unknown;
  try { body = await readMcpBody(request); }
  catch { return finish(Response.json({ error: "Invalid JSON or request exceeds 64 KiB." }, { status: 400 }), request, config.origins); }
  const server = createCflMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody: body });
    console.info(JSON.stringify({ event: "mcp_request", account: createHash("sha256").update(subject).digest("hex").slice(0, 16), status: response.status }));
    return finish(response, request, config.origins);
  } catch {
    return finish(Response.json({ error: "MCP request failed." }, { status: 500 }), request, config.origins);
  } finally { await server.close(); }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = handle;
