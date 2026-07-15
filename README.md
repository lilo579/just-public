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

### Slice 4 — payload, Canonical Renderer, theme on workerd

Validated locally with **canonical mock fixtures** (Alpha / Beta — **no** real Edge/Supabase):

- Mock respects `ResolvedHomepage` + `serializablePlan` consumed by Astro
- `CanonicalHomepageRenderer` path (`data-renderer="canonical"`); legacy not used
- Theme tokens via `themeFromBranding` / `SiteTheme` (`--site-color-primary`, etc.)
- Alpha/Beta HTML + theme isolation (including consecutive requests)
- Controlled errors: unknown host, missing plan, malformed JSON; bad branding → safe defaults
- Basic `/_astro/*.css` asset 200

### Slice 5 — Workers Static Assets (local)

Validated locally on workerd (**no remote deploy / DNS / CF cache**):

- Inventory: `dist/_astro/*.css`, favicons, `_routes.json` (routing meta; ignored as asset), Worker under `dist/_worker.js/` (entrypoint — **not** public)
- `public/.assetsignore` excludes `_worker.js` + `_routes.json` from Static Assets (factual fix: entrypoint was publicly reachable)
- Referenced CSS/JS (if any) + favicons: HTTP 200, correct MIME, shared across Alpha/Beta
- Missing `/_astro/does-not-exist.js` → controlled 404 (not homepage, no payload call)
- Safe path probes do not expose Worker sources
- Theme tokens remain in SSR HTML (inline); shared CSS has zero Alpha/Beta-specific values
- No `nodejs_compat`; no SPA fallback; no HTML cache policy added
- LeadForm: no auto leads calls on asset load; service_role absent (build-time leads URL issue remains remote-preview blocker only)

### Slice 6 — multi-tenant isolation (local)

Validated on workerd with fictitious **Alpha / Beta / Gamma** mock fixtures (**no** real Edge/Supabase):

- Long sequences, repeats, ping-pong, concurrency waves, and alternating stress — zero cross-tenant HTML/theme/payload
- Mock logs `timestamp`, `host`, `tenant`, `mode`, `status` per payload request
- Renderer always `data-renderer="canonical"` (never legacy)
- Shared Static Assets (same CSS/favicon URLs); tenant branding only in SSR HTML
- Source audit: no mutable module-level tenant state on homepage/theme path
- Immutable theme `DEFAULTS` / font allowlists are shared constants (not tenant state)

### Slice 6.5 — Preview Safety (LeadForm runtime isolation)

Preview ≠ production for lead intake on workerd (**no** remote deploy):

- `DEPLOY_ENV=preview|staging` → LeadForm **safe mode** (disabled + notice; no production leads URL / anon key in HTML)
- `DEPLOY_ENV=production` → prior LeadForm intake behavior preserved (build-time `PUBLIC_LEADS_INTAKE_URL`)
- Unknown/unset `DEPLOY_ENV` → **not** safe mode (not silent preview; set `preview`/`staging` for POC)
- TrackedCTA WhatsApp tracking uses the same runtime intake gate (link UX unchanged; no production POST in preview/staging)
- Helper: `isLeadIntakeSafeMode` in `src/lib/runtimeEnv.js` (runtime only; no permanent feature flag)
- Component stays rendered; no service_role; no real Supabase calls in POC

### Slice 7 / CF-003 — Remote Astro Version Preview

Earlier Slice 7 attempt (2026-07-14) was **blocked** on Wrangler auth. Auth restored; Cloudflare Foundation CF-002 bootstrapped `just-public-poc`. **CF-003** (2026-07-15) completed remote Astro Version + Preview smoke on commit baseline `5629bb6` (published as `7962e2f`).

| Field | Value |
|-------|--------|
| Worker | `just-public-poc` |
| Astro Version (Preview) | `ac18d718-f7a5-402e-9123-19614b278449` |
| Intermediate Version | `fa410a36-0a55-47af-b4b5-d57cf7df6b0c` (upload before Preview enable) |
| Preview URL (CF-003) | `https://ac18d718-just-public-poc.lilo579.workers.dev` |
| Bootstrap deployment | still 100% → `3047d28b-9830-4a10-8104-6d783f57ef4f` |
| Astro candidate normal traffic | **0%** |
| `workers_dev` | false (normal hostname 1042) |
| `preview_urls` / `previews_enabled` | true |
| Remote `/health` | 200 |
| Static Assets | CSS/favicons 200; entrypoint/`_routes.json` not public |
| Renderer remote | advanced in **CF-004** |
| Preview logs (`wrangler tail`) | not available (platform limitation) |
| DNS / Route / Custom Domain | none |
| Promotion | **none** |

### CF-004 — Remote canonical renderer + POC fixtures

Dual gate: `DEPLOY_ENV=preview` **and** `POC_FIXTURE_MODE=true`. Module: `src/poc/publicSiteFixtures.js`.

| Field | Value |
|-------|--------|
| Astro Version (CF-004) | `166faa56-eb39-4f6d-9458-f8232e927546` |
| Preview URL | `https://166faa56-just-public-poc.lilo579.workers.dev` |
| Bootstrap deployment | **unchanged** 100% → `3047d28b-…ef4f` |
| Alpha / Beta / Gamma | 200 · `data-renderer="canonical"` · distinct branding |
| Isolation | sequence + concurrency PASS |
| unknown / invalid host | 404 / 400 |
| LeadForm safe | `data-lead-form-safe="true"` |
| Real Supabase / Edge / leads | **none** |
| Fixture lifecycle | **keep temporarily** (Preview-only gate) |

#### Robots (CF-003 / CF-004)

| Surface | `X-Robots-Tag` observada |
|---------|--------------------------|
| workerd / app middleware (`DEPLOY_ENV=preview\|staging`) | `noindex, nofollow` |
| Cloudflare Preview URL (platform) | `noindex` |

Classificação: **não bloqueadora** (não há workaround adicional no CF-004).

#### Fixture lifecycle

POC fixtures in `src/poc/publicSiteFixtures.js` are **kept temporarily** for remote regression, Versions validation, future CI, and provable isolation. Gate default is false; production cannot activate them. Removal or promotion to a formal harness is a later decision.

### CF-005 — Deployment / rollback

Validated remotely: promote CF-004 → rollback Bootstrap (`just-public` unchanged @ `7932a67`). Active Deployment restored to Bootstrap 100%. Hub report: CF-005.

### CF-006 — Controlled CI/CD (Preview Version upload)

Workflow: `.github/workflows/cloudflare-preview-version.yml`  
Trigger: **`workflow_dispatch` only**.  
Environment: `cloudflare-preview`.

```
npm ci → policy gate → npm run build → npm test → wrangler deploy --dry-run
  → wrangler versions upload
  → parse Version ID + Preview URL
  → smoke A/B/G + assets + negatives
  → assert active Deployment unchanged (Bootstrap 100%)
```

| Item | Value |
|------|--------|
| Decision | Explicit `npx wrangler` (not default `cloudflare/wrangler-action` deploy) |
| Secrets | `CLOUDFLARE_API_TOKEN` (name only) |
| Variables | `CLOUDFLARE_ACCOUNT_ID` |
| Promotion | **forbidden** |
| First remote run | **PASS** (`29440565313`) — Version `f3d2721d-…` · Bootstrap still 100% |
| Workerd coverage (1º run) | **incomplete** — `npm test` before `build` skipped workerd (`dist/_worker.js` missing) |
| Fix | workflow order **build → test** (this change) |
| Second remote run | **pending** after push |

Next: second `workflow_dispatch` to certify full workerd coverage · then CF-007.

Helper: `src/lib/runtimeEnv.js` (server-only; no production defaults).  
Copy `.dev.vars.example` → `.dev.vars` for local secrets (gitignored).

```sh
npm run cf:build
npm run cf:dev              # build + wrangler dev (local workerd)
curl -i http://127.0.0.1:8787/health
# Fixture smoke (requires DEPLOY_ENV=preview + POC_FIXTURE_MODE=true):
# curl -i 'http://127.0.0.1:8787/?host=alpha.justwebsites.com.br'
npm run cf:deploy:dry-run   # analyzes artifact; does not publish
# Remote CF-004 (auth required — never wrangler deploy / versions deploy):
# npx wrangler versions upload
# curl -i 'https://<8hex>-just-public-poc.lilo579.workers.dev/?host=alpha.justwebsites.com.br'
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

- CF-004: Alpha/Beta/Gamma remote Preview **PASS** with dual-gated POC fixtures; no real Supabase/Edge.
- Bootstrap Deployment still serves the CF-002 hello Script at 100%; Astro Versions are Preview-only (0% normal traffic).
- App middleware: `DEPLOY_ENV=preview|staging` → `X-Robots-Tag: noindex, nofollow` on workerd; Preview URL hosts may surface platform `noindex` only.
- Production build-time leads defaults remain for `DEPLOY_ENV=production` only (gated empty in preview safe mode).
- Hub Edge Function commit `7266049` may not yet be deployed (tracked in Hub).
- Content model remains flat (`site_content` / branding / contact).
- Preview URL logs not available via `wrangler tail` (Cloudflare platform limitation).
- POC fixtures kept **temporarily** under dual gate until formal removal decision.

See `SYNC_STATUS.md`.
