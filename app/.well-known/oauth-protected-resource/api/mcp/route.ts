import { getMcpConfig, MCP_SCOPE } from "../../../../../lib/mcp-security.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const config = getMcpConfig();
    return Response.json({ resource: config.resource, authorization_servers: [config.issuer],
      scopes_supported: [MCP_SCOPE], bearer_methods_supported: ["header"], resource_name: "CFL read-only database" },
    { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  } catch { return Response.json({ error: "MCP is not enabled or configured." }, { status: 503 }); }
}
