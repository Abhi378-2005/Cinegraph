# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json ./

# Install ALL deps (including devDeps needed for tsc)
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy manifests and install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# GCP service account key is mounted at runtime via Docker volume or secret.
# Set GOOGLE_APPLICATION_CREDENTIALS to the mounted path in your .env / compose file.

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/src/index.js"]
