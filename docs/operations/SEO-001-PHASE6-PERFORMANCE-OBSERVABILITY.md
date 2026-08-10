# SEO-001 Phase 6 — Performance, observability, request-scoped reuse

| Campo | Valor |
|-------|-------|
| **ADR** | ADR-SEO-001 |
| **Phase** | 6 |
| **Date** | 2026-08-09 |
| **Scope** | `just-public` Public Layer only |
| **Status** | Implemented (no production deploy / no primary flip) |

## Architecture (request-scoped)

```text
Request
  → middleware.resolvePublicRequestContext()
       • resolve physical Host (never ?host= for authority redirects)
       • load public-site-payload once (Promise dedupe on locals)
       • parse/validate canonical contract
       • stash: locals.publicRequestContext / publicSitePayload / publicCanonical
       • production public_page: gate 422|503|404 (fail closed)
       • production: alias/path redirect 301 when needed
  → page / loader
       • reuse locals.publicSitePayload / publicCanonical
       • no second payload/RPC for the same host
  → response
       • optional Server-Timing (preview/staging or PUBLIC_SERVER_TIMING=true)
       • structured logs once per resolution
```

`Astro.locals` is the **only** authority cache. No module globals, no `caches.default`, no KV, no shared TTL.

Helper: `src/lib/publicRequestContext.js` → `resolvePublicRequestContext()`.

## Before / after fetch counts (representative routes)

Counts are **payload** (`public-site-payload`) and **RPC** (`public_host_canonical_authority`) under production with Edge payload available.

| Route | Before (payload / RPC) | After (payload / RPC) | Notes |
|-------|------------------------|------------------------|-------|
| `/` (primary) | 2 / 0 | **1 / 0** | middleware + homepage reused locals |
| `/` (alias) | 1 / 0 | **1 / 0** | middleware redirects; page skipped |
| `/sobre` | 2 / 0 | **1 / 0** | middleware + chrome loader reuse |
| `/catalogo` | 2 / 0 | **1 / 0** | same |
| `/p/[slug]` | 2 / 0 | **1 / 0** | chrome reuse |
| `/c` | 1 / 1 | **1 / 0** | canonical from locals; products RPC unchanged |
| `/robots.txt` | 1 / 0 | **1 / 0** (0 if reused) | context from middleware |
| `/sitemap.xml` | 1 / 0 | **1 / 0** (0 if reused) | same |
| `/homepage` | 1 / 0 | **1 / 0** | combined into primary redirect |
| preview/staging | 1 / 0 | **1 / 0** | no alias redirect; may omit canonical |
| assets / `/health` | 0 / 0 | **0 / 0** | no authority work |

Audit method: instrumented counters on `PublicRequestContext.counters` + mock `calls` in workerd Phase 6 tests.

## Failure policy

| Condition | Status | Code | Headers |
|-----------|--------|------|---------|
| Missing primary / null canonical (prod indexable) | 422 | `missing_primary_domain` | `no-store`, `X-Robots-Tag: noindex, nofollow` |
| Transient authority / payload failure | 503 | `canonical_authority_unavailable` | same |
| Unknown host | 404 | `host_not_resolved` | same (no tenant leak) |
| Preview/staging | 200 allowed without primary | — | always `noindex`; never invent request-host canonical |
| Assets / health | unaffected | — | health remains cheap |

Robots/sitemap on failure: restrictive (`Disallow: /` or empty urlset / error response), never request-host permissive sitemap. Alias without authority does not invent redirect targets.

## Observability events (no PII)

| Event | When |
|-------|------|
| `canonical_resolution` | once per resolved context |
| `canonical_resolution_failed` | non-ok results |
| `canonical_redirect` | 301 plan emitted |
| `public_payload_reused` | locals/promise hit |
| `canonical_context_reused` | context/locals reuse |

Allowed fields: normalized request host, canonical host, pathname, route kind, resolution source (`payload`\|`rpc`\|`locals`), result, status, durationMs, redirect reason, deployEnv, tenantId only when already known.

Never log: full query, forms, cookies, Authorization, content payload, personal data.

## Server-Timing

Emitted when `DEPLOY_ENV` is preview/staging **or** `PUBLIC_SERVER_TIMING=true`:

```text
Server-Timing: canonical;dur=…, payload;dur=…, host;dur=…
```

**Production default:** off (structured logs only). No internal parameters or secrets in the header.

## Cache policy (Phase 6)

**Allowed now**

- request-scoped `Astro.locals`
- in-flight Promise dedupe within the request
- existing short redirect `Cache-Control` (no increase)

**Forbidden now** (before Phase 7 primary flip)

- shared Edge/module TTL for authority
- `caches.default` / KV authority store
- browser reliance for authority correctness

### Future shared-cache proposal (do not implement yet)

1. Key: `canonical-authority:v{N}:{normalizedHost}`
2. TTL: short (e.g. 30–60s) + soft TTL optional
3. Version `N` bumps on contract change
4. Purge/invalidate **all host keys for tenant** on `is_primary` flip
5. Never cache cross-tenant; never store full payload content in shared cache
6. Fail closed on purge uncertainty during flip window

## Risks

- Middleware fail-closed changes production behavior for hosts without primary (intentional).
- `/c` still needs Supabase for product RPC; canonical path no longer doubles authority RPC when locals filled.
- Preview without payload still safe/noindex; do not treat as production SEO.
- Stale shared cache remains the main Phase 7 hazard — keep shared cache off until purge plan is live.

## Phase 7 preparation (no enforcement yet)

- Keep shared authority cache **off** until purge + readiness checker green.
- Coordinate primary flips with Cloudflare one-hop and Search Console (out of this phase).
- Deploy Public Layer Phase 6 before any linked primary migration.

## Deploy gate (updated)

```text
DO NOT PROCEED TO PHASE 7 / PRIMARY FLIP before:
1. no duplicate canonical fetch per request;
2. transient authority failures are noindex/no-store;
3. logs and timings validated in staging;
4. cache purge plan ready before primary flip.
```

Also retain prior Phase 3–5 gates (structure migrations, Edge compatibility, Cloudflare one-hop prepared, rollback snapshots).

## Files (Phase 6 core)

- `src/lib/publicRequestContext.js`
- `src/middleware.ts`
- `src/env.d.ts`
- `src/pages/index.astro`, `robots.txt.ts`, `sitemap.xml.ts`, `c.astro`, `health.ts`
- `src/lib/loadCatalogPublicChrome.js`, `loadJustInstitutionalChrome.js`
- `src/lib/canonicalAuthority.js` (`missing_primary_domain`)
- tests: `public-request-context.test.mjs`, `workerd-seo001-phase6-platform.test.mjs`
- fixtures: SEO001 A/B matrix + missing/unavailable hosts
