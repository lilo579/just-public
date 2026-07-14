# Public runtime runbook — just-public

Origin Astro SSR Node (`@astrojs/node` standalone). No provider-specific deploy commands.

## Prerequisites

- Node `^20.3.0 || >=22` and npm `>=9.6.5`
- Lockfile: `package-lock.json` (npm)
- Docker (optional) for container validation
- Never commit `.env` or bake secrets into images

## Local build & start

```sh
npm ci
npm run build
HOST=0.0.0.0 PORT=4321 npm run start
```

Canonical start (after build):

```sh
npm run start
```

`npm run start` runs `scripts/run-standalone.mjs`, which loads the Astro entry and exits promptly on SIGTERM/SIGINT (needed for container stop). `@astrojs/node` reads `HOST` and `PORT` from the environment. Defaults baked in the build are `host: false` → localhost and port `4321` unless overridden. **Containers must set `HOST=0.0.0.0`.**

## Health

- Route: **`GET /health`**
- Expected body: `{"status":"ok","service":"just-public"}`
- Does **not** call Supabase, Edge Functions, or require a tenant Host

```sh
curl -i http://127.0.0.1:4321/health
```

## Environment

See `.env.example`. Supply env at process or `docker run -e` / `--env-file` (external file).

| Name | Notes |
|------|--------|
| `HOST` / `PORT` | Runtime bind |
| `SUPABASE_ANON_KEY` | SSR payload calls (anon, not service role) |
| `PUBLIC_SITE_PAYLOAD_URL` | Optional override |
| `PUBLIC_DEPLOY_ENV=staging` | Adds `X-Robots-Tag: noindex, nofollow` at **runtime** via `process.env` |
| `PUBLIC_SUPABASE_*` | Catalog client; naming débit vs `SUPABASE_ANON_KEY` |

## Logs

Standalone adapter logs listening address unless `ASTRO_NODE_LOGGING=disabled`. Do not log keys, CMS payloads, or full headers. Unhandled failures surface on stderr via Node defaults.

## Host forwarding

- App source of truth: HTTP **`Host`** (or `?host=` for local/staging simulation).
- Do **not** trust arbitrary `X-Forwarded-Host` from the internet.
- Future proxy/Worker should preserve visitor Host or set Host explicitly to the tenant domain.

Staging hostname (future DNS, not created here): `public-staging.justwebsites.com.br` can use `/?host=<tenant-host>` with `PUBLIC_DEPLOY_ENV=staging`.

## Docker

```sh
npm run docker:build
docker run --rm -e HOST=0.0.0.0 -e PORT=4321 -p 4321:4321 just-public:local
```

Pass env with `-e` or `--env-file /path/to/env` — never `COPY .env`.

Build **must** happen in the image (multi-stage) so Astro path metadata under `/app` is consistent.

## Common failures

| Symptom | Check |
|---------|--------|
| Connection refused from other hosts | `HOST=0.0.0.0` set? |
| Wrong port | `PORT` env vs `-p` publish mapping |
| Homepage 502 | Payload URL / anon key / Edge deploy — not a health issue |
| Static assets 404 after copying host `dist` | Rebuild inside Docker; do not copy host-absolute `dist` alone |

## Conceptual rollback

1. Keep previous image tag / previous git commit artifact.
2. Point the host at the previous image / process.
3. Confirm `/health` then a known fixture Host.
4. No DNS change required if only the origin image rolled back.

## Pre-deploy checklist

- [ ] `npm test` and `npm run build` green
- [ ] Docker image builds
- [ ] `/health` 200 in container
- [ ] Non-root user
- [ ] Env provided externally (no secrets in image)
- [ ] Host contract understood by future proxy
- [ ] Edge Function version coordinated (Hub) — outside this repo

## Post-deploy checklist

- [ ] `/health` from the internal network
- [ ] One controlled Host or `?host=` request
- [ ] Logs free of secrets
- [ ] Restart policy verified by platform
- [ ] Rollback path identified

## Out of scope (still true)

- No hosting provider selected
- No live deploy / DNS / Cloudflare / Worker
- Hub Edge `7266049` deploy tracked in just-auth-nexus, not here
