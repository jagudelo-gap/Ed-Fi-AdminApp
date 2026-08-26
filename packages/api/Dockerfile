# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

# Note: build this with working directory at the repository root, not from the
# file's directory.

# Build stage - Use latest Node.js Alpine with pinned SHA for security and reproducibility
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

WORKDIR /app

# Install build toolchain needed for any native deps during install
# python3/make/g++ pins track the Alpine release bundled in node:*-alpine - bump these together with the base image tag
RUN apk add --no-cache --virtual .build-deps python3~=3.14 make~=4.4 g++~=15

# Copy package files first for better caching
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Install all dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.cache/nx \
    npm ci --legacy-peer-deps --prefer-offline --no-audit --progress=false

# Copy source code (filtered by .dockerignore)
COPY packages/ ./packages/
COPY types/ ./types/

ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build with optimizations - reset NX cache to avoid conflicts
RUN --mount=type=cache,target=/root/.cache/nx \
    npx nx reset --yes && \
    npx nx run api:build:production --verbose --output-style=stream

# Production stage - Minimal runtime image
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S adminapp -u 1001 -G nodejs

# Install only runtime dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl=~8 dumb-init=~1.2 && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package.json for npm prune
COPY package*.json ./
COPY packages/api/package.json ./packages/api/package.json

# Copy all node_modules from build stage and prune dev dependencies
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev --legacy-peer-deps --no-audit --no-fund

# Copy built application from build stage
COPY --from=build --chown=adminapp:nodejs /app/dist/packages/api ./dist/packages/api
COPY --chown=adminapp:nodejs packages/api/config/production.js-edfi ./dist/packages/api/config/production.js
COPY --chown=adminapp:nodejs packages/api/config/custom-environment-variables.js packages/api/config/default.js ./dist/packages/api/config/

# Create logs and certification runtime directories with proper permissions
RUN mkdir -p logs packages/api/certification && chown -R adminapp:nodejs logs packages/api/certification

# Switch to non-root user
USER adminapp

# Expose port
EXPOSE 3333

# Optimized health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:3333/api/healthcheck || exit 1

ENV NODE_CONFIG_DIR=/app/dist/packages/api/config

# Use dumb-init to handle signals properly and start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/packages/api/main.js"]
