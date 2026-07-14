# syntax=docker/dockerfile:1.7

# Multi-stage: build inside the image so Astro standalone paths resolve under /app.
# Runtime keeps production node_modules — standalone entry imports packages such as
# send, server-destroy, piccolore, cookie, devalue, unstorage from node_modules.

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/astro astro

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=astro:nodejs /app/dist ./dist
COPY --chown=astro:nodejs scripts/run-standalone.mjs ./scripts/run-standalone.mjs

USER astro

# Documented default; override at run-time with -e PORT=...
EXPOSE 4321

CMD ["node", "./scripts/run-standalone.mjs"]
