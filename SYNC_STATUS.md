# SYNC_STATUS — just-public

Updated: 2026-07-14 (runtime / container foundation — local only)

## Source of truth

- Local git working tree in this repository.
- HEAD of multi-tenant renderer slice: **267dd34** (prior commit on main when this foundation began).
- Hub authority for tenants / domains / payload: **just-auth-nexus**.

## Current state

- Astro SSR + `@astrojs/node` standalone, `output: server`.
- Canonical renderer + theme remain as in 267dd34.
- **Container foundation added:** Dockerfile (multi-stage), `.dockerignore`, `npm run start`, `GET /health`.
- Runtime bind via `HOST` / `PORT` (adapter-native).
- Runbook: `docs/public-runtime-runbook.md`.
- `.env.example` documents env contract (no secrets).

## Warnings

- **No deploy performed** in this slice.
- Hosting provider not selected or provisioned.
- Edge Function Git `7266049` (**just-auth-nexus**) still may be undeployed in Supabase.
- Worker and DNS (including `public-staging.justwebsites.com.br` and wildcard preview) still absent.
- Build must run inside Docker (Astro path metadata); do not ship a host-built `dist/` alone into foreign paths.

## Next steps

1. Choose / provision a Node container host (provider-agnostic contract in README).
2. Deploy Hub Edge `public-site-payload` at 7266049 (Hub repo).
3. Wire internal staging hostname + Cloudflare later.
4. Worker Router after origin + Edge + health are stable.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
