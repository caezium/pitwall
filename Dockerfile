FROM node:20-alpine

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ curl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/web/ apps/web/

# Build Next.js
ENV DATABASE_PATH=/tmp/build.db
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @pitwall/web build && rm -f /tmp/build.db*

# Entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /data

EXPOSE 3000
VOLUME /data

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/data/pitwall.db

ENTRYPOINT ["/docker-entrypoint.sh"]
