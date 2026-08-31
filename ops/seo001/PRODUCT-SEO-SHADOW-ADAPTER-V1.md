# ADR: Product SEO Compiler v1 — adapter and shadow mode

Status: **local / not committed**. Report-only. Does not publish HTML, sitemap, robots, JSON-LD, Hub, banco, Edge, Cloudflare, or GSC.

## Decision

A generic adapter `adaptCatalogProductToSeoInputV1(source, context)` maps host-bound catalog rows onto the compiler contract. A shadow runner loads those rows (injected RPC or fixture), compiles in memory, and prints a redacted JSON report. Neither module is imported by pages, sitemap, robots, or middleware.

## Data authority

Public catalog is **host-scoped RPC**, not REST enumeration (L1A). Hub/admin SELECT is membership-gated.

| Surface | RPC / source | Role |
|---|---|---|
| List / sitemap / `/catalogo` | `public_get_products_by_host(p_host)` | Authority for id, name, slug, line, category, one image, price, tenant_id |
| PDP `/p/[slug]` | `public_get_product_by_host_and_slug` | Authority for description, `images[]`, material, dimensions |
| Taxonomy | `public_get_catalog_taxonomy_by_host` | Line/category names as catalog structure, not identity by itself |
| Canonical | `public_host_canonical_authority(p_host)` or Edge payload `canonical` | Sealed `canonicalContext`; never a caller boolean |
| Brand paint | `site_contact.company_name` / chrome | Display; adapter may copy as `brand` from source or context |
| Publication | payload `publication` + flag | Tenant indexability today; not a per-product `visible` |

RPC already requires `tenant_has_module(site)` and `catalog_enabled`. Products that the RPC returns are catalog-public. There is **no per-product `visible`** on the public RPC.

### Source → compiler field

| Compiler field | F3 list RPC | F3 PDP RPC | Paint today | Authority vs paint |
|---|---|---|---|---|
| productId | `product_id` | `product_id` | unused | Authority (`products.id`) |
| tenantId | `tenant_id` | `tenant_id` | unused | Authority; adapter fail-closed if ≠ context |
| brand | `company_name` | `company_name` | `name — companyName` title | Paint/contact; optional context.brand |
| lineName | `line_name` | `line_name` | line label above H1 | Authority (`product_lines.name`) |
| name | `name` | `name` | H1 | Authority (`products.name`) |
| variantAttributes | absent | `material`, `dimensions` (not an array) | facts box | Structured columns only; never parsed from description |
| categoryName | `category_name` | `category_name` | unused in title | Authority |
| publicProductCode | **absent** | absent | unused | **Gap** |
| description | **absent** | `description` | meta; fallback “Veja detalhes de {name}” | List RPC cannot feed meta; fallback is paint invention |
| images | `image_url` (coalesce) | `images[]` + main | gallery | Authority URLs; adapter does not interpret filenames |
| price | `price` | `price` | `R$ N` | Authority number; `R$` is paint, **not** currency |
| currency | **absent** | absent | implied BRL in `formatCatalogPrice` | **Gap** — do not invent BRL |
| availability | **absent** | absent | unused | **Gap** |
| slug | `slug` | `slug` | `/p/{slug}` | Authority; sanitizer for canonical path |
| canonicalUrl | derived | derived | `canonical.origin` + `/p/slug` | Canonical contract only |
| visible / catalogEnabled / tenantActive | implicit RPC gate | same | publication contract is tenant-level | Context; no product-level unpublished flag on RPC |

### Factory differences

- **F3:** host RPC above. Identity is mostly `lineName · name`. List RPC misses description → compiler composes from identity. Offers omitted (no currency/availability).
- **Future catalog factories:** same adapter aliases (`title`→name, `media[].url`→images, `sku`→publicProductCode). No `if (tenant)`.
- **Tenants without products / non-F3:** sitemap is homepage-only today. Shadow of `[]` is a valid empty report (`total: 0`). Do not invent a catalog.

## Fail closed

- missing sealed `canonicalContext` (caller `isPrimaryRequest: true` is ignored)
- unknown / empty request host
- canonical authority unavailable or malformed
- host unresolved (0 RPC rows)
- known host that is not the primary and not a www alias of that primary
- tenantId of authority ≠ expected / product tenant
- missing payload canonical
- publication present with `canonicalHost` ≠ primary
- missing `product_id` / `productId`
- alias group present on more than one key with **divergent** normalized values
- same `productId` on two pages with divergent content
- malformed source or page payload
- timeout / abort → empty metrics, completeness incomplete, no catalog presented
- any write-capable client method or non-allowlisted RPC → `write_attempted`

The adapter **does not** copy `source.canonicalUrl`. Canonical URLs are rebuilt from the sealed primary + sanitized slug.

The adapter **does not** set `visible: true` when the source omits `visible`.

## Canonical context contract

`resolveProductSeoCanonicalContextV1({ requestHost, expectedTenantId, authority })` and `loadProductSeoCanonicalContextV1` are the only producers of a trusted context. After validating authority they create the object, deep-freeze the graph, and register it in a **module-private WeakSet**. `isTrustedCanonicalContext` requires **membership** plus structural invariants. The brand string `just-product-seo-canonical-context/v1` is diagnostic metadata only.

A hand-built object, `{...spread}` clone, `JSON.parse(JSON.stringify(...))`, or property/symbol copy is not trusted. Mutating `tenantId`, `primaryHost`, `canonical`, `publication`, or `relation` after resolve throws (frozen). Live uses `loadProductSeoCanonicalContextV1` → RPC `public_host_canonical_authority`.

RPC rows must include the requested host explicitly (`request_host` / `requestHost`). There is **no** fallback to the caller host. Absent, empty, non-string, or divergent values fail closed (`malformed_canonical_authority` or `host_mismatch`); the context is untrusted and shadow does not compile.

Agreement required:

| Field | Rule |
|---|---|
| request host | normalized; must match `request_host` / payload `canonical.requestHost` |
| tenantId | UUID from RPC/payload; must match expected and product rows |
| `canonical.host` | active primary (`primary_host`), never request-host invention |
| www alias | `www.{primary}` or primary `www.{apex}` of the **same** tenant → trusted, URLs still use primary |
| publication | if present+valid, `canonicalHost` must equal primary |

Trusted relations: `primary` or `www_alias`. Anything else (`host_not_primary`, unavailable, malformed) marks the shadow untrusted. The adapter never reads a raw boolean.

## Completeness contract

`catalogComplete: true` only when a loader provides `countKind: "exact"` plus a stable `totalCount` (and optional `snapshotVersion`) and `received === total`.

The current list RPC returns a bare array. No Content-Range, no `totalCount`, no snapshot. Therefore live/fixture list loads are:

- `completeness: "unknown"`
- `completenessReason: "unproven_total"` or `"unproven_silent_cap"`
- `catalogComplete: false`
- `usableForEnforcement: false`

They may still compile received rows for metrics. A future list/batch RPC with exact count (contract A) or `rows + totalCount + snapshotVersion` (contract B) is required before any completeness claim.

Mismatch cases (`total_changed`, `total_greater_than_received`, `total_less_than_received`, `premature_empty_page`, `snapshot_version_changed`, `limit`) are `completeness: "incomplete"`.

## Read-only guarantee (honest)

- `createHostBoundCatalogLoader` wraps the client, closes over the RPC allowlist, and registers the function in a **module-private WeakSet**. Only that factory produces a `verified` loader.
- `runProductSeoShadowV1`: official registered loader → `readOnlyExecution: "verified"`, `loaderKind: "official"`, `writesObserved: []` when the wrapper saw no blocked access. Injected/synthetic loader → `readOnlyExecution: "unverified"`, `loaderKind: "synthetic"`, `writesObserved: null`. The runner **never** emits `writes: []` for an injected loader (`writes` is `null`).
- Live CLI (`liveCatalogLoaderGate`) refuses an unverified loader before running.
- `wrapReadOnlySupabase` blocks `from` / `insert` / `update` / `delete` / `upsert` / `storage` / `schema`. A blocked access on the official wrapper aborts the shadow and records the method in `writesObserved`.
- RPC allowlist: `public_get_products_by_host`, `public_host_canonical_authority` (both POST-of-read SECURITY DEFINER).
- Static scan: adapter, canonical context, and runner contain no `fetch(` / `createClient(`.
- `writesObserved` is the **observed/blocked** attempt log of the official wrapper. It is not a cryptographic proof that no other process wrote. Defense in depth, not a formal guarantee.

## Alias policy

Each group is collected in full. Normalized comparison uses compiler `identityKey` (NFC → NFD, strip marks, casefold) for text; finite number for price (`90` ≡ `"90"`); sorted URL sets for `images`/`media`/`image_url`. Divergent types (string vs number on `name`/`title`) fail. Equivalent values may keep a deterministic representative (lexicographic alias name). Conflict never depends on object key insertion order.

## Shadow runner

`runProductSeoShadowV1({ loadCatalog, context, pageSize, limit, timeoutMs, signal, writeAttempts })`

- Injected loader (fixture tests: `synthetic` / `unverified`) or `createHostBoundCatalogLoader` (WeakSet-verified official path)
- Canonical via `loadProductSeoCanonicalContextV1` → `public_host_canonical_authority`
- Official wrapper blocks write surfaces; `writesObserved` is the observed/blocked log on the verified path only
- Completeness is proven only with exact total; otherwise unknown/incomplete
- Timeout + AbortSignal cancel the run
- Shadow is **never** usable for enforcement
- Redact storage URLs, contacts, JWTs, signed query strings (`token`/`sig`/`apikey`)
- Compare current PDP paint vs compiled proposal
- Does not persist overrides or `product_publication_state`

CLI (fixture): `scripts/preview-product-seo-shadow-v1.mjs <fixture.json>` stdout only. Fixture path is synthetic/unverified by design.

Live read-only (anon, no Git payload): `scripts/preview-product-seo-shadow-live-readonly.mjs` writes evidence under `/tmp/just-seo-shadow-live` (or `SHADOW_LIVE_EVIDENCE_DIR`). Aborts on `service_role` / missing anon / unverified loader / any write method.

## Future data strategy (decision)

1. **No N+1 PDPs** on the public request path. Shadow and future compile must not call `public_get_product_by_host_and_slug` per product.
2. Fields required for SEO (description, `images[]`, SKU/`public_product_code`, ISO 4217 `currency`, schema.org `availability`, optional per-product `visible`) are added to the **list RPC** or to a dedicated **batch SEO RPC** — never fetched one-by-one.
3. Currency and availability are **never** inferred from `R$` paint or CSS.
4. A product without explicit `visible` must not receive invented unpublished/published semantics in the adapter. Compiler default remains “public if not `false`”; that is not a publication flag.
5. An incomplete shadow (`catalogComplete: false`, timeout, limit, missing list fields) is **metrics only**. It must not feed robots, sitemap, JSON-LD, or Hub enforcement.

## Hub alerts (proposal only — no UI)

Copy must ask for a **factual differentiator**, never “preencher SEO”:

- `needs_input` + `duplicate_effective_name`: “Precisamos diferenciar estes produtos. Informe o tipo, modelo ou outra característica real.”
- `requiresIdentityLabelOrNewAttribute`: complete structured attribute on **every** colliding row, or one identity label
- `hasStructuredResolutionCandidate`: attribute/code present on only part of the group
- quality: missing HTTPS image; offers incomplete (no noindex)
- blocking canonical/slug: fix URL identity, not a slogan

Surfaces: catalog product list badge, PDP editor hint, tenant SEO digest. Out of scope until phase 4.

## Rollout

1. **Shadow** (this work, local): adapter + runner + fixtures. No commit required to prove the path.
2. **Observability:** scheduled/manual stdout or private artifact; no GSC.
3. **Schema/overrides:** apply PREPARED SQL only with a later GO.
4. **Hub:** alerts + optional identity label field.
5. **Publication:** emit compiled title/meta/JSON-LD behind a tenant flag.
6. **Enforcement:** `indexingProposed` → robots/sitemap. Separate GO. Incomplete catalogs are excluded.

## GO / NO-GO

| Gate | Veredito |
|---|---|
| Commit corretivo sobre `02f6a2a` | **GO** when asked (WeakSet capability + explicit `request_host` + verified loader). Uncommitted until then. |
| PR | **NO-GO** until commit GO and review |
| Migration | **NO-GO** |
| Hub UI | **NO-GO** |
| Integração runtime (pages/sitemap/Worker) | **NO-GO** |
| Enforcement / GSC | **NO-GO** |

## Execution (local, stdout only)

| Catalog | total | auto_ready | needs_input | indexáveis | notes |
|---|---|---|---|---|---|
| Jewish 118 snapshot | 118 | 112 | 6 | 112 | compiler-shaped fixture (2026-08-27); 2 grupos de colisão |
| F3 RPC list synthetic | 4 | 2 | 2 | 2 | description/currency/availability/SKU ausentes no list RPC |
| Factory B synthetic | 2 | 2 | 0 | 2 | sku+currency+availability → rich-result 2 |
| Empty catalog | 0 | 0 | 0 | 0 | runner válido |
| Jewish live list RPC | (see live section) |  |  |  | list RPC has no description; evidence not in Git |

Comparação sem publicação: H1 atual = `products.name`; H1 proposto = `lineName · name`. Title atual = `name — brand`; title proposto = `{effective} \| {brand}`. Sitemap atual F3 lista `/p/{slug}`; `inSitemapProposed` só para auto/override_ready. Nenhuma superfície foi alterada.

## Live fixture × live (anonymized)

Captured **2026-08-30T09:09:53Z**. Anon JWT. RPCs: `public_host_canonical_authority` + `public_get_products_by_host`. `writes: []`. Evidence only under `/tmp/just-seo-shadow-live`.

| Record | Value |
|---|---|
| Apex `3djewish.com.br` | trusted `primary` · tenant `76a96afa-…7d84` · primaryHost `3djewish.com.br` |
| www `www.3djewish.com.br` | trusted `www_alias` · **same** tenant and primary |
| Live product rows | 118 |
| Fixture product rows | 118 |
| IDs only in fixture / live | 0 / 0 |
| Live compiled | **112 auto_ready** / **6 needs_input** · quality warnings `{}` |
| Completeness | **`unknown` / `unproven_total`** — list RPC has no exact count |
| `catalogComplete` | **false** |
| `usableForEnforcement` | **false** |
| Redaction | no WhatsApp, storage URLs, JWTs, or service_role in the report |

Tests: compiler **43/43** + shadow **26/26**.

## Batch catalog contract

The list RPC remains `public_get_products_by_host` until the authority envelope `product-seo-catalog/v1` is applied. Public consumes that contract by name only (parser + `createProductSeoBatchCatalogLoader`). `p_limit` is sent as a JSON number. Fingerprint is `sha256:` + 64 lowercase hex, and is JSON `null` when truncated. See `ops/seo001/PRODUCT-SEO-CATALOG-V1-CONSUMER.md` and `docs/contracts/product-seo-catalog-v1.json`. Authority SQL lives in Nexus. Not applied, not committed, not imported by pages.

