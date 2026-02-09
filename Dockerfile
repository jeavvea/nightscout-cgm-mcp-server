# Multi-stage build for Nightscout MCP Server (TypeScript)
# Builder: installs deps, compiles TypeScript
FROM --platform=linux/amd64 node:20-bullseye-slim AS builder
WORKDIR /app

# Copy package files first to leverage layer caching
COPY package*.json ./

# Install all deps (including dev for build) and build
RUN npm ci

# Copy rest of the sources and build
COPY . .
RUN npm run build

# Remove devDependencies to keep production node_modules
RUN npm prune --production

# Runtime image: smaller, production-only
FROM --platform=linux/amd64 node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what we need from the builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose configured port (default 8000)
EXPOSE 8000

# Run the compiled app
CMD ["node", "dist/index.js"]
