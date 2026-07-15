# SYNC_STATUS — just-public

Updated: 2026-07-14 (POC-001 Slice 4 — payload, Canonical Renderer, theme on workerd)

## Source of truth

- Local git working tree in this repository.
- Baseline before Slice 4: **60547ae** (Slice 3 Host resolution on `main`).
- Hub authority for tenants / domains / payload: **just-auth-nexus**.
- POC charter: Hub `docs/architecture/poc/POC-001-CLOUDFLARE-RUNTIME-VALIDATION.md`.

## Current state (POC-001 Slice 4)

- Active adapter: **`@astrojs/cloudflare`** (`imageService: "passthrough"`).
- Host resolution (Slice 3) + runtime env (Slice 2) unchanged.
- **Canonical mock fixtures** (`tests/fixtures/poc-canonical-payloads.mjs`) for Alpha/Beta.
- Workerd validates: mock payload → `serializablePlan` → `CanonicalHomepageRenderer` → theme → HTML.
- Alpha/Beta content + theme isolation proven on real workerd responses (incl. A/B/A/B sequence).
- Error paths: unknown host (404), no plan (502, no legacy), malformed JSON (502, no stack), bad branding (safe defaults).
- Basic Static Assets: referenced `/_astro/*.css` returns 200.
- `fetchPublicSitePayload` returns controlled `502 Invalid payload` on JSON parse failure.
- No real Supabase/Edge; no KV; no `nodejs_compat`; no remote deploy/DNS.
- `npm test` uses `--test-concurrency=1` (Wrangler + mock port exclusivity).

## Warnings

- Real Edge `public-site-payload` / `tenant_id_from_host` **not** exercised (Slice 5+ / Hub deploy).
- `src/config/publicSite.ts` still has build-time production defaults for leads/catalog paths.
- **POC Issue — LeadForm utiliza configuração client-side de build-time** (não bloqueia Slice 4):
  - `SUPABASE_ANON_KEY` = chave pública de cliente, protegida por RLS (comportamento preexistente no HTML do LeadForm).
  - `SUPABASE_SERVICE_ROLE_KEY` = secret privilegiada, proibida no cliente (ausente no HTML/assets).
  - Nenhum submit de lead; nenhuma chamada automática ao endpoint de leads na POC.
  - Correção necessária **antes do preview remoto** da POC. LeadForm não alterado neste slice.
- Adapter may still log SESSION KV suggestion; unused.

## Architecture decision

- Hub **ADR-004**: Cloudflare Workers + Static Assets + `@astrojs/cloudflare`.
- POC Issue #001: resolved (Slice 3).

## Next steps

1. **POC-001 Slice 5** — Static Assets in depth (per POC-001).
2. Later slices — preview/DNS, real Edge when authorized.
3. Deploy Hub Edge `public-site-payload` at 7266049 when ready.
4. Keep Node/Docker contingency until POC success criteria pass.

## Do not overwrite

- Homepage / payload contracts owned with Hub coordination.
- Customer DNS / Cloudflare without an explicit ops task.
- Unrelated Hub finance/scripts (other repo).
