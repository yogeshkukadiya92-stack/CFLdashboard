# Private MCP setup — user handoff

Do this yourself in Coolify. Never send the resulting URL, password or client
secret in chat or a screenshot. The assistant must not execute the credential
creation command or submit the new credential for you.

## 1. Create the reader credential privately

Open the CFLDashboard production application's Terminal after its deployment
finishes. Copy and run this command yourself. It generates a random password,
sets it only on the already-provisioned `cfl_mcp_reader`, enables its login, and
prints its private connection URL. It does not change the database owner's
password or any business data.

```sh
node -e 'const {Client}=require("pg"),{randomBytes}=require("node:crypto");const c=new Client({connectionString:process.env.DATABASE_URL});(async()=>{await c.connect();const p=randomBytes(32).toString("base64url");const r=await c.query("SELECT format($1::text,$2::text,$3::text) AS sql",["ALTER ROLE %I WITH LOGIN PASSWORD %L","cfl_mcp_reader",p]);await c.query(r.rows[0].sql);const u=new URL(process.env.DATABASE_URL);u.username="cfl_mcp_reader";u.password=p;console.log("PRIVATE MCP_DATABASE_URL — save in Coolify, never share:");console.log(u.href);await c.end()})().catch(()=>{console.error("Credential setup failed; no credentials printed");process.exit(1)});'
```

Copy that URL into a new private production runtime environment variable named
`MCP_DATABASE_URL`. Do not make it NEXT_PUBLIC, do not enable it as a build-time
variable, and do not replace the existing `DATABASE_URL`. Submit/save it yourself.
Keep it in your password manager. Clear the terminal display afterwards yourself.
If it is accidentally disclosed, rotate it privately before enabling MCP.

## 2. Provide only the non-secret callback URL

In ChatGPT's custom MCP configuration, select OAuth if your account offers it.
Copy the exact Redirect/Callback URL that ChatGPT supplies and share only that
URL with the assistant. Do not send a client secret or a login password. An
approved app must have its exact callback registered before it can connect.

Keep `MCP_ENABLED=false` until the callback/client configuration, private reader
connection and live verification are complete. The assistant can finish the
non-secret settings after this handoff. Final ChatGPT login and consent remain
your own actions.
