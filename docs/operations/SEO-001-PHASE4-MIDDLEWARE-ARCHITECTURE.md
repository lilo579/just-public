# SEO-001 Phase 4 — Middleware canonical redirect architecture

## Authority resolution (once per request)

1. Middleware classifies the path (`publicRouteKind`).
2. For `public_page` + GET/HEAD + **production** (not preview/staging), it calls `resolveRequestCanonicalAuthority`:
   - reuse `locals.publicCanonical` when host matches;
   - else read `canonical` from `public-site-payload` (Edge contract);
   - else `fetchPublicCanonicalFromRpc` (Phase 3 helper) when payload URL is unavailable.
3. Validated contract is stored on `Astro.locals.publicCanonical` (+ optional tenant id).
4. Chrome loaders prefer `locals.publicCanonical` over a second interpretation of authority.
5. Preview/staging skip the redirect authority fetch entirely (`?host=` simulation preserved; noindex remains).

## When an extra lookup remains

| Surface | Extra lookup | Why |
|---------|----------------|-----|
| `/c` product RPC path | May still call RPC if middleware skipped (safe mode / asset) | Path B without homepage payload |
| Homepage | Payload fetch still required for content | Canonical comes on the same payload; locals avoid re-deriving host authority only |
| Preview/staging | No redirect RPC required | Safe mode skips redirects; `?host=` simulation preserved |

## Exclusions

No host/path SEO redirect for: `/_astro/*`, `/fonts/*`, `/branding/*`, favicons, manifests, `/health`, `/api/*`, `/preview`, hashed static assets.

## `/homepage`

Production: middleware 301 → `/` (combined with host normalization).  
Technical preview: use `/preview` (remains available; preview/staging `noindex`).
