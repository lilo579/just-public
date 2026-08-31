import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  parseProductSeoCatalogV1,
  isProductSeoCatalogSuccess,
  isContractPublicProductImageUrl,
  PRODUCT_SEO_CATALOG_CONTRACT_VERSION,
  PRODUCT_SEO_CATALOG_RPC,
} from "../src/lib/productSeoBatchCatalogV1.js"
import { resolveProductSeoCanonicalContextV1 } from "../src/lib/productSeoCanonicalContextV1.js"
import {
  runProductSeoShadowV1,
  createProductSeoBatchCatalogLoader,
  isVerifiedCatalogLoader,
  wrapReadOnlySupabase,
  READ_ONLY_SEO_CATALOG_RPC,
} from "../src/lib/productSeoShadowRunnerV1.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const SHA256_OK = `sha256:${"a".repeat(64)}`
const SHA256_EMPTY = `sha256:${"b".repeat(64)}`
const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ORIGIN = "https://ehondnpqztvybvgsjnxe.supabase.co"
const ALLOWED_IMAGE = `${ORIGIN}/storage/v1/object/public/product-images/${TENANT}/aaaaaaaa-aaaa-4aaa-8aaa-000000000001/main.webp`

function envelope(extra = {}) {
  const products = extra.products || [
    {
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
      tenantId: TENANT,
      host: "3djewish.test",
      slug: "alpha",
      name: "Alpha",
      lineName: "Classic",
      categoryName: "Anel",
      description: "Primeiro",
      variantAttributes: ["ouro"],
      images: [ALLOWED_IMAGE],
      price: 10.5,
      currency: null,
      availability: null,
      publicProductCode: null,
      brand: "3D Jewish",
      visible: null,
      catalogEnabled: true,
      tenantActive: true,
    },
  ]
  const totalCount = extra.totalCount ?? products.length
  const returnedCount = extra.returnedCount ?? products.length
  const truncated = extra.truncated ?? totalCount > (extra.effectiveLimit ?? 500)
  const catalogComplete = extra.catalogComplete ?? (!truncated && returnedCount === totalCount)
  const catalogFingerprint =
    extra.catalogFingerprint !== undefined
      ? extra.catalogFingerprint
      : catalogComplete
        ? SHA256_OK
        : null
  return {
    contractVersion: PRODUCT_SEO_CATALOG_CONTRACT_VERSION,
    rpcName: PRODUCT_SEO_CATALOG_RPC,
    status: "ok",
    ok: true,
    catalogComplete,
    usableForEnforcement: false,
    tenantId: TENANT,
    canonicalHost: "3djewish.test",
    requestHost: "www.3djewish.test",
    storageOrigin: ORIGIN,
    effectiveLimit: 500,
    returnedCount,
    totalCount,
    truncated,
    catalogFingerprint,
    imageDiagnostics: {
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedByReason: {
        not_https: 0,
        userinfo: 0,
        has_query: 0,
        fragment: 0,
        untrusted_host: 0,
        invalid_path: 0,
        origin_unconfigured: 0,
      },
    },
    products,
    ...extra,
    products: extra.products || products,
    catalogFingerprint: extra.catalogFingerprint !== undefined ? extra.catalogFingerprint : catalogFingerprint,
  }
}

function emptyEnvelope() {
  return envelope({
    status: "catalog_empty",
    catalogComplete: true,
    truncated: false,
    returnedCount: 0,
    totalCount: 0,
    products: [],
    catalogFingerprint: SHA256_EMPTY,
  })
}

function failEnvelope(status) {
  return envelope({
    status,
    ok: false,
    catalogComplete: false,
    truncated: false,
    returnedCount: 0,
    totalCount: null,
    catalogFingerprint: null,
    products: [],
  })
}

function context() {
  return {
    expectedTenantId: TENANT,
    host: "www.3djewish.test",
    brand: "3D Jewish",
    canonicalContext: resolveProductSeoCanonicalContextV1({
      requestHost: "www.3djewish.test",
      expectedTenantId: TENANT,
      authority: {
        kind: "rpc",
        row: {
          tenant_id: TENANT,
          primary_host: "3djewish.test",
          request_host: "www.3djewish.test",
          is_primary_request: false,
          has_primary: true,
        },
      },
    }),
  }
}

test("parser accepts ok envelope and keeps usableForEnforcement false", () => {
  const parsed = parseProductSeoCatalogV1(envelope())
  assert.equal(parsed.accepted, true)
  assert.equal(parsed.status, "ok")
  assert.equal(parsed.catalogComplete, true)
  assert.equal(parsed.usableForEnforcement, false)
  assert.equal(isProductSeoCatalogSuccess(parsed), true)
  assert.equal(parsed.products.length, 1)
  assert.match(parsed.catalogFingerprint, /^sha256:[0-9a-f]{64}$/)
})

test("parser accepts proven empty catalog and not unavailable", () => {
  const parsed = parseProductSeoCatalogV1(emptyEnvelope())
  assert.equal(parsed.status, "catalog_empty")
  assert.equal(parsed.ok, true)
  assert.equal(parsed.catalogComplete, true)
  assert.equal(parsed.totalCount, 0)
})

test("parser refuses unknown contract version", () => {
  const parsed = parseProductSeoCatalogV1(envelope({ contractVersion: "product-seo-catalog/v0" }))
  assert.equal(parsed.accepted, false)
  assert.equal(parsed.reason, "unknown_contract_version")
  assert.equal(parsed.catalogComplete, false)
})

test("parser refuses incoherent counts and fingerprint", () => {
  assert.equal(parseProductSeoCatalogV1(envelope({ returnedCount: 2 })).reason, "incoherent_returned_count")
  assert.equal(
    parseProductSeoCatalogV1(envelope({ catalogFingerprint: "not-a-hash" })).reason,
    "missing_fingerprint",
  )
  assert.equal(
    parseProductSeoCatalogV1(envelope({ catalogFingerprint: "a".repeat(32) })).reason,
    "missing_fingerprint",
  )
  assert.equal(
    parseProductSeoCatalogV1(envelope({ catalogComplete: true, truncated: true, totalCount: 2, returnedCount: 1, effectiveLimit: 1, products: envelope().products })).reason,
    "truncated_must_not_be_proven",
  )
})

test("parser never promotes truncated to proven and requires null fingerprint", () => {
  const parsed = parseProductSeoCatalogV1(
    envelope({
      truncated: true,
      catalogComplete: false,
      totalCount: 501,
      returnedCount: 500,
      effectiveLimit: 500,
      catalogFingerprint: null,
      products: Array.from({ length: 500 }, (_, i) => ({
        ...envelope().products[0],
        productId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
      })),
    }),
  )
  assert.equal(parsed.accepted, true)
  assert.equal(parsed.truncated, true)
  assert.equal(parsed.catalogComplete, false)
  assert.equal(parsed.usableForEnforcement, false)
  assert.equal(parsed.catalogFingerprint, null)
  assert.equal(
    parseProductSeoCatalogV1(
      envelope({
        truncated: true,
        catalogComplete: false,
        totalCount: 501,
        returnedCount: 500,
        effectiveLimit: 500,
        catalogFingerprint: SHA256_OK,
        products: Array.from({ length: 500 }, (_, i) => ({
          ...envelope().products[0],
          productId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
        })),
      }),
    ).reason,
    "fingerprint_present_when_incomplete",
  )
})

test("parser treats unavailable and suspended as incomplete, not empty", () => {
  for (const status of ["catalog_unavailable", "tenant_suspended"]) {
    const parsed = parseProductSeoCatalogV1(failEnvelope(status))
    assert.equal(parsed.accepted, true)
    assert.equal(parsed.ok, false)
    assert.equal(parsed.catalogComplete, false)
    assert.equal(parsed.totalCount, null)
    assert.equal(parsed.products.length, 0)
    assert.equal(isProductSeoCatalogSuccess(parsed), false)
  }
  assert.equal(
    parseProductSeoCatalogV1(
      failEnvelope("catalog_unavailable").ok
        ? {}
        : { ...failEnvelope("catalog_unavailable"), totalCount: 0, catalogComplete: true, ok: true, status: "catalog_unavailable" },
    ).accepted,
    false,
  )
})

test("parser refuses fail-closed states that look like empty catalogs", () => {
  const suspendedAsEmpty = failEnvelope("tenant_suspended")
  suspendedAsEmpty.totalCount = 0
  suspendedAsEmpty.catalogComplete = false
  assert.equal(parseProductSeoCatalogV1(suspendedAsEmpty).reason, "fail_closed_has_total")
})

test("parser refuses canonical anomalies marked complete", () => {
  for (const status of ["host_not_primary", "primary_missing", "multiple_primaries"]) {
    const parsed = parseProductSeoCatalogV1({
      ...failEnvelope(status),
      catalogComplete: true,
    })
    assert.equal(parsed.accepted, false)
    assert.equal(parsed.reason, "canonical_anomaly_marked_complete")
  }
  assert.equal(parseProductSeoCatalogV1(failEnvelope("primary_missing")).accepted, true)
  assert.equal(parseProductSeoCatalogV1(failEnvelope("multiple_primaries")).accepted, true)
})

test("parser refuses duplicate, missing, and divergent tenant/host on complete catalogs", () => {
  const base = envelope().products[0]
  assert.equal(
    parseProductSeoCatalogV1(
      envelope({
        returnedCount: 2,
        totalCount: 2,
        products: [base, { ...base }],
      }),
    ).reason,
    "duplicate_product_id",
  )
  const withoutTenant = { ...base }
  delete withoutTenant.tenantId
  assert.equal(parseProductSeoCatalogV1(envelope({ products: [withoutTenant] })).reason, "missing_tenant_id")
  assert.equal(parseProductSeoCatalogV1(envelope({ products: [{ ...base, tenantId: null }] })).reason, "missing_tenant_id")
  assert.equal(parseProductSeoCatalogV1(envelope({ products: [{ ...base, tenantId: "not-a-uuid" }] })).reason, "invalid_tenant_id")
  assert.equal(
    parseProductSeoCatalogV1(envelope({ products: [{ ...base, tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }] })).reason,
    "product_tenant_mismatch",
  )
  const withoutHost = { ...base }
  delete withoutHost.host
  assert.equal(parseProductSeoCatalogV1(envelope({ products: [withoutHost] })).reason, "missing_host")
  assert.equal(parseProductSeoCatalogV1(envelope({ products: [{ ...base, host: null }] })).reason, "missing_host")
  assert.equal(parseProductSeoCatalogV1(envelope({ products: [{ ...base, host: "" }] })).reason, "invalid_host")
  assert.equal(parseProductSeoCatalogV1(envelope({ products: [{ ...base, host: "www.3djewish.test" }] })).reason, "product_host_mismatch")
  assert.equal(
    parseProductSeoCatalogV1(envelope({ products: [{ ...base, host: "shop.3djewish.test" }] })).reason,
    "product_host_mismatch",
  )
  const proto = JSON.parse(`{"__proto__":{"polluted":true},"contractVersion":"${PRODUCT_SEO_CATALOG_CONTRACT_VERSION}"}`)
  assert.equal(parseProductSeoCatalogV1(proto).reason, "dangerous_keys")
  assert.equal(parseProductSeoCatalogV1(envelope({ constructor: { prototype: { x: 1 } } })).reason, "dangerous_keys")
})

test("parser refuses a single invalid product among several, complete and truncated", () => {
  const base = envelope().products[0]
  const completePair = [
    { ...base, productId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001" },
    { ...base, productId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002", tenantId: null },
  ]
  assert.equal(
    parseProductSeoCatalogV1(envelope({ returnedCount: 2, totalCount: 2, products: completePair })).reason,
    "missing_tenant_id",
  )
  const truncated = Array.from({ length: 500 }, (_, i) => ({
    ...base,
    productId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
  }))
  truncated[17] = { ...truncated[17], host: "www.3djewish.test" }
  assert.equal(
    parseProductSeoCatalogV1(
      envelope({
        truncated: true,
        catalogComplete: false,
        totalCount: 501,
        returnedCount: 500,
        effectiveLimit: 500,
        catalogFingerprint: null,
        products: truncated,
      }),
    ).reason,
    "product_host_mismatch",
  )
})

test("parser refuses adversarial images and does not repair them", () => {
  const mixed = `HTTPS://ehondnpqztvybvgsjnxe.supabase.co/storage/v1/object/public/product-images/${TENANT}/main.webp`
  const attacks = [
    `${ALLOWED_IMAGE}?token=secret`,
    `${ALLOWED_IMAGE}#frag`,
    `https://user:pass@ehondnpqztvybvgsjnxe.supabase.co/storage/v1/object/public/product-images/${TENANT}/x.webp`,
    `${ORIGIN}/storage/v1/object/public/product-images/${TENANT}/../site-media/x.webp`,
    `${ORIGIN}/storage/v1/object/public/product-images/${TENANT}/%2e%2e/x.webp`,
    `https://aaaaaaaaaaaaaaaaaa.supabase.co/storage/v1/object/public/product-images/${TENANT}/x.webp`,
    `https://ehondnpqztvybvgsjnxe.supabase.co.evil.test/storage/v1/object/public/product-images/${TENANT}/x.webp`,
    `https://xn--ehondnpqztvybvgsjnxe.supabase.co/storage/v1/object/public/product-images/${TENANT}/x.webp`,
    `http://${ORIGIN.slice("https://".length)}/storage/v1/object/public/product-images/${TENANT}/x.webp`,
    mixed,
  ]
  for (const url of attacks) {
    assert.equal(isContractPublicProductImageUrl(url, ORIGIN, TENANT), false, url)
    assert.equal(
      parseProductSeoCatalogV1(envelope({ products: [{ ...envelope().products[0], images: [url] }] })).reason,
      "invalid_image",
      url,
    )
  }
  assert.equal(isContractPublicProductImageUrl(ALLOWED_IMAGE, ORIGIN, TENANT), true)
  assert.equal(isContractPublicProductImageUrl(mixed, ORIGIN, TENANT), false)
})

test("batch loader is verified, host-bound, and sends p_limit as JSON number", async () => {
  const calls = []
  const writeAttempts = []
  const loader = createProductSeoBatchCatalogLoader({
    host: "www.3djewish.test",
    writeAttempts,
    supabase: {
      rpc(name, args) {
        calls.push({ name, args })
        return Promise.resolve({ data: envelope(), error: null })
      },
      insert() {},
    },
  })
  assert.equal(isVerifiedCatalogLoader(loader), true)
  const page = await loader({ page: 1, pageSize: 10, signal: new AbortController().signal })
  assert.equal(calls[0].name, READ_ONLY_SEO_CATALOG_RPC)
  assert.equal(calls[0].args.p_host, "www.3djewish.test")
  assert.equal(typeof calls[0].args.p_limit, "number")
  assert.equal(Number.isInteger(calls[0].args.p_limit), true)
  assert.equal("p_tenant_id" in calls[0].args, false)
  assert.equal("tenantId" in calls[0].args, false)
  assert.equal(page.countKind, "exact")
  assert.equal(page.totalCount, 1)
  assert.equal(page.nextPage, null)
  assert.deepEqual(writeAttempts, [])
})

test("batch loader fail-closes unavailable and keeps enforcement false", async () => {
  const loader = createProductSeoBatchCatalogLoader({
    host: "disabled.test",
    supabase: {
      rpc() {
        return Promise.resolve({ data: failEnvelope("catalog_unavailable"), error: null })
      },
    },
  })
  const report = await runProductSeoShadowV1({
    context: context(),
    loadCatalog: loader,
  })
  assert.equal(report.reason, "catalog_unavailable")
  assert.equal(report.catalogComplete, false)
  assert.equal(report.usableForEnforcement, false)
  assert.equal(report.loaderKind, "official")
  assert.equal(report.products.length, 0)
})

test("batch loader feeds shadow runner only; truncated stays unproven", async () => {
  const products = Array.from({ length: 500 }, (_, i) => ({
    ...envelope().products[0],
    productId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
    slug: `p-${i}`,
    name: `Product ${i}`,
  }))
  const loader = createProductSeoBatchCatalogLoader({
    host: "bulk.test",
    supabase: {
      rpc() {
        return Promise.resolve({
          data: envelope({
            truncated: true,
            catalogComplete: false,
            totalCount: 501,
            returnedCount: 500,
            effectiveLimit: 500,
            catalogFingerprint: null,
            products,
          }),
          error: null,
        })
      },
    },
  })
  const report = await runProductSeoShadowV1({
    context: context(),
    loadCatalog: loader,
    limit: 500,
  })
  assert.equal(report.usableForEnforcement, false)
  assert.equal(report.catalogComplete, false)
  assert.equal(report.completeness === "proven", false)
  assert.equal(report.loaderKind, "official")
})

test("read-only wrapper allows product-seo-catalog/v1 rpc and blocks writes", () => {
  const writeAttempts = []
  const guarded = wrapReadOnlySupabase(
    {
      rpc() {
        return Promise.resolve({ data: envelope(), error: null })
      },
      insert() {},
    },
    writeAttempts,
  )
  assert.doesNotThrow(() => guarded.rpc(READ_ONLY_SEO_CATALOG_RPC, { p_host: "3djewish.test" }))
  assert.throws(() => guarded.insert())
  assert.throws(() => guarded.rpc("public_get_product_by_host_and_slug", { p_host: "x" }))
})

test("consumer docs and parser name the contract, not worktree paths", () => {
  const parser = readFileSync(join(root, "src/lib/productSeoBatchCatalogV1.js"), "utf8")
  const docs = readFileSync(join(root, "ops/seo001/PRODUCT-SEO-CATALOG-V1-CONSUMER.md"), "utf8")
  const contract = JSON.parse(readFileSync(join(root, "docs/contracts/product-seo-catalog-v1.json"), "utf8"))
  assert.equal(parser.includes(PRODUCT_SEO_CATALOG_CONTRACT_VERSION), true)
  assert.equal(docs.includes("product-seo-catalog/v1"), true)
  assert.equal(docs.includes("wt-just-"), false)
  assert.equal(parser.includes("/Users/"), false)
  assert.equal(contract.arguments.p_limit.type, "jsonb")
  assert.equal(contract.fingerprint.pattern, "^sha256:[0-9a-f]{64}$")
})
