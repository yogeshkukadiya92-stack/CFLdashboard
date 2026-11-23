import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { browseMcpData, mcpBrowseSchema, mcpDatasets } from "./mcp-data.ts";
import { MCP_SCOPE } from "./mcp-security.ts";

export function createCflMcpServer(readData: typeof browseMcpData = browseMcpData, options: { local?: boolean } = {}) {
  const server = new McpServer({ name: "cfl-postgresql-readonly", version: "1.0.0" });
  const policy = {
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ...(options.local ? {} : { _meta: { securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPE] }] } })
  };
  server.registerTool("list_datasets", {
    title: "Available CFL datasets", description: "List the explicitly approved read-only datasets and columns.",
    inputSchema: {}, ...policy
  }, async () => ({ content: [{ type: "text", text: JSON.stringify(mcpDatasets) }] }));
  server.registerTool("browse_records", {
    title: "Browse CFL records", description: "Read workshops, counts, registrations, attendance or payment events. Search names/mobile/email and filter by workshop_id, status or inclusive dates. Follow next_cursor using after_id until has_more is false to retrieve all records. CRM and live registrations may overlap; payment events are not unique receipts.",
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
