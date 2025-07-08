# Multi-stage Dockerfile for Imaginarium monorepo
# Optimized for production with development support

# Base stage with common dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev

# Copy package files for dependency resolution
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY libs/core/package.json ./libs/core/
COPY libs/ui/package.json ./libs/ui/
COPY packages/shared/package.json ./packages/shared/

# Dependencies stage
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Development dependencies stage  
FROM base AS dev-deps
RUN npm ci && npm cache clean --force

# Builder stage
FROM dev-deps AS builder

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production server stage
FROM node:20-alpine AS server-prod

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    libc6-compat \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package.json ./package.json

# Copy built applications
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=nodejs:nodejs /app/libs/core/dist ./libs/core/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist

# Copy package.json files for runtime module resolution
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/package.json ./apps/server/
COPY --from=builder --chown=nodejs:nodejs /app/libs/core/package.json ./libs/core/
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/package.json ./packages/shared/

USER nodejs

EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/server/dist/index.js"]

# Development stage
FROM dev-deps AS server-dev

# Install development tools
RUN npm install -g nodemon tsx

# Create non-root user for development
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

# Use tsx for development with hot reloading
CMD ["npm", "run", "dev", "--workspace=@imaginarium/server"]

# Client build stage
FROM dev-deps AS client-builder

# Copy source code
COPY . .

# Build client application
RUN npm run build:client

# Client production stage
FROM nginx:alpine AS client-prod

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy built client app
COPY --from=client-builder /app/apps/client/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup --system --gid 1001 nginx-user
RUN adduser --system --uid 1001 nginx-user

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Full development environment
FROM dev-deps AS dev

# Install additional development tools
RUN npm install -g concurrently

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000 5173

# Run both client and server in development mode
CMD ["npm", "run", "dev"]