# SYNC_STATUS — just-public

Updated: 2026-07-14 (POC-001 Slice 3 — Host resolution on Workers Runtime)

## Source of truth

- Local git working tree in this repository.
- Baseline before Slice 3: **3fa85b5** (Slice 2 health + runtime env on `main`).
- Hub authority for tenants / domains / payload: **just-auth-nexus**.
- POC charter: Hub `docs/architecture/poc/POC-001-CLOUDFLARE-RUNTIME-VALIDATION.md`.

## Current state (POC-001 Slice 3)

- Active adapter: **`@astrojs/cloudflare`** (`imageService: "passthrough"`).
- Host resolution on workerd (mock payload only):
  - Prefer `?host=` (simulation) → `URL.hostname` → `Host` fallback
  - Normalize: lowercase, strip port / trailing dot; reject URL/path/empty/whitespace
  - Ignore `X-Forwarded-Host`
- Homepage fetch uses runtime bindings `PUBLIC_SITE_PAYLOAD_URL` / `SUPABASE_ANON_KEY` (no production default on this path).
- `/health` + `DEPLOY_ENV` staging robots remain as Slice 2.
- `wrangler.jsonc` `compatibility_date`: **2026-01-14** (validated).
- No KV / `nodejs_compat` / remote deploy / DNS.
- `npm test` uses `--test-concurrency=1` because workerd suites spawn local Wrangler + HTTP mock servers on ephemeral ports; parallel files contended for those processes/ports (not used to hide flaky assertions).
- Dockerfile / Node scripts preserved as contingency.

## Warnings

- Real `public-site-payload` / renderer / theme **not** validated (Slice 4+).
- `src/config/publicSite.ts` still has build-time production defaults for non-homepage paths (leads/catalog) — homepage SSR path does not use them.
- Adapter may still log SESSION KV suggestion; unused.
- Edge Function Git `7266049` (**just-auth-nexus**) may still be undeployed in Supabase.

## Architecture decision

- Hub **ADR-004**: Cloudflare Workers + Static Assets + `@astrojs/cloudflare`.
- POC Issue #001 (Host header vs URL.hostname): **resolvida** for Workers — URL.hostname is canonical; on workerd local probes with `Host:`, URL and header align; Host remains defensive fallback for local listen addresses.

## Next steps

1. **POC-001 Slice 4** — payload path / contract against mock or safe staging Edge (per POC-001).
2. Later slices — renderer, multi-tenant content isolation, assets, preview.
3. Deploy Hub Edge `public-site-payload` at 7266049 when ready.
4. Keep Node/Docker contingency until POC success criteria pass.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
