# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

# Multi-stage build for frontend

# Note: build this with working directory at the repository root, not from the
# file's directory.

# Build stage - Use latest Node.js Alpine with pinned SHA for security and reproducibility
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

WORKDIR /app

ARG VITE_BASE_PATH=/adminapp/

ENV NX_VERBOSE_LOGGING=true \
    NODE_OPTIONS="--max-old-space-size=4096" \
    VITE_BASE_PATH="${VITE_BASE_PATH}" \
    CYPRESS_INSTALL_BINARY=0

# Copy only manifest + workspace config for efficient layer caching
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Install all dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.cache/nx \
    npm ci --legacy-peer-deps --prefer-offline --no-audit --progress=false

# Copy only required package sources (adjust if FE imports others)
COPY packages/fe ./packages/fe
COPY packages/common-ui ./packages/common-ui
COPY packages/models ./packages/models
COPY packages/utils ./packages/utils
COPY types ./types

# Install deps, reset Nx cache, and build in one layer
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.cache/nx \
    npx nx reset --yes && \
    npx nx run fe:build:production --skip-nx-cache --verbose --output-style=stream

# Production base stage with nginx
FROM nginx:alpine@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14 AS productionbase

# Install runtime tools (jq for safe JSON, curl for healthcheck), then remove default site config
RUN apk update && \
    apk upgrade && \
    apk add --no-cache jq=~1 curl=~8 && \
    rm -rf /var/cache/apk/* && \
    rm /etc/nginx/conf.d/default.conf

# Final production layer
FROM productionbase

# Copy built static assets
COPY --from=build /app/dist/packages/fe /usr/share/nginx/html

# Copy entrypoint script
COPY packages/fe/entrypoint.sh /entrypoint.sh

# Create nginx user and set up directories with proper permissions
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S nginx-app -u 1001 -G nginx-app && \
    mkdir -p /var/cache/nginx /var/log/nginx /var/run/nginx && \
    chown -R nginx-app:nginx-app \
        /var/cache/nginx \
        /var/log/nginx \
        /var/run/nginx \
        /etc/nginx \
        /usr/share/nginx/html && \
    chmod +x /entrypoint.sh

# Switch to non-root user for security
USER nginx-app

# Expose port
EXPOSE 4200

# Health check with proper endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4200/health || exit 1

# Start nginx in foreground
ENTRYPOINT ["/entrypoint.sh"]
