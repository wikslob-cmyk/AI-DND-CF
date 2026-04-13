# Stage 1: Build
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
COPY tsconfig.base.json ./

# Build backend
RUN pnpm --filter @dnd/backend build

# Stage 2: Production
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built output
COPY --from=builder /app/packages/shared/src packages/shared/src
COPY --from=builder /app/packages/backend/dist packages/backend/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "packages/backend/dist/backend/src/server.js"]
