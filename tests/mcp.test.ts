import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createCflMcpServer } from "../lib/mcp-server.ts";
import { buildMcpQuery } from "../lib/mcp-data.ts";
import { getMcpConfig, readMcpBody, verifyMcpToken } from "../lib/mcp-security.ts";
import { POST, OPTIONS } from "../app/api/mcp/route.ts";
import { GET as metadata } from "../app/.well-known/oauth-protected-resource/api/mcp/route.ts";

const config = { resource: "https://cfl.example/api/mcp", origin: "https://cfl.example", issuer: "https://auth.example/", jwksUrl: "https://auth.example/jwks", subjects: ["approved-user"], origins: ["https://cfl.example"], mode: "external" };

test("MCP is disabled and refuses incomplete configuration", () => {
  const previous = process.env.MCP_ENABLED;
  try { process.env.MCP_ENABLED = "false"; assert.throws(getMcpConfig, /disabled/); }
  finally { if (previous === undefined) delete process.env.MCP_ENABLED; else process.env.MCP_ENABLED = previous; }
});

test("MCP SQL is bounded, projected, parameterized and dataset-allowlisted", () => {
  const attack = "'; DROP TABLE crm_clients; --%";
  const query = buildMcpQuery({ dataset: "workshops", query: attack, limit: 50 });
  assert.ok(!query.sql.includes(attack));
  assert.match(query.sql, /FROM cfl_mcp\.workshops/);
  assert.ok(!query.sql.includes("SELECT *"));
  assert.equal(query.values.at(-1), 51);
  assert.throws(() => buildMcpQuery({ dataset: "crm_clients" }));
  assert.throws(() => buildMcpQuery({ dataset: "workshops", limit: 1000 }));
  assert.throws(() => buildMcpQuery({ dataset: "workshops", after_id: "1; DELETE" }));
  assert.throws(() => buildMcpQuery({ dataset: "summary", query: "private" }));
});

test("OAuth requires valid signature, audience, issuer, expiry, approved subject and scope", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const keys = async () => publicKey;
  const token = (overrides: Record<string, unknown> = {}) => new SignJWT({ scope: "cfl:read", sub: "approved-user", iss: config.issuer, aud: config.resource,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, ...overrides }).setProtectedHeader({ alg: "RS256" }).sign(privateKey);
  assert.equal(await verifyMcpToken(await token(), config, keys), "approved-user");
  for (const overrides of [{ aud: "https://other.example" }, { iss: "https://evil.example" }, { sub: "another-user" }, { scope: "cfl:write" }, { exp: 1 }]) {
    await assert.rejects(() => token(overrides).then(value => verifyMcpToken(value, config, keys)));
  }
  const other = await generateKeyPair("RS256");
  await assert.rejects(() => token().then(value => verifyMcpToken(value, config, async () => other.publicKey)));
});

test("MCP rejects oversized, malformed and non-JSON requests", async () => {
  const request = (body: string, type = "application/json") => new Request(config.resource, { method: "POST", headers: { "content-type": type }, body });
  assert.deepEqual(await readMcpBody(request('{"id":1}')), { id: 1 });
  await assert.rejects(() => readMcpBody(request("x".repeat(65537))), /too large/);
  await assert.rejects(() => readMcpBody(request("{")));
  await assert.rejects(() => readMcpBody(request("{}", "text/plain")));
});

test("SDK client discovers only read-only tools and invokes paginated records", async () => {
  const server = createCflMcpServer(async () => ({ rows: [{ id: "1", name: "Workshop" }], has_more: false, next_cursor: null }));
  const client = new Client({ name: "test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ["browse_records", "list_datasets"]);
    for (const tool of tools.tools) assert.equal(tool.annotations?.readOnlyHint, true);
    const result = await client.callTool({ name: "browse_records", arguments: { dataset: "workshops" } });
    assert.equal(result.isError, undefined);
    assert.equal((result.structuredContent as { rows: unknown[] }).rows.length, 1);
    const invalid = await client.callTool({ name: "browse_records", arguments: { dataset: "workshops", limit: 51 } });
    assert.equal(invalid.isError, true);
  } finally { await client.close(); await server.close(); }
});

test("stateless HTTP initialize, tools/list and tools/call work across fresh instances", async () => {
  const invoke = async (method: string, params: unknown) => {
    const server = createCflMcpServer(async () => ({ rows: [], has_more: false, next_cursor: null }));
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(new Request(config.resource, {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
      }));
      assert.equal(response.status, 200);
      return await response.json();
    } finally { await server.close(); }
  };
  assert.equal((await invoke("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } })).result.serverInfo.name, "cfl-postgresql-readonly");
  assert.equal((await invoke("tools/list", {})).result.tools.length, 2);
  assert.equal((await invoke("tools/call", { name: "browse_records", arguments: { dataset: "summary" } })).result.structuredContent.has_more, false);
});

test("database failures never leak connection secrets or SQL", async () => {
  const server = createCflMcpServer(async () => { throw new Error("postgres://secret:password@internal SELECT private"); });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b); await client.connect(a);
    const result = await client.callTool({ name: "browse_records", arguments: { dataset: "summary" } });
    assert.equal(result.isError, true);
    assert.ok(!JSON.stringify(result).includes("password"));
  } finally { await client.close(); await server.close(); }
});

test("HTTP route fails closed, publishes OAuth discovery, and rejects foreign origins", async () => {
  const variables = { MCP_ENABLED: "true", MCP_RESOURCE_URL: config.resource, MCP_DATABASE_URL: "postgres://unused",
    MCP_OAUTH_ISSUER: config.issuer, MCP_OAUTH_JWKS_URL: config.jwksUrl, MCP_ALLOWED_SUBJECTS: "approved-user", MCP_ALLOWED_ORIGINS: "" };
  const previous = Object.fromEntries(Object.keys(variables).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, variables);
    const response = await POST(new Request(config.resource, { method: "POST", body: "{}" }));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("www-authenticate")!, /oauth-protected-resource\/api\/mcp/);
    const discovery = await metadata().json();
    assert.equal(discovery.resource, config.resource);
    assert.deepEqual(discovery.authorization_servers, [config.issuer]);
    const forbidden = await POST(new Request(config.resource, { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" }));
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.headers.get("access-control-allow-origin"), null);
    const options = await OPTIONS(new Request(config.resource, { method: "OPTIONS", headers: { origin: config.origin } }));
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("access-control-allow-origin"), config.origin);
    process.env.MCP_ENABLED = "false";
    assert.equal((await POST(new Request(config.resource, { method: "POST", body: "{}" }))).status, 503);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
