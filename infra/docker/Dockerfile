# ============================================================================
# SINERGIA MEET - MULTI-STAGE PRODUCTION CONTAINER DESIGN (Dockerfile)
# Minimal footprint, type-safe compilation and native esbuild bundling
# ============================================================================

# Stage 1: Core Compilation and Assets Construction
FROM node:22-alpine AS builder
WORKDIR /app

# Copy system manifests to cash dependencies layers
COPY package*.json ./
RUN npm ci

# Copy full application codebase
COPY . .

# Compile optimized static frontend bundle & compile server to standalone CommonJS file
RUN npm run build

# Stage 2: Minimal Runtime Distribution
FROM node:22-alpine AS runner
WORKDIR /app

# Run as non-privileged system user for OWASP Docker hardening
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY package*.json ./
# ONLY install production dependencies to decrease security surfaces
RUN npm ci --omit=dev

# Gather static distribution asset dirs from Stage 1
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Grant execution rights to non-privileged workspace processes
RUN chown -R nodejs:nodejs /app
USER nodejs

# Standard entry port ingress configuration
EXPOSE 3000

# Start command mapped directly to our compiled CommonJS bundles
CMD ["node", "dist/server.cjs"]
