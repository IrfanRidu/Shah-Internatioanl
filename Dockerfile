# syntax=docker/dockerfile:1

# ─── 1. Dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ─── 2. Build ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dummy build-time env vars — `next build` statically analyzes pages/API
# routes that reference these, but no live connection is made during build.
# Real values are supplied at *runtime* via `docker run -e ...` / your
# orchestrator's secret store / the docker-compose.yml env_file. See
# DEPLOYMENT.md for the full list of required runtime variables.
ENV MONGODB_URI=mongodb://localhost:27017/shah-international-build
ENV NEXTAUTH_SECRET=docker-build-placeholder-secret
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── 3. Runtime ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: 'standalone'` (see next.config.js) produces a minimal server
# bundle with only the dependencies actually used at runtime.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
