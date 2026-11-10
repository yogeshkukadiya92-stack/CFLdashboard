# syntax=docker/dockerfile:1

# Keep the same Node release and libc across build and runtime stages.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Coolify's existing HTTP health check uses curl inside the container.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
# Source changes must not invalidate dependency installation.
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=cfl-npm,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

FROM dependencies AS build
COPY . .
# Only public, compile-time configuration belongs in the image build.
# Keep these after dependency installation so config changes preserve that layer.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_RESET_DEMO_DATA=false
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_RESET_DEMO_DATA=$NEXT_PUBLIC_RESET_DEMO_DATA
RUN --mount=type=cache,id=cfl-next,target=/app/.next/cache,sharing=locked \
    npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CFL_STANDALONE=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/database ./database
COPY --from=build --chown=node:node /app/scripts/start-server.mjs ./scripts/start-server.mjs
COPY --from=build --chown=node:node /app/scripts/migrate-callflow-platform.mjs ./scripts/migrate-callflow-platform.mjs
COPY --from=build --chown=node:node /app/package.json /app/next.config.mjs ./
RUN mkdir -p .data .next/cache && chown -R node:node .data .next/cache
USER node
EXPOSE 3000
# Preserve the existing supervised cluster and graceful shutdown behavior.
CMD ["node", "scripts/start-server.mjs", "--hostname", "0.0.0.0", "--port", "3000"]
