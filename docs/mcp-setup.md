# CFL read-only MCP

Status: implemented locally, disabled by default. Not deployed or connected to
ChatGPT yet. It requires an approved database role and OAuth configuration.
The built-in master-admin login option needs no external identity-provider
account: see [Built-in OAuth setup](mcp-oauth-setup.md) for the recommended local
mode. The provider checklist below applies only to `MCP_OAUTH_MODE=external`.

Release warning: the dependency audit on 2026-09-15 reports 8 existing-stack
package findings (1 critical, 5 high, 1 moderate, 1 low), including Next.js,
PostCSS, sharp and xlsx. The new MCP SDK/jose/zod packages are not listed as
vulnerable. Review and address the application-stack findings before exposing
this endpoint; no broad dependency upgrades were performed in this MCP change.

Endpoint after deployment: `https://dashboard.coachforlife.in/api/mcp`.
Transport: stateless Streamable HTTP (JSON responses), compatible with the app's
multi-worker supervisor. MCP clients must support this transport and OAuth.

## Scope

Two tools: `list_datasets` and `browse_records`. Approved datasets are the CRM
workshop catalogue and aggregate client/workshop/registration counts. Pagination
is keyset-based, with at most 50 rows. No arbitrary SQL, mutations, personal,
health, contact, payment, integration secrets or raw app_state data is available.
This is not a universal connector for apps without MCP support.

## Deployment checklist (requires approval before live access is granted)

1. Review `database/mcp_readonly.sql`, then run it as the database owner on the
   intended database after the normalized `crm_*` tables exist. It creates only
   views and a new least-privilege login role; it does not change business records.
   If that role already exists, stop and review rather than granting broader access.
2. Set the new role's strong password privately through the database admin tool.
   Check that it inherits no other roles and has no base-table privileges (including
   privileges granted to PUBLIC). PostgreSQL databases with PUBLIC CREATE or broad
   default grants need an administrator's review. Do not weaken TLS or expose
   PostgreSQL publicly. Keep MCP traffic to the database on its private network.
3. Set `MCP_DATABASE_URL` in Coolify to this role's connection URL. Never use
   `DATABASE_URL` or a superuser. Each worker reserves one additional connection;
   four workers add up to four connections (eight during rolling deployment).
4. Use an OAuth 2.1/OIDC provider with authorization code + S256 PKCE, discovery
   metadata, resource/audience support and signed RS256 or ES256 JWT access tokens.
   Set the exact `MCP_OAUTH_ISSUER` and its trusted `MCP_OAUTH_JWKS_URL`. Configure
   the API resource/audience to exactly `https://dashboard.coachforlife.in/api/mcp`
   and the delegated scope to `cfl:read`. The scope must be in the token's `scope`
   string. Grant it only to the explicitly approved operator accounts. ID tokens
   or tokens minted for another API are not accepted.
5. Set `MCP_ALLOWED_SUBJECTS` to those provider user IDs (`sub` claims), separated
   by commas. This release supports a single CFL tenant, not multi-tenant access.
   Keep token lifetimes short; removing a subject disables future requests for it.
6. Register each client at the provider. For ChatGPT use the exact redirect URI
   shown by its connection-management UI; do not guess a callback URL. Configure
   predefined OAuth client credentials there, or use provider-supported CIMD/DCR.
   Verify the provider's discovery metadata advertises S256 and correctly handles
   the resource parameter. Refresh tokens/revocation are managed by the provider.
7. Set `MCP_RESOURCE_URL` to the endpoint above and `MCP_ENABLED=true` only after
   approval. Add specific browser origins to `MCP_ALLOWED_ORIGINS` only if needed;
   server-to-server clients normally send no Origin. Coolify must preserve the
   canonical Host header and route the well-known path as well as `/api/mcp`.
8. Run tests and typecheck; deploy via the existing reviewed release workflow.
   Add proxy-level rate limiting and request-body/time limits for `/api/mcp`, and
   monitor 401s, latency and DB load. No process-local session or rate-limit state
   is used; the DB query has a 5-second limit and requests have a 64-KiB body cap.
9. Verify: disabled/unconfigured -> 503; no token -> 401 with WWW-Authenticate;
   wrong issuer/audience/subject/scope -> 401; valid approved token -> initialize,
   tools/list and tools/call. Exercise views with the dedicated role on staging.
10. In ChatGPT's custom MCP connection UI (if available to your account/workspace),
    enter the endpoint and select OAuth. Complete login and consent yourself.
    Repeat in other compatible clients. Test a workshop listing and aggregate
    count question. No client can alter the database through this MCP.

Discovery URL:
`https://dashboard.coachforlife.in/.well-known/oauth-protected-resource/api/mcp`.

## Verification commands

```sh
node --experimental-strip-types --test tests/mcp.test.ts
npm run typecheck
```

The automated tests use generated signing keys, mock datasets and the real MCP
SDK client/HTTP transport. They do not read or modify the production database.

## Disable/revoke

Set `MCP_ENABLED=false` and redeploy to disable every MCP request. Remove operator
subjects to revoke their access, and revoke OAuth grants at the provider. Review
the read-only DB role's credentials separately. Never place passwords or access
tokens in the MCP URL, source files, screenshots or chat messages.

Official authentication requirements:
https://developers.openai.com/plugins/build/auth
Official SDK transport guide:
https://ts.sdk.modelcontextprotocol.io/server
