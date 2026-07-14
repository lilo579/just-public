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

## POC-001 Slice 1 (adapter + Wrangler scaffold)

Active adapter: **`@astrojs/cloudflare`** (SSR → Cloudflare Workers + Workers Static Assets).  
Scaffold: `wrangler.jsonc` (`just-public-poc`). **No deploy performed** in this slice.

Not validated yet (Slice 2+):

- `/health` on workerd
- runtime env / Wrangler bindings vs `process.env`
- host / renderer / multi-tenancy under Workers
- remote assets / preview URL

Node/Docker files (`Dockerfile`, `.dockerignore`, `scripts/run-standalone.mjs`, `npm run start`) remain as **contingency**; they are not dual-active deploy targets. After the adapter switch, the Node standalone path may not match the new build output until revisited.

`.dev.vars.example` is for Wrangler local vars only; runtime env model is Slice 2.

```sh
npm run cf:build
npm run cf:deploy:dry-run   # analyzes artifact; does not publish
# npm run cf:dev            # local workerd prep for Slice 2 (build + wrangler dev)
```

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

```sh
curl -i http://127.0.0.1:4321/health
```

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

### How Host is read

1. Prefer query `?host=` (local / staging simulation).
2. Else use the HTTP `Host` header (port stripped).
3. Do **not** trust arbitrary `X-Forwarded-Host` from the public internet.
4. Pass that host to `public-site-payload` — never invent a default tenant domain.

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

Optional: `PUBLIC_DEPLOY_ENV=staging` → `X-Robots-Tag: noindex, nofollow`.

## Environment

See `.env.example`. Summary:

| Variable | Scope | Notes |
|----------|-------|-------|
| `HOST`, `PORT` | process | Bind |
| `SUPABASE_ANON_KEY` | SSR | Anon key for payload (not service role) |
| `PUBLIC_SITE_PAYLOAD_URL` | public default/override | Edge URL |
| `PUBLIC_LEADS_INTAKE_URL` | public | Leads |
| `PUBLIC_ALLOW_LEGACY_RENDERER` | SSR | Explicit legacy gate |
| `PUBLIC_DEPLOY_ENV` | SSR middleware | `staging` → noindex |
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` | catalog client | Naming débit vs `SUPABASE_ANON_KEY` |

## Local development

```sh
npm ci
npm run dev
```

Simulate tenants with `/?host=...` (see runbook).

## Commands

```sh
npm test                 # node:test
npm run build            # Astro production build (Cloudflare Worker artifact)
npm run cf:build         # alias of build
npm run cf:deploy:dry-run
npm run start            # Node contingency (may not match CF dist layout)
npm run docker:build     # Docker contingency (kept; not dual-target for CF)
npm run docker:run
```

## Current limitations

- POC-001 Slice 1 only: Worker artifact + Wrangler scaffold; **no Cloudflare deploy/DNS**.
- Runtime env and `/health` on workerd not validated (Slice 2).
- Hub Edge Function commit `7266049` may not yet be deployed (tracked in Hub).
- Content model remains flat (`site_content` / branding / contact).

See `SYNC_STATUS.md`.
