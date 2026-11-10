# Coolify Docker build

Use the repository-root `Dockerfile` with base directory `/`, Dockerfile location
`/Dockerfile`, and exposed port `3000`. The image starts the existing supervised
Next.js cluster via `scripts/start-server.mjs` and keeps the runtime SQL files.

In Advanced > Build:

- Build cache: **Use Docker build cache**.
- Build arguments: **Managed manually in Dockerfile**.
- Source commit availability: **Runtime only (preserves cache)**.
- Network hosts during build: **Do not add (preserves cache)**. The build needs
  no running database; container IP changes must not invalidate cached RUN steps.

Make `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_RESET_DEMO_DATA` available during build
when required. All private configuration remains in Coolify's runtime environment;
the Dockerfile does not require production credentials to build. Keep existing
runtime variables, domains, health checks, and persistent storage settings.

The dependency layer depends only on `package.json`, `package-lock.json`, and the
base image. npm downloads and `.next/cache` use persistent BuildKit cache mounts.
The runtime image uses Next.js standalone output and copies only traced server
dependencies, static/public assets, SQL files, the migration script, and the cluster
launcher. `CFL_STANDALONE=1` selects the generated server while preserving the
existing worker count, migration startup, and graceful shutdown. Local `npm start`
still uses the stock Next CLI. Build cache and untraced dependencies stay out of
the runtime image.

After deploying a new source commit with unchanged dependency files, the
`dependencies` install step should be `CACHED`. The first build on a new server, or after cache cleanup, must populate
the caches. Do not routinely force builds without cache.

Validation: check the build result, application runtime logs and public login
page. For rollback, use Coolify's retained previous image; reverting the build
strategy to Nixpacks also restores the previous build path.
