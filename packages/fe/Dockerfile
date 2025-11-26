# Multi-stage build for frontend
FROM node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5 AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy source code
COPY . .

# Build the frontend with base path
RUN npx nx reset
RUN npm run build:fe

# Production stage with nginx
FROM nginx:alpine@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14 AS nginxbase

# Update packages + install envsubst (from gettext) and curl for healthcheck
RUN apk update && apk upgrade && apk add --no-cache gettext curl

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=build /app/dist/packages/fe /usr/share/nginx/html

# Copy runtime config template + entrypoint
COPY packages/fe/config.js.template /usr/share/nginx/html/config.js.template
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

# Switch to non-root user
USER nginx-app

EXPOSE 4200

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4200/health || exit 1

# Start nginx in foreground
ENTRYPOINT ["/entrypoint.sh"]
