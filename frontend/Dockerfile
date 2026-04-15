# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# NEXT_PUBLIC_* vars are baked in at build time — pass via --build-arg
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_TMDB_IMAGE_BASE=$NEXT_PUBLIC_TMDB_IMAGE_BASE

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
# Defaults — override via env_file or -e flags at container start
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone output includes its own node_modules — no npm install needed
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT} || exit 1

CMD ["node", "server.js"]
