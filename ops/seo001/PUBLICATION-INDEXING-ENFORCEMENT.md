# SEO-001 — publication indexing enforcement (Public)

Flag: `SEO001_ENFORCE_PUBLICATION_INDEXING` (plaintext Worker var, **not** a GitHub secret).

Exact ON value: the string `true`. Absent / any other value = OFF.

## How the flag enters a Worker version

1. `wrangler.jsonc` → `env.production.vars` (preview/staging omit the key).
2. `SEO-001 Production Candidate Version` runs `wrangler versions upload --env production`.
   Bindings are **frozen into that Version ID**.
3. `SEO-001 Promote Tenant` only deploys an existing `version_id` at 100%. It does **not**
   change vars. GitHub repo vars/secrets do not inject this flag.

Optional one-off (not preferred): `wrangler versions upload --env production --var SEO001_ENFORCE_PUBLICATION_INDEXING:true` from a SHA that already has observable `/health`. Prefer the `wrangler.jsonc` production var so dry-run and health smoke stay reproducible.

## Scope

Publication `X-Robots-Tag` / `no-store` headers apply only when all of these are true:

- `classifyPublicRoute` is `public_page`
- `publicRequestContext` is host-bound (payload present)
- `ctx.result` is not `skipped`

Assets, favicon, `/_astro`, branding, fonts, manifests, health, and APIs keep their own cache/headers. An indexable stamp must carry `publication.canonicalHost` and it must equal `canonical.host`. Public does not invent a fallback host.

## Observability

`GET /health` (no tenant/Edge I/O):

- `publicationContractVersion` (`v1`)
- `publicationIndexingEnforced` (`true` | `false`)

## Rollback

Promote `2146b45f-02b1-4b37-aeef-2fbdf23d1c33` to 100%. That version was uploaded **without** the flag, so `/health` stays the older shape and enforcement is OFF.

## Not in this file

Do not flip GitHub allowlist, Edge, DB, Cloudflare DNS, Nexus #29, Site Mode, or GSC here.
