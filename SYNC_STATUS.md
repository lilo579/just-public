# SYNC_STATUS — just-public

Updated: 2026-07-14 (POC-001 Slice 5 — Workers Static Assets on workerd)

## Source of truth

- Local git working tree in this repository.
- Baseline before Slice 5: **1b61154** (Slice 4 canonical rendering on `main`).
- Hub authority for tenants / domains / payload: **just-auth-nexus**.
- POC charter: Hub `docs/architecture/poc/POC-001-CLOUDFLARE-RUNTIME-VALIDATION.md`.

## Current state (POC-001 Slice 5)

- Active adapter: **`@astrojs/cloudflare`** (`imageService: "passthrough"`).
- Workers Static Assets: `wrangler.jsonc` → `assets.directory: ./dist`, binding `ASSETS`.
- `public/.assetsignore` excludes `_worker.js` and `_routes.json` (entrypoint must not be a public asset).
- Public build products audited: `/_astro/*.css`, `/favicon.ico`, `/favicon.svg`.
- No separate client JS chunks under `/_astro` in current build (LeadForm config remains inline in SSR HTML).
- Alpha/Beta share the same asset URL set; CSS contains no tenant branding strings/tokens.
- Theme CSS variables remain inline on SSR HTML (`data-site-theme` / style attributes).
- Missing assets → controlled 404; no payload mock call; no tenant homepage body.
- Path probes to `/_worker.js/*` → not served as assets (after `.assetsignore`).
- Asset headers (local): `cache-control: public, max-age=0, must-revalidate` + ETag — **adequate for POC** (no custom HTML cache added).
- Host/env/renderer from Slices 2–4 unchanged.
- No real Supabase/Edge; no KV; no `nodejs_compat`; no remote deploy/DNS.
- `npm test` uses `--test-concurrency=1` (Wrangler + mock port exclusivity).

## Warnings

- Real Edge `public-site-payload` / `tenant_id_from_host` **not** exercised (later slices / Hub deploy).
- `src/config/publicSite.ts` still has build-time production defaults for leads/catalog paths.
- **POC Issue — LeadForm utiliza configuração client-side de build-time** (não bloqueia Slice 5 local):
  - `SUPABASE_ANON_KEY` = chave pública de cliente, protegida por RLS (comportamento preexistente no HTML do LeadForm).
  - `SUPABASE_SERVICE_ROLE_KEY` = secret privilegiada, proibida no cliente (ausente no HTML/assets).
  - Nenhum submit de lead; nenhuma chamada automática ao endpoint de leads ao carregar assets/HTML na POC.
  - Correção necessária **antes do preview remoto** da POC. LeadForm não alterado neste slice.
- **POC Issue #002 (resolved locally)** — Worker entrypoint was reachable via Static Assets under `/_worker.js/*` and path-normalized probes when `assets.directory` was the whole `dist/`. Fixed with official `.assetsignore` (`_worker.js`). Does not change asset architecture beyond ignore rules.
- Adapter may still log SESSION KV suggestion; unused.

## Architecture decision

- Hub **ADR-004**: Cloudflare Workers + Static Assets + `@astrojs/cloudflare`.
- POC Issue #001: resolved (Slice 3).
- POC Issue #002: resolved locally via `.assetsignore` (Slice 5).

## Next steps

1. **POC-001 Slice 6** — next POC-001 step (per charter).
2. Later — preview/DNS, real Edge when authorized.
3. Deploy Hub Edge `public-site-payload` at 7266049 when ready.
4. Keep Node/Docker contingency until POC success criteria pass.
5. Fix LeadForm build-time client config before remote preview.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
