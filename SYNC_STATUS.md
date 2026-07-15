# SYNC_STATUS — just-public

Updated: 2026-07-14 (POC-001 Slice 6 — multi-tenant isolation on workerd)

## Source of truth

- Local git working tree in this repository.
- Baseline before Slice 6: **23fb240** (Slice 5 Static Assets on `main`).
- Hub authority for tenants / domains / payload: **just-auth-nexus**.
- POC charter: Hub `docs/architecture/poc/POC-001-CLOUDFLARE-RUNTIME-VALIDATION.md`.

## Current state (POC-001 Slice 6)

- Active adapter: **`@astrojs/cloudflare`** (`imageService: "passthrough"`).
- Isolation proven for fictitious **Alpha / Beta / Gamma** on a single Worker (workerd + mock payload).
- Sequences, concurrency, repeatability, and alternating stress: zero cross-tenant content/theme/payload.
- Mock records per request: `timestamp`, `host`, `tenant`, `tenantKey`, `mode`, `status`.
- Renderer always canonical; shared assets; tenant-specific HTML/theme only.
- Source audit: no mutable shared Maps/singletons/module `let` state on homepage/theme path.
- Theme `DEFAULTS` are immutable shared constants (safe).
- Slices 2–5 capabilities unchanged (host, env, assets `.assetsignore`, renderer).
- No real Supabase/Edge; no KV; no `nodejs_compat`; no remote deploy/DNS.
- `npm test` uses `--test-concurrency=1` (Wrangler + mock port exclusivity).

## Warnings

- Real Edge `public-site-payload` / `tenant_id_from_host` **not** exercised (later slices / Hub deploy).
- `src/config/publicSite.ts` still has build-time production defaults for leads/catalog paths.
- **POC Issue — LeadForm utiliza configuração client-side de build-time** (não bloqueia Slice 6):
  - Anon key may appear in HTML; service_role absent; no auto-submit in POC.
  - Correção necessária **antes do preview remoto**. LeadForm não alterado neste slice.
- POC Issues #001 / #002: resolved in prior slices.
- Adapter may still log SESSION KV suggestion; unused.

## Architecture decision

- Hub **ADR-004**: Cloudflare Workers + Static Assets + `@astrojs/cloudflare`.
- One Worker → many tenants; no observed cross-tenant state on local workerd.

## Next steps

1. **POC-001 Slice 7** — next POC-001 step (per charter).
2. Later — preview/DNS, real Edge when authorized.
3. Deploy Hub Edge `public-site-payload` at 7266049 when ready.
4. Keep Node/Docker contingency until POC success criteria pass.
5. Fix LeadForm build-time client config before remote preview.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
