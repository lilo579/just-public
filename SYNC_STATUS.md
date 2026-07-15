# SYNC_STATUS — just-public

Updated: 2026-07-14 (POC-001 Slice 6.5 — Preview Safety / LeadForm runtime isolation)

## Source of truth

- Local git working tree in this repository.
- Baseline before Slice 6.5: **dde7fe8** (Slice 6 isolation on `main`).
- Hub authority for tenants / domains / payload: **just-auth-nexus**.
- POC charter: Hub `docs/architecture/poc/POC-001-CLOUDFLARE-RUNTIME-VALIDATION.md`.

## Current state (POC-001 Slice 6.5)

- Active adapter: **`@astrojs/cloudflare`** (`imageService: "passthrough"`).
- **Preview Safety:** `DEPLOY_ENV=preview|staging` → lead intake safe mode (LeadForm disabled + notice; empty intake attrs).
- `DEPLOY_ENV=production` → prior LeadForm behavior (build-time `PUBLIC_LEADS_INTAKE_URL` + public anon).
- **Unknown / unset `DEPLOY_ENV`:** safe mode = **false** (not silently treated as preview; may embed build-time intake — set `preview`/`staging` for POC).
- TrackedCTA uses the same runtime gate for intake credentials (WhatsApp link UX unchanged).
- `isLeadIntakeSafeMode` in `src/lib/runtimeEnv.js` — runtime decision only.
- Isolation (Slice 6) + Static Assets (Slice 5) remain.
- No real Supabase/Edge; no KV; no `nodejs_compat`; no remote deploy/DNS.
- `npm test` uses `--test-concurrency=1` (Wrangler + mock port exclusivity).

## Warnings

- Real Edge `public-site-payload` / `tenant_id_from_host` **not** exercised (later slices / Hub deploy).
- `src/config/publicSite.ts` still has build-time production defaults (intentionally used only when not in safe mode).
- POC Issues #001 / #002: resolved in prior slices.
- Adapter may still log SESSION KV suggestion; unused.

## Architecture decision

- Hub **ADR-004**: Cloudflare Workers + Static Assets + `@astrojs/cloudflare`.
- Preview ≠ production for lead intake during POC.

## Next steps

1. **POC-001 Slice 7** — next POC-001 step (per charter).
2. Later — preview/DNS, real Edge when authorized.
3. Deploy Hub Edge `public-site-payload` at 7266049 when ready.
4. Keep Node/Docker contingency until POC success criteria pass.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
