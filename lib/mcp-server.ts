import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { browseMcpData, mcpBrowseSchema, mcpDatasets } from "./mcp-data.ts";
import { MCP_SCOPE } from "./mcp-security.ts";

export function createCflMcpServer(readData: typeof browseMcpData = browseMcpData) {
  const server = new McpServer({ name: "cfl-postgresql-readonly", version: "1.0.0" });
  const policy = {
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPE] }] }
  };
  server.registerTool("list_datasets", {
    title: "Available CFL datasets", description: "List the explicitly approved read-only datasets and columns.",
    inputSchema: {}, ...policy
  }, async () => ({ content: [{ type: "text", text: JSON.stringify(mcpDatasets) }] }));
  server.registerTool("browse_records", {
    title: "Browse CFL records", description: "Read a page of approved workshop data or aggregate counts. Use after_id for pagination. No arbitrary SQL or personal records are available.",
    inputSchema: mcpBrowseSchema, ...policy
  }, async (args) => {
    try {
      const result = await readData(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    } catch {
      return { isError: true, content: [{ type: "text", text: "Could not read the approved dataset. Check MCP database setup or input; no data was changed." }] };
    }
  });
  return server;
}
