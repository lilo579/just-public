# SYNC_STATUS — just-public

Updated: 2026-07-14 (POC-001 Slice 2 — workerd health + environment bindings)

## Source of truth

- Local git working tree in this repository.
- Baseline before Slice 2: **f03c46f** (Slice 1 Cloudflare scaffold on `main`).
- Hub authority for tenants / domains / payload: **just-auth-nexus**.
- POC charter: Hub `docs/architecture/poc/POC-001-CLOUDFLARE-RUNTIME-VALIDATION.md`.

## Current state (POC-001 Slice 2)

- Active adapter: **`@astrojs/cloudflare`** (`imageService: "passthrough"`).
- Worker runs locally via `wrangler dev` / workerd.
- **`GET /health`** validated on workerd: `200`, JSON contract, no Hub/payload I/O.
- Runtime env helper: `src/lib/runtimeEnv.js` → `locals.runtime.env`.
- Staging contract: **`DEPLOY_ENV=staging`** → `X-Robots-Tag: noindex, nofollow`.
- Non-staging / unset: no automatic robots header.
- `.dev.vars.example` documents POC vars; `.dev.vars` gitignored (never commit).
- No KV / SESSION binding added; no `nodejs_compat`.
- `wrangler.jsonc` `compatibility_date`: **2026-01-14** (validated against wrangler@4.59.2 / local workerd ceiling; earlier `2026-07-14` was unsupported).
- Dockerfile / Node scripts preserved as contingency.
- **No remote deploy / DNS.**

## Warnings

- Homepage / payload / Host multi-tenancy **not** validated on workerd (Slice 3).
- `src/config/publicSite.ts` still has build-time production URL defaults — do not hit `/` in POC smoke without overriding to a local mock.
- Adapter may still log SESSION KV suggestion; unused; do not create KV for this POC.
- Edge Function Git `7266049` (**just-auth-nexus**) may still be undeployed in Supabase.

## Architecture decision

- Hub **ADR-004**: Cloudflare Workers + Static Assets + `@astrojs/cloudflare`.
- Slice 1: valid Worker artifact. Slice 2: artifact executes + env/health proven locally.

## Next steps

1. **POC-001 Slice 3** — Host / payload / renderer path on workerd (with safe mock).
2. Later slices — multi-tenancy, assets, preview (per POC-001).
3. Deploy Hub Edge `public-site-payload` at 7266049 when ready.
4. Keep Node/Docker contingency until POC success criteria pass.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
