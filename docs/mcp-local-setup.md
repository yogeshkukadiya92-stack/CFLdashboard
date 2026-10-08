# Local CFL data MCP

The dashboard now supports a local stdio MCP server in addition to its existing
remote OAuth endpoint. Local clients start the server directly; no public hosting
or browser OAuth is needed. Access is controlled by the local client's access to
the dedicated database credential.

## Data available

- `list_datasets`: discover the datasets and their columns.
- `browse_records`: get workshops, counts, live registrations, CRM history, attendance or payment events.
  Workshop names can be searched with `query`. Use `after_id` with `next_cursor`
  for more pages; `limit` is at most 50.

Registration contacts, confirmation/waiting status, paid/due balances, attendance
sessions/duration and gateway payment events are included. The server never
changes business records. Retrieve every page until `has_more` is false; there
is no total-record cap. See [business data setup](mcp-business-records.md).

## Configure privately

Install the project dependencies, then set `MCP_DATABASE_URL` in `.env.local`
to the existing dedicated `cfl_mcp_reader` connection. Do not use `DATABASE_URL`.
See [private credential setup](mcp-private-setup.md) if the reader still needs
credentials. This file is ignored by Git. The database must be reachable from
the computer running the client, through its existing private network access.

Use Node.js 22.18 or newer. Add the following server to a client that supports
stdio MCP, replacing both paths with the absolute paths on your machine:

```json
{
  "mcpServers": {
    "cfl_dashboard": {
      "command": "/absolute/path/to/node",
      "args": [
        "--experimental-strip-types",
        "/absolute/path/to/CFLdashboard-main/scripts/start-mcp.ts"
      ]
    }
  }
}
```

The launcher finds the project's environment files even when the client starts
in another directory. A missing reader connection stops startup with a clear
message. The remote `MCP_ENABLED` switch applies to the HTTP endpoint; the local
server is enabled by explicitly starting it with the private reader credential.

You can also start it with `npm run mcp` for diagnostics. It waits for MCP
messages; ask for data through a connected client, not the terminal.

Example questions: "List CFL workshops containing MFW" or "What are the total
client and registration counts?" ChatGPT's hosted connector uses the remote
endpoint instead; follow [OAuth setup](mcp-oauth-setup.md) for that connection.
