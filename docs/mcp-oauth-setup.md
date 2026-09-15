# Built-in OAuth for CFL MCP

Implemented and disabled by default. Production schemas were provisioned with
approval on 2026-09-15; the reader remains NOLOGIN pending private credential
setup. Deployment and ChatGPT linking must be verified separately. This mode
uses the existing master-admin login; no external identity service is required.

## Deployment checklist (obtain approval before granting live access)

Current preflight: production application uses the private PostgreSQL owner
connection; `max_connections=100`. Live verification under `SET LOCAL ROLE
cfl_mcp_reader` could read the workshop view, found zero readable business/OAuth
tables, zero writable MCP views, and no CREATE permission on public. Provisioning
was one transaction and did not change business records. Do not rerun the reader
migration against the already-created role. Privately set its password and enable
LOGIN only when its dedicated runtime URL is ready.

Approved release prerequisite: Next.js is pinned to 16.3.3 (resolved sharp 0.35.4).
Typecheck, production build and all 136 tests pass. The refreshed npm audit reports
four remaining findings and no Critical: browserslist (High; build-only
autoprefixer queries, no application input found), baseline-browser-mapping
(Moderate), postcss-selector-parser (Low), and existing xlsx (High). xlsx parses
user-selected spreadsheets in browser-side CRM import pages, not in MCP or an
unauthenticated server parser; its malicious-file risk remains and needs a
separate compatible replacement/update. Do not import untrusted spreadsheets.
A passing build/audit does not establish production security or OAuth linkage.

1. Review the application-stack security audit warnings recorded in
   [MCP setup](mcp-setup.md). They are unvalidated scanner leads. Resolve applicable
   release blockers before exposing the endpoint. No broad dependency upgrade
   is part of this change.
2. Review and manually run `database/mcp_readonly.sql` after the normalized CRM
   tables exist. Set the reader's password privately. Set `MCP_DATABASE_URL` to
   that dedicated role's private connection URL, never the application owner.
   Check inherited/PUBLIC grants: the role must not read base tables, join other
   roles or have write access. Do not expose PostgreSQL publicly or weaken TLS.
3. Review and manually run `database/mcp_oauth.sql` as the normal application
   database owner, or explicitly grant the application runtime role USAGE and
   SELECT/INSERT/UPDATE on those OAuth tables. Never grant the MCP reader access.
   Business records are unchanged; OAuth metadata goes into a separate schema.
4. Keep `MCP_ENABLED=false` while preparing these Coolify runtime variables:

   ```sh
   MCP_OAUTH_MODE=local
   MCP_RESOURCE_URL=https://dashboard.coachforlife.in/api/mcp
   MCP_OAUTH_CLIENTS=[{"id":"cfl_chatgpt","name":"ChatGPT","redirectUris":["EXACT_HTTPS_CALLBACK_FROM_CHATGPT"],"secret":"PRIVATELY_GENERATED_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"}]
   ```

   This is a template, not usable credentials. Store JSON as a private variable,
   not in source control. Copy the exact callback URI from ChatGPT's connection
   management UI; never invent it or use a wildcard. Each additional approved
   app gets its own predefined client ID, callback allowlist and preferably
   confidential-client secret. Public clients may omit `secret` if that app
   supports predefined public-client OAuth; S256 PKCE is still mandatory.
   No unrestricted DCR, CIMD fetching, password or client-credentials flow is
   exposed. Only registered clients can request permission.
5. Configure explicit `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET` (at least
   32 characters) and `DATABASE_URL`. Built-in OAuth refuses development default
   credentials. External issuer/JWKS/subject variables are not needed in local
   mode. Only the master admin can consent and manage connections.
6. Run tests, typecheck/build and staging database checks. After live-access
   approval and security review, set `MCP_ENABLED=true` and deploy using the
   existing reviewed workflow. Coolify must preserve the canonical Host and
   route `/api/mcp`, `/api/mcp-oauth/*` and both metadata paths below.
7. Add shared proxy-level rate limits and request time/body limits for MCP,
   OAuth and login. Existing login throttling is per worker. No process-local
   token/session storage is used. Browser MCP clients may need specific HTTPS
   origins in `MCP_ALLOWED_ORIGINS`; never use a wildcard. Server-to-server
   clients normally send no Origin.
8. In ChatGPT's custom MCP connection UI, if available to your account/workspace,
   enter `https://dashboard.coachforlife.in/api/mcp`, select OAuth and enter the
   predefined client ID/secret. Complete login and explicit read-only consent
   yourself. Repeat for other MCP/Streamable-HTTP/OAuth compatible apps. Apps
   without MCP support need an API integration.

With four workers, the reader and OAuth pools reserve up to eight additional
database connections (sixteen during rolling deployment), alongside existing
pools. Keep database capacity for administration and normal registrations.

## Manage connections

Native desktop clients can register the exact callback displayed by
`codex mcp add cfl_dashboard --url https://dashboard.coachforlife.in/api/mcp --oauth-client-id cfl_desktop`.
This command changes local MCP configuration and must be authorized before use.
For an explicitly registered portless `http://127.0.0.1/...` callback only, the
server permits the ephemeral listener port required by RFC 8252. Host, path and
query remain exact; other HTTP hosts and wildcard callbacks are rejected. Code
redemption remains bound to the exact URI used during authorization and S256.
HTTPS web callbacks never get this port exception.

While signed in, visit
`https://dashboard.coachforlife.in/api/mcp-oauth/connections` to view/revoke grants.
The page shows the configured app and expiry, never tokens. Revoking denies
future access immediately. Ordinary dashboard logout clears the browser session,
not independently consented app permissions: explicitly revoke those grants.

## Authorization model and residual risk

| Boundary | Required proof | Permission |
| --- | --- | --- |
| Consent / connections | Signed master-admin cookie | Approve/revoke app grants |
| Browser mutation | Same canonical Origin and signed session-bound ticket | Mutate only that admin's grant |
| Code redemption | Registered client, exact callback/resource, S256 verifier | Exchange a one-use code |
| Refresh | Registered client, rotating refresh token, matching resource | Renew the same grant |
| MCP request | Valid opaque token and active matching client/admin grant | Read approved datasets only |

Only workshop catalogue and aggregate counts are shared. No arbitrary SQL,
personal/health/contact/payment records, writes, secrets or raw app_state.

Access tokens last at most 15 minutes. Grants and rotating refresh tokens expire
after seven days without indefinite extension. Approval tickets expire after
five minutes, codes after two minutes. Codes and refresh tokens are hashed in
PostgreSQL and redeemed transactionally under row locks across workers.
Consumed code/refresh-token replay revokes the entire grant. A unique consent
ID blocks repeated approval. Admin credential/AUTH_SECRET changes, changed or
removed clients, wrong resources and revoked/expired grants deny future access.
Old access tokens remain valid after normal refresh until expiry unless revoked.

The existing seven-day admin session and lack of MFA are inherited risks; this
feature does not add MFA or extra users. Treat the master account as privileged.
Signed consent tickets cannot be used as MCP access tokens. Every consent page
displays the configured app, exact callback, read-only scope and revocation link.

OAuth forms are capped at 16 KiB, MCP JSON at 64 KiB and database statements at
five seconds. Audit logs contain event/client IDs and hashed MCP identity, not
passwords, tokens, SQL or records. Do not log callback query strings, request
bodies or Authorization headers at the reverse proxy. Use HTTPS and secret
runtime configuration. Keep replay evidence throughout active grant lifetimes;
an administrator may later clean up expired grants under a reviewed policy.
No automated deletion/cleanup is included.

## Discovery

Protected resource:
`https://dashboard.coachforlife.in/.well-known/oauth-protected-resource/api/mcp`

Authorization server:
`https://dashboard.coachforlife.in/.well-known/oauth-authorization-server`

Issuer is exactly the resource origin. Metadata advertises S256, authorization
code + refresh flows, token/revocation endpoints, `cfl:read` and issuer
identification. Successful/cancelled callbacks include the original `state` and
`iss`. Invalid requests are rejected locally without unvalidated redirects.

## Verification and disable

```sh
npm run test:mcp
npm run test:crm
npm run typecheck
npm run build
```

Automated tests use synthetic admin cookies, mock OAuth persistence, scripted
PostgreSQL exchange responses and the real MCP SDK transport/client. They cover
consent, CSRF/session binding, callback/client/resource/PKCE validation, denial,
replay, rotation, revocation and admin/client invalidation. They do not touch
production. Real migrations, role permissions, simultaneous redemption and a
real ChatGPT OAuth round trip still require staging verification before release.

Set `MCP_ENABLED=false` and redeploy to disable MCP and built-in OAuth. Revoke
individual connections or change/remove clients to stop their tokens. Review
reader credentials separately. Never put credentials/tokens in screenshots,
source files, chat messages or the MCP URL.

Official OpenAI authentication requirements:
https://developers.openai.com/plugins/build/auth
MCP authorization specification:
https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
