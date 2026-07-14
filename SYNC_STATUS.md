# SYNC_STATUS — just-public

Updated: 2026-07-14 (POC-001 Slice 1 — adapter Cloudflare + Wrangler scaffold)

## Source of truth

- Local git working tree in this repository.
- Baseline before this slice: **e70d9fb** (ADR-004 docs reference).
- Hub authority for tenants / domains / payload: **just-auth-nexus**.
- POC charter: Hub `docs/architecture/poc/POC-001-CLOUDFLARE-RUNTIME-VALIDATION.md`.

## Current state (POC-001 Slice 1)

- Active adapter: **`@astrojs/cloudflare`** (`output: server`, `imageService: "passthrough"`) — not `@astrojs/node`.
- Wrangler scaffold: `wrangler.jsonc` (`name: just-public-poc`, Workers Static Assets).
- Scripts: `cf:build`, `cf:dev`, `cf:deploy:dry-run` (dry-run only; **no deploy**).
- Artifact validated: `astro build` + `wrangler deploy --dry-run` (no publish).
- `.dev.vars.example` + `.dev.vars` gitignored; runtime env model **not** validated (Slice 2).
- Canonical renderer + theme / Hub contracts unchanged in this slice.
- Dockerfile / `.dockerignore` / `scripts/run-standalone.mjs` **preserved** as Node/Docker contingency (may not match CF build output).

## Warnings

- **No deploy performed**; Cloudflare remote / DNS not touched.
- `/health` on workerd not validated yet.
- Runtime env bindings vs `process.env` not validated yet.
- Default adapter image path pulled `sharp` into Wrangler resolve → fixed via official `imageService: "passthrough"` (**not** `nodejs_compat`).
- Adapter logs optional SESSION KV; Slice 1 did **not** add KV bindings.
- `npm test`: green (secret scan checks values/JWT/injection, not SDK JSDoc names); Node contingency `/health` skipped when Cloudflare build is active.
- Edge Function Git `7266049` (**just-auth-nexus**) still may be undeployed in Supabase.
- Do not treat Node/Docker runbook as permanently discontinued — contingency only until POC decision.

## Architecture decision

- Hub **ADR-004**: Cloudflare Workers + Static Assets + `@astrojs/cloudflare` is the strategic target.
- This slice answers: does `just-public` produce a valid Workers artifact?

## Next steps

1. **POC-001 Slice 2** — `/health` + runtime env on workerd (local).
2. Later slices — host, payload, renderer, multi-tenancy, assets remote, preview (per POC-001).
3. Deploy Hub Edge `public-site-payload` at 7266049 (Hub repo) when ready.
4. Keep Node/Docker contingency until POC success criteria pass.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
