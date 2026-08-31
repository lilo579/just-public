# Product SEO catalog consumer — `product-seo-catalog/v1`

**Status:** Committed on branch / shadow-only / not applied
**Contract name:** `product-seo-catalog/v1`
**Owner of SQL/authority:** just-auth-nexus
**This repo:** parser, shadow adapter, consumer tests

Cross-reference the contract **by name** (`product-seo-catalog/v1`). Do not import Nexus SQL, worktree paths, or temporary file locations.

Machine-readable copy: `docs/contracts/product-seo-catalog-v1.json` (must stay aligned with Nexus).

## Decision

Public consumes the Nexus envelope through `parseProductSeoCatalogV1` and `createProductSeoBatchCatalogLoader`. Data is supplied **only** to `runProductSeoShadowV1`. `usableForEnforcement` remains `false`. This module is not imported by pages, sitemap, robots, middleware, Hub, or GSC.

## Loader

`createProductSeoBatchCatalogLoader` is WeakSet-verified. It calls `public_get_product_seo_catalog_by_host_v1` through the read-only allowlist with `p_limit` as a **JSON number** (JavaScript number). Success (`ok` / `catalog_empty`) becomes `{ rows, nextPage: null, countKind: "exact", totalCount, snapshotVersion }`. Other statuses throw with `err.code = status` so the shadow runner fail-closes incomplete.

Unexpected transport errors remain fail-closed (`rpc_error`, timeout, malformed). Invalid `p_limit` types are a **server envelope** `limit_invalid`, not a client 22P02.

## Parser rules

Refuse the whole envelope. Do not repair.

- Unknown `contractVersion` or `status`.
- `usableForEnforcement !== false`.
- Dangerous own keys `__proto__`, `constructor`, `prototype` on the envelope, products, or nested objects.
- Incoherent counts (`returnedCount !== products.length`, truncated vs total, response above cap 500).
- Duplicate `productId`.
- Product `tenantId` missing, null, not a UUID, or ≠ envelope `tenantId`.
- Product `host` missing, null, not a host, www alias, or ≠ `canonicalHost` after normalize.
- Required `productObject` fields missing or wrong type.
- Image URL outside the structural HTTPS origin/path policy, including mixed-case `HTTPS://` (query, fragment, userinfo, `%`, `.`/`..`, other host/project).
- Fingerprint must match `^sha256:[0-9a-f]{64}$` when `catalogComplete`; must be JSON `null` when truncated or fail-closed.
- Canonical anomaly statuses (`host_not_primary`, `primary_missing`, `multiple_primaries`) must not be marked complete.
- Never promote `truncated` to `catalogComplete: true`.
- `catalog_unavailable` and `tenant_suspended` are incomplete fail-closed states. They are not proven empty catalogs.
- Only `ok` and `catalog_empty` with a proven total may be `catalogComplete: true`.

## Images

Public does not re-host, strip query strings, or lowercase a mixed-case scheme. Origin is `storageOrigin` from the envelope (server GUC on Nexus, itself required to be `https://`). If the envelope still contains a query/userinfo/fragment/encoded/traversal/`HTTPS://` URL, that is an authority bug: parser refuses. Diagnostics must not print image URLs; the existing shadow redactor remains in force.

## Completeness / cost (consumer view)

A truncated envelope (`truncated: true`, fingerprint `null`) is incomplete. Shadow may compile the received page for metrics. `usableForEnforcement` stays false. Completeness requires a proven total and a SHA-256 fingerprint.

## Apply / runtime gate

Git commit/PR does not authorize runtime. NO-GO until separately authorized: linked migration, Hub, HTML, sitemap, deploy, Cloudflare, GSC.
