# just-public — JUST Public Layer

Shared multi-tenant Astro SSR renderer for public websites.

## Role

- **This repo** renders public HTML for any tenant using the same codebase.
- **just-auth-nexus** (Hub) owns tenants, domains, Site CMS, Site Engine, recipes, and the `public-site-payload` Edge Function.
- No per-tenant builds, repos, or Lovable forks belong here.

## Runtime (this slice)

- Astro SSR
- `@astrojs/node` adapter
- `output: "server"`

Cloudflare Worker is a **future** edge layer — **not** implemented in this slice.

## Request flow

```
Host HTTP
  → Astro SSR (just-public)
  → public-site-payload?host=<host>&mode=public|preview
  → Hub: public.tenant_id_from_host(host)
  → gates + HomepageSource / serializablePlan
  → CanonicalHomepageRenderer
  → site_branding → CSS custom properties
  → HTML response
```

### How Host is read

1. Prefer query `?host=` (local simulation).
2. Else use the HTTP `Host` header (port stripped).
3. Pass that host to `public-site-payload` — never invent a default tenant domain.

### Payload contract

`GET public-site-payload` with **exactly one** of:

| Param | Use |
|-------|-----|
| `host` | Public / host-preview sites |
| `slug` | Admin preview (`/preview?slug=`) |
| `tenantId` | Dev-only bridge (`/dev/homepage-test?tenantId=`) |

Plus `mode=public|preview`.

Canonical host authority on the Hub is `public.tenant_id_from_host`.

## Renderer

- **Default:** `CanonicalHomepageRenderer` via `serializablePlan`.
- **Legacy:** only when explicitly enabled (`?renderer=legacy` or `PUBLIC_ALLOW_LEGACY_RENDERER=1`) and the same payload still has blocks. Missing plan returns an error — no silent hardcoded homepage and no cross-tenant fallback.

## Theme

`site_branding` → validated tokens → CSS variables on a shared root (`SiteTheme`):

- `--site-color-primary`
- `--site-color-secondary`
- `--site-color-background`
- `--site-color-text`
- `--site-radius`
- `--site-font-heading`
- `--site-font-body`

Colors must be `#rgb` / `#rrggbb`. Fonts are allowlisted (`modern` | `classic`). Invalid values fall back to safe defaults.

## Local development

```sh
npm install
npm run dev
```

Simulate tenants:

```text
http://localhost:4321/?host=alpha.example.com
http://localhost:4321/?host=beta.example.com
http://localhost:4321/host-preview?host=alpha.justwebsites.com.br
http://localhost:4321/preview?slug=<tenant-slug>
```

Catalog routes (`/c`, `/p/[slug]`) on localhost require an explicit `?host=` — there is no default client domain.

## Environment

| Variable | Purpose |
|----------|---------|
| `PUBLIC_SITE_PAYLOAD_URL` | Edge Function URL (optional; has project default) |
| `PUBLIC_LEADS_INTAKE_URL` | Leads intake (optional) |
| `SUPABASE_ANON_KEY` | Anon key for Edge calls (server-side) |
| `PUBLIC_ALLOW_LEGACY_RENDERER` | Set `1` to allow explicit legacy fallback |

Do not put service-role keys in this app.

## Commands

```sh
npm test          # node:test contractual / isolation tests
npm run build     # Astro production build
npm run preview   # serve build (Node standalone)
npx astro check   # typecheck when @astrojs/check is available
```

## Current limitations

- No Cloudflare Worker / wildcard DNS in this slice.
- Content model remains flat (`site_content`, branding, contact) — no `site_pages` / `site_blocks`.
- Theme is minimal (validated hex + typography allowlist).
- Shop catalog is host-resolved but outside the Homepage canonical plan path.
- Production readiness depends on Hub `public-site-payload` deployment with the host-authority changes.

See `SYNC_STATUS.md` for sync state with the Hub.
