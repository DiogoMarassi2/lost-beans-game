# Dockerfile for deploying the Dark Beans Zombies server on Fly.io (or any container host)
# Stage 1 – build (type‑check, compile, bundle)
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
# Install dependencies and run type‑check & build
RUN npm ci && npm run typecheck && npm run build

# Stage 2 – runtime (only production deps)
FROM node:22-alpine
WORKDIR /app
# Copy only what is needed to run the server
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/src ./src
COPY --from=builder /app/packages/server/package*.json ./
# Install runtime dependencies only
RUN npm ci --production

# Expose the port used by Colyseus (default 2567)
EXPOSE 2567
# The host (Render/Fly) will provide $PORT; fallback to SERVER_PORT if absent
CMD ["node", "dist/index.js"]
