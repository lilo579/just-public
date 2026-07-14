# SYNC_STATUS — just-public

Updated: 2026-07-14 (Public Layer vertical slice v1 — local only)

## Source of truth

- Local git working tree in this repository.
- Hub authority for tenants / domains / payload: **just-auth-nexus**.
- Do not treat Lovable per-tenant sites or legacy hub clones as canonical.

## Current state

- Astro SSR + `@astrojs/node`, `output: server`.
- Public `/` and `/host-preview` default to `CanonicalHomepageRenderer` + `serializablePlan`.
- Host forwarded to `public-site-payload`; Hub resolves via `tenant_id_from_host`.
- Minimal tenant theme via `SiteTheme` + validated CSS custom properties.
- Legacy renderer only with explicit opt-in.
- Dev route `/dev/homepage-test` requires `?tenantId=` and is 404 in production builds.

## Changes in this slice

- Canonical renderer as the public default path.
- Shared `publicHomepage` / theme helpers + alpha/beta isolation tests.
- Removed localhost default to a hard-coded client catalog domain.
- README rewritten to match the multi-tenant public layer.

## Warnings

- Payload Edge deploy is **not** claimed here — only local Hub source + `build:edge` output when regenerated in just-auth-nexus.
- `allowedHosts: true` in vite is for local Host-header simulation; prefer `?host=`.
- Do not overwrite Hub-owned Site Engine contracts from this repo.

## Next steps

- Cloudflare Worker / edge host routing (out of scope for this slice).
- Richer theme tokens if branding model expands.
- Retire legacy renderer after confirmed zero consumers.

## Do not overwrite

- `src/contracts/homepage.ts` semantics owned by Hub payload contract (update only with Hub coordination).
- Customer DNS / tenant domains (Hub / infra).
- Unrelated finance or catalog product catalogs unless build-blocking.
