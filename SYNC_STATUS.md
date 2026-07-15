# SYNC_STATUS — just-public

Updated: 2026-07-15 (IMPLEMENTATION-001 **CF-003** — Astro Version + Preview URL smoke)

## Source of truth

- Local git working tree in this repository (uncommitted CF-003 docs + `wrangler.jsonc`).
- Canonical commit baseline: **5629bb6** (`origin/main`).
- Hub charters: IMPLEMENTATION-001, POC-002, CF-001/CF-002 reports (`just-auth-nexus` @ `d86e3db`).

## Pre-existing local dirt (before CF-003)

Uncommitted `README.md` / `SYNC_STATUS.md` from **POC-001 Slice 7** (2026-07-14) recorded auth blocker. Those notes are superseded below; content consolidated into CF-003 outcome. No `git reset`/`stash` was used.

## Current state (CF-003 COMPLETE locally uncommitted)

### Remote Worker

| Field | Value |
|-------|--------|
| Worker | `just-public-poc` |
| Account | `Lilo579@gmail.com's Account` |
| Bootstrap Version | `3047d28b-9830-4a10-8104-6d783f57ef4f` (**still 100% active deployment**) |
| Bootstrap Deployment | `acd84566-094b-4a29-8215-5de883c51b19` |
| Astro candidate (with Preview) | `ac18d718-f7a5-402e-9123-19614b278449` |
| Earlier Astro upload (pre-enable) | `fa410a36-0a55-47af-b4b5-d57cf7df6b0c` (no Preview route until enable+reupload) |
| Preview URL | `https://ac18d718-just-public-poc.lilo579.workers.dev` |
| `workers_dev` (Worker hostname) | **false** (`just-public-poc.lilo579.workers.dev` → HTTP 1042) |
| `previews_enabled` | **true** (enabled after first upload; see procedure note) |
| Routes / Custom Domains / DNS | **0 / 0 / unchanged** |
| Astro traffic on normal deploy | **0%** (not promoted) |

### Local config (CF-003)

`wrangler.jsonc`: `name=just-public-poc`, `workers_dev=false`, `preview_urls=true`, `vars.DEPLOY_ENV=preview`, ASSETS binding, compatibility_date `2026-01-14`, no routes/domains/KV/D1/R2/Queues/DO/`nodejs_compat`.

### Remote smoke (Preview URL)

- `/health` → 200 JSON `{status,service}` + `cache-control: no-store` + platform `X-Robots-Tag: noindex`
- `/_astro/*.css`, favicons → 200
- missing asset → 404
- `/_worker.js/index.js` → 404 (not public)
- `/_routes.json` → 404 (not public asset)
- `/` → 503 `PUBLIC_SITE_PAYLOAD_URL missing` (controlled; no Supabase call)
- Renderer remote → **NOT TESTED** (Strategy C; no safe remote fixture)
- `wrangler tail` → no Preview URL events observed (platform limitation confirmed)

### Procedure discovery (document)

`wrangler versions upload` does **not** apply subdomain/`preview_urls` settings. Enabling Preview required official subdomain API `POST` with `{enabled:false, previews_enabled:true}` (keeps normal `workers.dev` off). A Version uploaded **before** that enable did not get a usable Preview URL; re-upload after enable produced Version Preview URL.

## Warnings

- Middleware app tag: `DEPLOY_ENV=preview|staging` → `X-Robots-Tag: noindex, nofollow`; production/unset/unknown → no app header (Preview may still show Cloudflare platform `noindex`).
- `src/config/publicSite.ts` still has build-time production URL **names** for leads; gated empty under safe mode; homepage payload uses runtime binding only (no production default fetch).
- Adapter may log SESSION KV suggestion; unused.

## Architecture decision

- Hub ADR-004 + POC-002: Versions ≠ Deployments; bootstrap deploy exception already done in CF-002.
- CF-003: Astro via `versions upload` only; no `versions deploy`.

## Next steps

1. Hub: register CF-003 evidence report when authorized.
2. **CF-004** — remote validation matrix on Preview URL (renderer still needs safe fixture strategy).
3. Do **not** `versions deploy` / DNS / Routes / Custom Domains without later authorization.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
- Uncommitted work must **not** be committed/pushed until explicitly authorized.
