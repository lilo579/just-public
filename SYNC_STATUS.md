# SYNC_STATUS — just-public

Updated: 2026-07-15 (IMPLEMENTATION-001 **CF-004** — remote canonical renderer + POC fixtures)

## Source of truth

- Local git working tree (uncommitted CF-004 changes).
- Canonical commit before this slice: **7962e2f** (`origin/main`).
- Hub charters: IMPLEMENTATION-001; CF-003 report (`just-auth-nexus` @ `4aceb1a`).

## Current state (CF-004 COMPLETE — awaiting Hub report / commit auth)

### Fixture mode

Dual gate (both required):

- `DEPLOY_ENV=preview`
- `POC_FIXTURE_MODE=true` (exact string after trim)

Default / staging / production / ambiguous flags → fixtures **off** → normal payload fetch (503 without URL).

Runtime module: `src/poc/publicSiteFixtures.js` (Alpha/Beta/Gamma only). Temporary retain until formal CF-004 closeout decision.

### Remote Worker

| Field | Value |
|-------|--------|
| Worker | `just-public-poc` |
| Bootstrap Version (100% deploy) | `3047d28b-9830-4a10-8104-6d783f57ef4f` |
| Bootstrap Deployment | `acd84566-094b-4a29-8215-5de883c51b19` |
| CF-004 Astro Version | `166faa56-eb39-4f6d-9458-f8232e927546` (**0%** normal traffic) |
| Preview URL | `https://166faa56-just-public-poc.lilo579.workers.dev` |
| Prior CF-003 Preview Version | `ac18d718-f7a5-402e-9123-19614b278449` |
| `workers_dev` | false (normal hostname 1042) |
| `previews_enabled` | true |
| Routes / Domains / DNS | 0 / 0 / unchanged |

### Remote matrix

| Host | Status | Renderer | Branding |
|------|--------|----------|----------|
| alpha.justwebsites.com.br | 200 | canonical | Alpha / `#112233` |
| beta.justwebsites.com.br | 200 | canonical | Beta / `#aa5500` |
| gamma.justwebsites.com.br | 200 | canonical | Gamma / `#008866` |

Sequence A→B→G→A→G→B and concurrency A\|\|B\|\|G: PASS isolation.  
unknown → 404 · invalid `?host=https://…` → 400.  
LeadForm `data-lead-form-safe="true"`; TrackedCTA `leadsUrl=""`; no Supabase/prod payload fetch.

### Local gate

`npm test` / `build` / `wrangler deploy --dry-run` green. Upload size ~1164 KiB / gzip ~241 KiB; bindings ASSETS + `DEPLOY_ENV=preview` + `POC_FIXTURE_MODE=true`.

## Warnings

### Robots

| Surface | Observed |
|---------|----------|
| workerd (app middleware) | `noindex, nofollow` |
| Cloudflare Preview URL | `noindex` (platform) |

Classification: **non-blocking**. No additional robots workaround in CF-004.

### Fixture lifecycle

POC fixtures **kept temporarily** under the dual gate for remote regression, Versions validation, future CI, and provable isolation. Default gate is false; production cannot activate them. Removal / formal harness promotion deferred.

- Preview URL logs still unavailable via `wrangler tail`.
- Local `.env` may contain payload URL keys for Node contingency — Worker runtime SoT remains wrangler vars; fixture/gates tests blank payload vars.

## Architecture decision

- CF-004 Strategy C succeeded with **dual-gated in-Worker POC fixtures** (not production Edge).
- No `versions deploy`; bootstrap Deployment intact.

## Next steps

1. Hub: CF-004 evidence report (separate repo).
2. **CF-005** — rollback proof (POC/staging surface).
3. Fixture lifecycle remains **keep temporarily** until a later removal/harness decision.

## Do not overwrite

- Homepage / payload Hub contracts.
- Customer DNS / Cloudflare without explicit ops task.
- Unrelated Hub finance scripts.
