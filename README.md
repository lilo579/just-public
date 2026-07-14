# just-public — JUST Public Layer

Shared multi-tenant Astro SSR renderer for public websites.

## Role

- **This repo** renders public HTML for any tenant using the same codebase.
- **just-auth-nexus** (Hub) owns tenants, domains, Site CMS, Site Engine, recipes, and the `public-site-payload` Edge Function.
- No per-tenant builds, repos, or Lovable forks belong here.

## Architecture decision (Hub)

Official Public Layer hosting/runtime decision lives in the Hub ADR:

- [ADR-004 — Cloudflare Workers as Public Layer Runtime](https://github.com/lilo579/just-auth-nexus/blob/main/docs/architecture/adr/ADR-004-CLOUDFLARE-RUNTIME-PUBLIC-LAYER.md)
- ADR folder index: [docs/architecture/adr/](https://github.com/lilo579/just-auth-nexus/tree/main/docs/architecture/adr)
- POC charter: [POC-001](https://github.com/lilo579/just-auth-nexus/blob/main/docs/architecture/poc/POC-001-CLOUDFLARE-RUNTIME-VALIDATION.md)

## POC-001 status

### Slice 1 — adapter + Wrangler scaffold

Active adapter: **`@astrojs/cloudflare`** (SSR → Cloudflare Workers + Workers Static Assets).  
Scaffold: `wrangler.jsonc` (`just-public-poc`).

### Slice 2 — workerd health + environment bindings

Validated locally on Wrangler/workerd (**no remote deploy**):

- `GET /health` → `200` + `{"status":"ok","service":"just-public"}` with no Hub/payload/tenant I/O
- Worker runtime env via `locals.runtime.env` (wrangler `--var` / `.dev.vars` / `.env`)
- Canonical flag: **`DEPLOY_ENV=staging`** → `X-Robots-Tag: noindex, nofollow`
- Unset / `production` / other → no automatic `X-Robots-Tag`
- Node contingency alias only: `PUBLIC_DEPLOY_ENV` (not the Worker canonical name)

### Slice 3 — Host resolution on workerd

Validated locally against a **mock** payload (**no** real Supabase/Edge):

- Canonical Workers host: `new URL(request.url).hostname`
- Defensive fallback: HTTP `Host` when URL hostname is missing/invalid/local listen address
- Explicit simulation: `?host=` (highest precedence; normalized)
- Never trust `X-Forwarded-Host` / `Forwarded`
- Normalization: lowercase, strip port / trailing dot, reject URL/path/whitespace
- Homepage fetch uses runtime bindings `PUBLIC_SITE_PAYLOAD_URL` + `SUPABASE_ANON_KEY` (no production default on this path)

Not validated yet (Slice 4+): real payload contract, renderer/theme, full alpha/beta content isolation, remote assets/DNS.

Helper: `src/lib/runtimeEnv.js` (server-only; no production defaults).  
Copy `.dev.vars.example` → `.dev.vars` for local secrets (gitignored).

```sh
npm run cf:build
npm run cf:dev              # build + wrangler dev (local workerd)
curl -i http://127.0.0.1:8787/health
# Host smoke (requires mock PUBLIC_SITE_PAYLOAD_URL — never production):
# curl -i -H 'Host: alpha.justwebsites.com.br' http://127.0.0.1:8787/
npm run cf:deploy:dry-run   # analyzes artifact; does not publish
```

Node/Docker files remain **contingency**, not dual-active deploy targets.
## Runtime (active: Cloudflare adapter)

- Astro 5 SSR
- `@astrojs/cloudflare` — `output: "server"`
- Worker entrypoint after build: `dist/_worker.js/index.js`
- Static assets directory: `dist/` (Wrangler `assets.directory`)

### Node / Docker contingency

Preserved locally; not the active POC build path:

- `npm run start` → `scripts/run-standalone.mjs` (historically `dist/server/entry.mjs` under `@astrojs/node`)
- `HOST` / `PORT` for container bind when that path is restored or dual-target is explicitly authorized

```sh
HOST=0.0.0.0 PORT=4321 npm run start
```

### Health

- **`GET /health`**
- Body: `{"status":"ok","service":"just-public"}`
- No Supabase / Edge / tenant dependency
- Proven on workerd (Slice 2); homepage Host path (Slice 3) uses runtime payload bindings against a **local mock** only

```sh
# after npm run cf:dev (default wrangler port often 8787)
curl -i http://127.0.0.1:8787/health
```

### Environment (Workers / Slice 2)

| Variable | Source | Notes |
|----------|--------|-------|
| `DEPLOY_ENV` | runtime binding | `staging` → noindex; canonical |
| `PUBLIC_DEPLOY_ENV` | Node contingency only | fallback if `DEPLOY_ENV` absent |
| `PUBLIC_SITE_PAYLOAD_URL` | runtime binding (future fetch) | use local mock in POC; do not commit real `.dev.vars` |
| `SUPABASE_ANON_KEY` | runtime binding (future fetch) | placeholder locally; never service role |

`import.meta.env` remains **build-time** (Vite). Do not rely on it for Worker runtime bindings.
## Request flow

```
Host HTTP
  → Astro SSR (just-public)
  → public-site-payload?host=<host>&mode=public|preview
  → Hub: public.tenant_id_from_host(host)
  → gates + HomepageSource / serializablePlan
  → CanonicalHomepageRenderer
  → site_branding → CSS custom properties
  → HTML response
```

### How Host is read (POC-001 Slice 3)

Precedence:

1. `?host=` — explicit local/preview simulation only (normalized; invalid → `400` before fetch).
2. `new URL(request.url).hostname` — **canonical on Workers** (wrangler rewrites URL from `Host` in local probes).
3. HTTP `Host` header — defensive fallback when URL hostname is missing, invalid, or a local listen address (`127.0.0.1` / `localhost`).

Never trust `X-Forwarded-Host` / `Forwarded`. Never invent a default tenant domain.

### Proxy / Worker contract (future)

The future proxy or Worker must:

- preserve the visitor Host, **or**
- set `Host` explicitly to the tenant hostname the Astro app should resolve;
- not forward untrusted `X-Forwarded-Host` without an explicit trust boundary;
- (later) propagate a request ID.

## Docker

Build happens **inside** the image (Astro embeds path metadata).

```sh
npm run docker:build
docker run --rm \
  -e HOST=0.0.0.0 \
  -e PORT=4321 \
  -p 4321:4321 \
  just-public:local
```

Provide runtime env with `-e` / `--env-file` pointing at a host file. **Never** copy `.env` into the image.

See [docs/public-runtime-runbook.md](docs/public-runtime-runbook.md).

## Deploy contract (provider-agnostic)

A future host must supply:

- Node container (this Dockerfile or equivalent)
- `PORT` (and typically `HOST=0.0.0.0`)
- TLS termination or Cloudflare in front
- automatic restart
- log capture
- health check against `/health`
- deploy by image digest / git commit
- rollback to previous image
- an internal hostname (e.g. future `public-staging.justwebsites.com.br` — **DNS not created here**)

Optional (Node contingency): `PUBLIC_DEPLOY_ENV=staging` → `X-Robots-Tag` via process.env fallback.  
Workers canonical: `DEPLOY_ENV=staging` (see Slice 2).

## Environment

See `.env.example` and `.dev.vars.example`. Summary:

| Variable | Scope | Notes |
|----------|-------|-------|
| `HOST`, `PORT` | Node process | Bind (contingency) |
| `DEPLOY_ENV` | Worker runtime | `staging` → noindex (canonical) |
| `PUBLIC_DEPLOY_ENV` | Node contingency | Fallback if `DEPLOY_ENV` absent |
| `SUPABASE_ANON_KEY` | SSR / Worker binding | Anon only — never service role |
| `PUBLIC_SITE_PAYLOAD_URL` | build-time + future runtime | Prefer local mock in POC |
| `PUBLIC_LEADS_INTAKE_URL` | public | Leads |
| `PUBLIC_ALLOW_LEGACY_RENDERER` | SSR | Explicit legacy gate |
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` | catalog client | Naming débit vs `SUPABASE_ANON_KEY` |

## Local development

```sh
npm ci
npm run dev
```

Simulate tenants with `/?host=...` (see runbook).

## Commands

```sh
npm test                 # node:test (includes local workerd health/env)
npm run build            # Astro production build (Cloudflare Worker artifact)
npm run cf:build         # alias of build
npm run cf:dev           # build + wrangler dev (local)
npm run cf:deploy:dry-run
npm run start            # Node contingency (may not match CF dist layout)
npm run docker:build     # Docker contingency (kept; not dual-target for CF)
npm run docker:run
```

## Current limitations

- POC-001 Slice 3: Host resolution + mock payload on workerd; **no Cloudflare deploy/DNS**.
- Real Edge payload / renderer / theme not yet validated (Slice 4+).
- Hub Edge Function commit `7266049` may not yet be deployed (tracked in Hub).
- Content model remains flat (`site_content` / branding / contact).

See `SYNC_STATUS.md`.
