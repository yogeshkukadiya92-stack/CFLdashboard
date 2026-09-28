import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCflMcpServer } from "../lib/mcp-server.ts";

// Resolve environment files from the project, independent of the client's cwd.
// stdout is reserved exclusively for MCP protocol messages.
const projectDir = fileURLToPath(new URL("../", import.meta.url));
nextEnv.loadEnvConfig(projectDir, true, {
  info: (...args: unknown[]) => console.error(...args),
  error: (...args: unknown[]) => console.error(...args)
});

if (!process.env.MCP_DATABASE_URL) {
  console.error("CFL MCP needs MCP_DATABASE_URL for the dedicated read-only database role. Configure it privately in .env.local or the MCP client's environment.");
  process.exit(1);
}

const server = createCflMcpServer(undefined, { local: true });
try {
  await server.connect(new StdioServerTransport());
} catch {
  console.error("CFL MCP could not start. Check the local configuration.");
  process.exit(1);
}
