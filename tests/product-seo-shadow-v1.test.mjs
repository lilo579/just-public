import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { adaptCatalogProductToSeoInputV1 } from "../src/lib/productSeoCatalogAdapterV1.js"
import {
  resolveProductSeoCanonicalContextV1,
  isTrustedCanonicalContext,
  CANONICAL_CONTEXT_BRAND,
} from "../src/lib/productSeoCanonicalContextV1.js"
import {
  runProductSeoShadowV1,
  redactShadowValue,
  createHostBoundCatalogLoader,
  wrapReadOnlySupabase,
  loadProductSeoCanonicalContextV1,
  isVerifiedCatalogLoader,
  liveCatalogLoaderGate,
  READ_ONLY_CATALOG_RPC,
  READ_ONLY_CANONICAL_RPC,
  SHADOW_DEFAULT_LIMIT,
} from "../src/lib/productSeoShadowRunnerV1.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const fixtureDir = join(root, "tests/fixtures/product-seo-compiler")

function loadJson(name) {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8"))
}

const f3 = loadJson("source-f3-rpc-list.json")
const factoryB = loadJson("source-factory-b.json")
const jewish = loadJson("jewish-118.json")

function assertSyntheticReport(report) {
  assert.equal(report.readOnlyExecution, "unverified")
  assert.equal(report.loaderKind, "synthetic")
  assert.equal(report.writesObserved, null)
  assert.equal(report.writes, null)
}

function assertVerifiedReport(report, writes = []) {
  assert.equal(report.readOnlyExecution, "verified")
  assert.equal(report.loaderKind, "official")
  assert.deepEqual(report.writesObserved, writes)
  assert.deepEqual(report.writes, writes)
}

function contextFrom(fix, extra = {}) {
  const requestHost = extra.requestHost ?? extra.host ?? fix.host
  const expectedTenantId = extra.expectedTenantId ?? fix.expectedTenantId
  const canonicalContext =
    extra.canonicalContext ||
    resolveProductSeoCanonicalContextV1({
      requestHost,
      expectedTenantId,
      authority: extra.authority || {
        kind: "rpc",
        row: extra.canonicalRpc || fix.canonicalRpc,
      },
      publication: extra.publication,
    })
  return {
    expectedTenantId,
    host: requestHost,
    brand: extra.brand ?? fix.brand,
    catalogEnabled: true,
    tenantActive: true,
    ...extra,
    canonicalContext,
  }
}

async function shadow(fix, rows = fix.products, extra = {}) {
  return runProductSeoShadowV1({
    context: contextFrom(fix),
    loadCatalog: async () => ({ rows, nextPage: null }),
    ...extra,
  })
}

test("adapter maps F3 RPC list without inventing currency or description", () => {
  const row = f3.products[0]
  const adapted = adaptCatalogProductToSeoInputV1(row, contextFrom(f3))
  assert.equal(adapted.ok, true)
  assert.equal(adapted.input.productId, row.product_id)
  assert.equal(adapted.input.lineName, "Classic")
  assert.equal(adapted.input.name, "Ouro")
  assert.equal(adapted.input.canonicalUrl, "https://f3.example.test/p/classic-ouro")
  assert.equal(adapted.input.description, "")
  assert.equal("currency" in adapted.input, false)
  assert.equal("availability" in adapted.input, false)
  assert.equal(adapted.fieldProvenance.description.present, false)
  assert.equal(adapted.fieldProvenance.currency.present, false)
  assert.equal(adapted.fieldProvenance.canonicalUrl.origin, "context.canonical+slug")
  assert.deepEqual(adapted.input.images, ["https://cdn.example.test/f3/classic-ouro.webp"])
  assert.equal("visible" in adapted.input, false)
  assert.equal(adapted.fieldProvenance.visible.present, false)
})

test("adapter maps factory-b title/media/sku schema", () => {
  const adapted = adaptCatalogProductToSeoInputV1(factoryB.products[0], contextFrom(factoryB))
  assert.equal(adapted.ok, true)
  assert.equal(adapted.input.name, "Terracota")
  assert.equal(adapted.input.publicProductCode, "B-MESA-A")
  assert.equal(adapted.input.currency, "BRL")
  assert.equal(adapted.input.availability, "https://schema.org/InStock")
  assert.deepEqual(adapted.input.images, ["https://cdn.example.test/b/mesa.webp"])
  assert.equal(adapted.fieldProvenance.name.origin, "source.title")
  assert.equal(adapted.fieldProvenance.images.origin, "source.media")
})

test("adapter fails closed on tenant and host divergence", () => {
  const row = f3.products[0]
  const tenant = adaptCatalogProductToSeoInputV1(
    { ...row, tenant_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
    contextFrom(f3),
  )
  assert.equal(tenant.ok, false)
  assert.equal(tenant.reason, "tenant_mismatch")

  const host = adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { host: "evil.example.test" }))
  assert.equal(host.ok, false)
  assert.equal(host.reason, "host_mismatch")

  const sourced = adaptCatalogProductToSeoInputV1({ ...row, host: "other.example.test" }, contextFrom(f3))
  assert.equal(sourced.ok, false)
  assert.equal(sourced.reason, "host_mismatch")

  const unknown = adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { host: "" }))
  assert.equal(unknown.ok, false)
  assert.equal(unknown.reason, "unknown_host")

  const forged = adaptCatalogProductToSeoInputV1(row, {
    expectedTenantId: f3.expectedTenantId,
    host: f3.host,
    canonical: { ...f3.canonical, isPrimaryRequest: true },
  })
  assert.equal(forged.ok, false)
  assert.equal(forged.reason, "missing_canonical_context")
})

test("adapter rejects malformed source and missing product id", () => {
  assert.equal(adaptCatalogProductToSeoInputV1(null, contextFrom(f3)).reason, "malformed_source")
  assert.equal(adaptCatalogProductToSeoInputV1("x", contextFrom(f3)).reason, "malformed_source")
  const missing = adaptCatalogProductToSeoInputV1({ tenant_id: f3.expectedTenantId, name: "X" }, contextFrom(f3))
  assert.equal(missing.ok, false)
  assert.equal(missing.reason, "missing_product_id")
})

test("shadow F3 fixture: collision pair needs_input; unique auto_ready", async () => {
  const report = await shadow(f3)
  assert.equal(report.mode, "shadow-report-only")
  assertSyntheticReport(report)
  assert.equal(report.publishesHtml, false)
  assert.equal(report.metrics.total, 4)
  assert.equal(report.metrics.auto_ready, 2)
  assert.equal(report.metrics.needs_input, 2)
  assert.equal(report.metrics.collisions, 1)
  assert.equal(report.metrics.blockingErrors.duplicate_effective_name, 2)
  assert.ok(report.comparisons.every((row) => typeof row.current.title === "string"))
  assert.ok(report.comparisons.some((row) => row.proposed.h1.includes("Classic")))
  const ouro = report.comparisons.find((row) => row.current.h1 === "Ouro")
  assert.equal(ouro.proposed.h1, "Classic · Ouro")
  assert.equal(ouro.h1Changed, true)
})

test("shadow factory-b emits offers when currency and availability exist", async () => {
  const report = await shadow(factoryB)
  assert.equal(report.metrics.total, 2)
  assert.equal(report.metrics.auto_ready, 2)
  assert.equal(report.metrics.richResultEligible, 2)
})

test("shadow Jewish 118 real snapshot: 112 auto_ready / 6 needs_input", async () => {
  const report = await runProductSeoShadowV1({
    context: contextFrom(jewish, {
      expectedTenantId: jewish.products[0].tenantId,
      host: jewish.host,
      brand: jewish.tenantBrand,
    }),
    loadCatalog: async () => ({ rows: jewish.products, nextPage: null }),
  })
  assert.equal(report.metrics.total, 118)
  assert.equal(report.metrics.auto_ready, 112)
  assert.equal(report.metrics.needs_input, 6)
  assert.equal(report.metrics.indexingProposed, 112)
  assert.equal(report.rejectedCount, 0)
  assert.equal(report.completeness, "unknown")
  assert.equal(report.catalogComplete, false)
  assert.equal(report.usableForEnforcement, false)
  assertSyntheticReport(report)
  assert.equal(JSON.stringify(report).includes("whatsapp"), false)
})

test("tenant without products", async () => {
  const report = await shadow(f3, [])
  assert.equal(report.metrics.total, 0)
  assert.equal(report.adaptedCount, 0)
  assert.equal(report.publishesSitemap, false)
})

test("pagination concatenates pages up to limit", async () => {
  const pages = [f3.products.slice(0, 2), f3.products.slice(2)]
  const report = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    loadCatalog: async ({ page }) => ({
      rows: pages[page - 1] || [],
      nextPage: page < pages.length ? page + 1 : null,
    }),
  })
  assert.equal(report.pagesRead, 2)
  assert.equal(report.metrics.total, 4)

  const limited = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    limit: 2,
    loadCatalog: async ({ page }) => ({
      rows: pages[page - 1] || [],
      nextPage: page < pages.length ? page + 1 : null,
    }),
  })
  assert.equal(limited.metrics.total, 2)
  assert.equal(limited.catalogComplete, false)
  assert.equal(limited.incomplete, true)
  assert.equal(limited.incompleteReason, "limit")
  assert.equal(limited.usableForEnforcement, false)
})

test("timeout after a partial page does not present a complete catalog", async () => {
  const report = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    timeoutMs: 30,
    loadCatalog: async ({ page }) => {
      if (page === 1) {
        return {
          rows: f3.products.slice(0, 2),
          nextPage: 2,
          countKind: "exact",
          totalCount: 4,
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 80))
      return { rows: f3.products.slice(2), nextPage: null, countKind: "exact", totalCount: 4 }
    },
  })
  assert.equal(report.ok, false)
  assert.equal(report.reason, "timeout")
  assert.equal(report.metrics.total, 0)
  assert.equal(report.catalogComplete, false)
  assert.equal(report.usableForEnforcement, false)
})

test("timeout still fail-closes if the loader returns rows after abort", async () => {
  const timed = await runProductSeoShadowV1({
    context: contextFrom(f3),
    timeoutMs: 20,
    loadCatalog: async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return { rows: f3.products, nextPage: null }
    },
  })
  assert.equal(timed.ok, false)
  assert.equal(timed.reason, "timeout")
  assert.equal(timed.metrics.total, 0)
  assert.equal(timed.catalogComplete, false)
})

test("host-bound loader fails closed on RPC error instead of empty catalog", async () => {
  const loader = createHostBoundCatalogLoader({
    host: f3.host,
    supabase: {
      rpc() {
        return Promise.resolve({ data: null, error: { message: "boom" } })
      },
    },
  })
  const report = await runProductSeoShadowV1({
    context: contextFrom(f3),
    loadCatalog: loader,
  })
  assert.equal(report.ok, false)
  assert.equal(report.reason, "rpc_error")
  assert.equal(report.metrics.total, 0)
  assert.equal(report.catalogComplete, false)
  assertVerifiedReport(report)
})

test("timeout and abort fail closed without products", async () => {
  const timed = await runProductSeoShadowV1({
    context: contextFrom(f3),
    timeoutMs: 20,
    loadCatalog: ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const err = new Error("aborted")
          err.name = "AbortError"
          reject(err)
        })
      }),
  })
  assert.equal(timed.ok, false)
  assert.equal(timed.reason, "timeout")
  assert.equal(timed.metrics.total, 0)

  const ac = new AbortController()
  ac.abort()
  const aborted = await runProductSeoShadowV1({
    context: contextFrom(f3),
    signal: ac.signal,
    loadCatalog: async () => ({ rows: f3.products, nextPage: null }),
  })
  assert.equal(aborted.ok, false)
  assert.equal(aborted.reason, "aborted")
})

test("malformed page payload fails closed", async () => {
  const report = await runProductSeoShadowV1({
    context: contextFrom(f3),
    loadCatalog: async () => ({ rows: "nope" }),
  })
  assert.equal(report.ok, false)
  assert.equal(report.reason, "malformed_page")
})

test("sequential and concurrent catalogs stay isolated", async () => {
  const a = await shadow(f3)
  const b = await shadow(factoryB)
  const a2 = await shadow(f3)
  assert.equal(JSON.stringify(a.metrics), JSON.stringify(a2.metrics))
  assert.equal(a.metrics.needs_input, 2)
  assert.equal(b.metrics.needs_input, 0)

  const [c1, c2] = await Promise.all([shadow(f3), shadow(factoryB)])
  assert.equal(c1.metrics.total, 4)
  assert.equal(c2.metrics.total, 2)
  assert.equal(
    c1.products.some((row) => String(row.productId).includes("bbbb")),
    false,
  )
})

test("zero writes and no runtime import of adapter/runner", () => {
  const pages = readFileSync(join(root, "src/pages/p/[slug].astro"), "utf8")
  const sitemap = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8")
  const robots = readFileSync(join(root, "src/pages/robots.txt.ts"), "utf8")
  const middleware = readFileSync(join(root, "src/middleware.ts"), "utf8")
  for (const body of [pages, sitemap, robots, middleware]) {
    assert.equal(body.includes("productSeoCompilerV1"), false)
    assert.equal(body.includes("productSeoCatalogAdapterV1"), false)
    assert.equal(body.includes("productSeoCanonicalContextV1"), false)
  }
  const runner = readFileSync(join(root, "src/lib/productSeoShadowRunnerV1.js"), "utf8")
  const adapter = readFileSync(join(root, "src/lib/productSeoCatalogAdapterV1.js"), "utf8")
  const canonical = readFileSync(join(root, "src/lib/productSeoCanonicalContextV1.js"), "utf8")
  for (const body of [runner, adapter, canonical]) {
    assert.equal(/\bfetch\s*\(/.test(body), false)
    assert.equal(/createClient\s*\(/.test(body), false)
  }
  assert.equal(/\bwriteFile\s*\(/.test(runner), false)
  assert.equal(/\.insert\s*\(/.test(runner), false)
  assert.equal(/\.update\s*\(/.test(runner), false)
  assert.equal(/\.delete\s*\(/.test(runner), false)
  assert.equal(/\.upsert\s*\(/.test(runner), false)
  assert.equal(runner.includes("writes"), true)
  assert.equal(redactShadowValue("https://cdn.example.test/x.webp"), "[redacted-image]")
  assert.equal(
    redactShadowValue("https://cdn.example.test/x.webp?token=secret-sign"),
    "[redacted-image]",
  )
  assert.equal(redactShadowValue("https://example.test/p?apikey=aaa"), "[redacted-query]")
})

test("host-bound loader uses public_get_products_by_host and does not write", async () => {
  const calls = []
  const writeAttempts = []
  const loader = createHostBoundCatalogLoader({
    host: f3.host,
    writeAttempts,
    supabase: {
      rpc(name, args) {
        calls.push({ name, args })
        return Promise.resolve({ data: f3.products, error: null })
      },
      insert() {
        calls.push({ name: "insert" })
      },
    },
  })
  const page = await loader({ page: 1, pageSize: 10, signal: new AbortController().signal })
  assert.equal(isVerifiedCatalogLoader(loader), true)
  assert.equal(calls[0].name, READ_ONLY_CATALOG_RPC)
  assert.equal(calls[0].args.p_host, f3.host)
  assert.equal(page.rows.length, 4)
  assert.equal(page.nextPage, null)
  assert.deepEqual(writeAttempts, [])
  assert.equal(calls.some((item) => item.name === "insert"), false)
})

test("read-only wrapper records write attempts and blocks non-catalog RPC", () => {
  const writeAttempts = []
  const guarded = wrapReadOnlySupabase(
    {
      rpc() {
        return Promise.resolve({ data: [], error: null })
      },
      insert() {},
    },
    writeAttempts,
  )
  assert.throws(() => guarded.insert())
  assert.deepEqual(writeAttempts, ["insert"])
  assert.throws(() => guarded.rpc("public_get_product_by_host_and_slug", { p_host: f3.host }))
  assert.equal(writeAttempts.includes("rpc:public_get_product_by_host_and_slug"), true)
  const allowed = wrapReadOnlySupabase(
    {
      rpc(name) {
        return Promise.resolve({ data: [{ ok: name }], error: null })
      },
    },
    [],
  )
  assert.equal(typeof guarded.rpc, "function")
  assert.doesNotThrow(() => allowed.rpc(READ_ONLY_CANONICAL_RPC, { p_host: f3.host }))
  assert.doesNotThrow(() => allowed.rpc(READ_ONLY_CATALOG_RPC, { p_host: f3.host }))
})

test("injected loader that tries to write is never verified and never gets writes: []", async () => {
  const report = await runProductSeoShadowV1({
    context: contextFrom(f3),
    loadCatalog: async () => {
      const err = new Error("write_method_blocked")
      err.code = "write_method_blocked"
      err.method = "insert"
      throw err
    },
  })
  assert.equal(report.ok, false)
  assert.equal(report.reason, "write_attempted")
  assertSyntheticReport(report)
  assert.equal(report.usableForEnforcement, false)
})

test("material/dimensions become variantAttributes; description is not parsed", () => {
  const adapted = adaptCatalogProductToSeoInputV1(
    {
      tenant_id: f3.expectedTenantId,
      product_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000099",
      name: "Unico",
      slug: "unico",
      line_name: "Linha",
      description: "Cor Marinho Cosset haste vertical",
      material: "Acrílico",
      dimensions: "10cm",
    },
    contextFrom(f3),
  )
  assert.equal(adapted.ok, true)
  assert.deepEqual(adapted.input.variantAttributes, ["Acrílico", "10cm"])
  assert.equal(adapted.input.description, "Cor Marinho Cosset haste vertical")
  assert.equal(adapted.fieldProvenance.variantAttributes.origin, "source.material,source.dimensions")
})

test("alias conflicts fail closed; equivalent Unicode and numeric price are accepted", () => {
  const row = f3.products[0]
  const conflictName = adaptCatalogProductToSeoInputV1(
    { ...row, name: "Ouro", title: "Prata" },
    contextFrom(f3),
  )
  assert.equal(conflictName.ok, false)
  assert.equal(conflictName.reason, "alias_conflict_name")

  const conflictId = adaptCatalogProductToSeoInputV1(
    { ...row, productId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000099" },
    contextFrom(f3),
  )
  assert.equal(conflictId.ok, false)
  assert.equal(conflictId.reason, "alias_conflict_productId")

  const conflictType = adaptCatalogProductToSeoInputV1(
    { ...row, title: 90 },
    contextFrom(f3),
  )
  assert.equal(conflictType.ok, false)
  assert.equal(conflictType.reason, "alias_conflict_name")

  const conflictImages = adaptCatalogProductToSeoInputV1(
    {
      ...row,
      images: ["https://cdn.example.test/f3/classic-ouro.webp"],
      media: [{ url: "https://cdn.example.test/f3/other.webp" }],
    },
    contextFrom(f3),
  )
  assert.equal(conflictImages.ok, false)
  assert.equal(conflictImages.reason, "alias_conflict_images")

  const nfc = "Café"
  const nfd = "Cafe\u0301"
  const unicode = adaptCatalogProductToSeoInputV1(
    { ...row, name: nfc, title: nfd },
    contextFrom(f3),
  )
  assert.equal(unicode.ok, true)
  assert.equal(unicode.input.name, nfc)

  const folded = adaptCatalogProductToSeoInputV1(
    { ...row, name: "Café", title: "Cafe" },
    contextFrom(f3),
  )
  assert.equal(folded.ok, true)

  const priceEq = adaptCatalogProductToSeoInputV1(
    { ...row, price: 90, unit_price: "90" },
    contextFrom(f3),
  )
  assert.equal(priceEq.ok, true)
  assert.equal(Number(priceEq.input.price), 90)

  const imageEq = adaptCatalogProductToSeoInputV1(
    {
      ...row,
      images: ["https://cdn.example.test/f3/classic-ouro.webp"],
      media: [{ url: "https://cdn.example.test/f3/classic-ouro.webp" }],
    },
    contextFrom(f3),
  )
  assert.equal(imageEq.ok, true)
  assert.deepEqual(imageEq.input.images, ["https://cdn.example.test/f3/classic-ouro.webp"])
})

test("pagination is stable, dedupes equivalent ids, and fail-closes on divergent duplicates", async () => {
  const reversed = [...f3.products].reverse()
  const stable = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    loadCatalog: async ({ page }) => ({
      rows: reversed.slice((page - 1) * 2, page * 2),
      nextPage: page < 2 ? page + 1 : null,
    }),
  })
  assert.deepEqual(
    stable.products.map((row) => row.productId),
    [...f3.products.map((row) => row.product_id)].sort(),
  )
  assert.equal(stable.catalogComplete, false)
  assert.equal(stable.completeness, "unknown")
  assert.equal(stable.usableForEnforcement, false)

  const dup = f3.products[0]
  const deduped = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    loadCatalog: async ({ page }) => ({
      rows: page === 1 ? [dup, f3.products[1]] : [dup],
      nextPage: page === 1 ? 2 : null,
    }),
  })
  assert.equal(deduped.metrics.total, 2)
  assert.equal(deduped.adaptedCount, 2)

  const conflict = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 1,
    loadCatalog: async ({ page }) => ({
      rows:
        page === 1
          ? [dup]
          : [{ ...dup, name: "Outro nome" }],
      nextPage: page === 1 ? 2 : null,
    }),
  })
  assert.equal(conflict.ok, false)
  assert.equal(conflict.reason, "duplicate_product_id_conflict")
  assert.equal(conflict.catalogComplete, false)
  assert.equal(conflict.usableForEnforcement, false)
})

test("empty page ends; limit 500 stops before over-consume; partial is not complete", async () => {
  const ended = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 4,
    loadCatalog: async ({ page }) => ({
      rows: page === 1 ? f3.products : [],
      nextPage: page === 1 ? 2 : null,
    }),
  })
  assert.equal(ended.pagesRead, 2)
  assert.equal(ended.metrics.total, 4)
  assert.equal(ended.catalogComplete, false)
  assert.equal(ended.completeness, "unknown")
  assert.equal(ended.usableForEnforcement, false)

  let maxPage = 0
  const rows = Array.from({ length: 600 }, (_, i) => ({
    tenant_id: f3.expectedTenantId,
    product_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
    name: `P${i}`,
    slug: `p-${i}`,
    line_name: "Solo",
    price: 10,
  }))
  const limited = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 100,
    limit: SHADOW_DEFAULT_LIMIT,
    loadCatalog: async ({ page, pageSize }) => {
      maxPage = Math.max(maxPage, page)
      const start = (page - 1) * pageSize
      return {
        rows: rows.slice(start, start + pageSize),
        nextPage: start + pageSize < rows.length ? page + 1 : null,
      }
    },
  })
  assert.equal(limited.metrics.total, 500)
  assert.equal(limited.incomplete, true)
  assert.equal(limited.catalogComplete, false)
  assert.equal(limited.usableForEnforcement, false)
  assert.equal(maxPage, 5)
  assert.ok(maxPage < 7)
})

test("canonicalContext: apex, www alias, non-primary, other tenant, missing, unavailable, malformed", async () => {
  const row = f3.products[0]
  const apex = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: f3.canonicalRpc },
  })
  assert.equal(apex.ok, true)
  assert.equal(apex.relation, "primary")
  assert.equal(apex.primaryHost, f3.host)
  assert.equal(adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: apex })).ok, true)

  const www = resolveProductSeoCanonicalContextV1({
    requestHost: `www.${f3.host}`,
    expectedTenantId: f3.expectedTenantId,
    authority: {
      kind: "rpc",
      row: {
        ...f3.canonicalRpc,
        request_host: `www.${f3.host}`,
        is_primary_request: false,
      },
    },
  })
  assert.equal(www.ok, true)
  assert.equal(www.relation, "www_alias")
  assert.equal(www.canonical.host, f3.host)
  const wwwAdapted = adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: www }))
  assert.equal(wwwAdapted.ok, true)
  assert.equal(wwwAdapted.input.canonicalUrl, "https://f3.example.test/p/classic-ouro")

  const notPrimary = resolveProductSeoCanonicalContextV1({
    requestHost: "shop.f3.example.test",
    expectedTenantId: f3.expectedTenantId,
    authority: {
      kind: "rpc",
      row: {
        ...f3.canonicalRpc,
        request_host: "shop.f3.example.test",
        is_primary_request: false,
      },
    },
  })
  assert.equal(notPrimary.ok, false)
  assert.equal(notPrimary.reason, "host_not_primary")
  assert.equal(adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: notPrimary })).ok, false)

  const otherTenant = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: {
      kind: "rpc",
      row: { ...f3.canonicalRpc, tenant_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
    },
  })
  assert.equal(otherTenant.ok, false)
  assert.equal(otherTenant.reason, "tenant_mismatch")

  const missing = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "payload", payload: { tenantId: f3.expectedTenantId, canonical: null } },
  })
  assert.equal(missing.ok, false)
  assert.equal(missing.reason, "missing_canonical_authority")

  const unavailable = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "unavailable" },
  })
  assert.equal(unavailable.ok, false)
  assert.equal(unavailable.reason, "canonical_authority_unavailable")
  const shadowUnavailable = await runProductSeoShadowV1({
    context: contextFrom(f3, { canonicalContext: unavailable }),
    loadCatalog: async () => ({ rows: f3.products, nextPage: null }),
  })
  assert.equal(shadowUnavailable.ok, false)
  assert.equal(shadowUnavailable.completeness, "incomplete")
  assert.equal(shadowUnavailable.catalogComplete, false)

  const malformed = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: "nope" },
  })
  assert.equal(malformed.ok, false)
  assert.equal(malformed.reason, "malformed_canonical_authority")

  const payloadOk = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: {
      kind: "payload",
      payload: {
        tenantId: f3.expectedTenantId,
        canonical: f3.canonical,
        publication: {
          contractVersion: "v1",
          present: true,
          indexingEnabled: true,
          domainState: "domain_bound",
          seoState: "seo_validated",
          canonicalHost: f3.host,
        },
      },
    },
  })
  assert.equal(payloadOk.ok, true)
  assert.equal(payloadOk.source, "payload")
})

test("completeness requires exact total; silent cap and mismatches stay unproven or incomplete", async () => {
  const mk = (i) => ({
    tenant_id: f3.expectedTenantId,
    product_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
    name: `P${i}`,
    slug: `p-${i}`,
    line_name: "Solo",
    price: 10,
  })
  const four = [mk(1), mk(2), mk(3), mk(4)]

  const exactPage = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 4,
    loadCatalog: async () => ({
      rows: four,
      nextPage: null,
      countKind: "exact",
      totalCount: 4,
      snapshotVersion: "v1",
    }),
  })
  assert.equal(exactPage.metrics.total, 4)
  assert.equal(exactPage.catalogComplete, true)
  assert.equal(exactPage.completeness, "proven")
  assert.equal(exactPage.usableForEnforcement, false)

  const oneAbove = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    loadCatalog: async ({ page }) => ({
      rows: page === 1 ? four.slice(0, 2) : [four[2]],
      nextPage: page === 1 ? 2 : null,
      countKind: "exact",
      totalCount: 3,
      snapshotVersion: "v1",
    }),
  })
  assert.equal(oneAbove.metrics.total, 3)
  assert.equal(oneAbove.completeness, "proven")

  const silent = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 4,
    loadCatalog: async () => ({ rows: four, nextPage: null }),
  })
  assert.equal(silent.completeness, "unknown")
  assert.equal(silent.completenessReason, "unproven_silent_cap")
  assert.equal(silent.catalogComplete, false)

  const totalGreater = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 4,
    loadCatalog: async () => ({
      rows: four,
      nextPage: null,
      countKind: "exact",
      totalCount: 9,
    }),
  })
  assert.equal(totalGreater.completeness, "incomplete")
  assert.equal(totalGreater.completenessReason, "total_greater_than_received")
  assert.equal(totalGreater.metrics.total, 4)

  const totalLess = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 4,
    loadCatalog: async () => ({
      rows: four,
      nextPage: null,
      countKind: "exact",
      totalCount: 2,
    }),
  })
  assert.equal(totalLess.completeness, "incomplete")
  assert.equal(totalLess.completenessReason, "total_less_than_received")

  const changing = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    loadCatalog: async ({ page }) => ({
      rows: page === 1 ? four.slice(0, 2) : four.slice(2),
      nextPage: page === 1 ? 2 : null,
      countKind: "exact",
      totalCount: page === 1 ? 4 : 5,
      snapshotVersion: "v1",
    }),
  })
  assert.equal(changing.completeness, "incomplete")
  assert.equal(changing.completenessReason, "total_changed")

  const premature = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    loadCatalog: async ({ page }) => ({
      rows: page === 1 ? four.slice(0, 2) : [],
      nextPage: page === 1 ? 2 : null,
      countKind: "exact",
      totalCount: 4,
    }),
  })
  assert.equal(premature.completeness, "incomplete")
  assert.equal(premature.completenessReason, "premature_empty_page")
  assert.equal(premature.metrics.total, 2)

  const versionDrift = await runProductSeoShadowV1({
    context: contextFrom(f3),
    pageSize: 2,
    loadCatalog: async ({ page }) => ({
      rows: page === 1 ? four.slice(0, 2) : four.slice(2),
      nextPage: page === 1 ? 2 : null,
      countKind: "exact",
      totalCount: 4,
      snapshotVersion: page === 1 ? "v1" : "v2",
    }),
  })
  assert.equal(versionDrift.completeness, "incomplete")
  assert.equal(versionDrift.completenessReason, "snapshot_version_changed")
})

test("canonical loader uses public_host_canonical_authority and fails closed when unavailable", async () => {
  const calls = []
  const ctx = await loadProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    supabase: {
      rpc(name, args) {
        calls.push({ name, args })
        return Promise.resolve({ data: [f3.canonicalRpc], error: null })
      },
    },
  })
  assert.equal(calls[0].name, READ_ONLY_CANONICAL_RPC)
  assert.equal(ctx.ok, true)
  assert.equal(ctx.primaryHost, f3.host)
  assert.equal(isTrustedCanonicalContext(ctx), true)

  const down = await loadProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    supabase: {
      rpc() {
        return Promise.resolve({ data: null, error: { message: "down" } })
      },
    },
  })
  assert.equal(down.ok, false)
  assert.equal(down.reason, "canonical_authority_unavailable")
})

test("canonical context is a WeakSet capability, not a public brand string", async () => {
  const row = f3.products[0]
  const apex = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: f3.canonicalRpc },
    publication: {
      contractVersion: "v1",
      present: true,
      indexingEnabled: true,
      domainState: "domain_bound",
      seoState: "seo_validated",
      canonicalHost: f3.host,
    },
  })
  assert.equal(isTrustedCanonicalContext(apex), true)
  assert.equal(Object.isFrozen(apex), true)
  assert.equal(Object.isFrozen(apex.canonical), true)
  assert.equal(Object.isFrozen(apex.publication), true)

  const forged = {
    brand: CANONICAL_CONTEXT_BRAND,
    ok: true,
    trustedForShadow: true,
    reason: null,
    source: "rpc",
    requestHost: "evil.example.test",
    tenantId: f3.expectedTenantId,
    primaryHost: "evil.example.test",
    relation: "primary",
    isPrimaryRequest: true,
    canonical: {
      host: "evil.example.test",
      origin: "https://evil.example.test",
      requestHost: "evil.example.test",
      isPrimaryRequest: true,
    },
  }
  assert.equal(isTrustedCanonicalContext(forged), false)
  const forgedAdapted = adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: forged }))
  assert.equal(forgedAdapted.ok, false)

  const spread = { ...apex }
  assert.equal(isTrustedCanonicalContext(spread), false)
  assert.equal(
    adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: spread })).ok,
    false,
  )

  const jsonClone = JSON.parse(JSON.stringify(apex))
  assert.equal(isTrustedCanonicalContext(jsonClone), false)
  assert.equal(
    adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: jsonClone })).ok,
    false,
  )

  const copied = {}
  for (const key of Object.getOwnPropertyNames(apex)) copied[key] = apex[key]
  for (const sym of Object.getOwnPropertySymbols(apex)) copied[sym] = apex[sym]
  assert.equal(isTrustedCanonicalContext(copied), false)

  const other = resolveProductSeoCanonicalContextV1({
    requestHost: factoryB.host,
    expectedTenantId: factoryB.expectedTenantId,
    authority: { kind: "rpc", row: factoryB.canonicalRpc },
  })
  assert.equal(isTrustedCanonicalContext(other), true)
  const swapped = adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: other }))
  assert.equal(swapped.ok, false)
  assert.equal(swapped.reason, "tenant_mismatch")

  assert.throws(() => {
    apex.tenantId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  })
  assert.throws(() => {
    apex.primaryHost = "evil.example.test"
  })
  assert.throws(() => {
    apex.relation = "www_alias"
  })
  assert.throws(() => {
    apex.canonical.host = "evil.example.test"
  })
  if (apex.publication && typeof apex.publication === "object") {
    assert.throws(() => {
      apex.publication.canonicalHost = "evil.example.test"
    })
  }
  assert.equal(apex.tenantId, f3.expectedTenantId)
  assert.equal(apex.canonical.host, f3.host)
  assert.equal(isTrustedCanonicalContext(apex), true)
  assert.equal(adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: apex })).ok, true)
})

test("RPC request_host must be present and match apex or www; missing or divergent fail closed", async () => {
  const row = f3.products[0]
  const { request_host: _dropped, ...withoutHost } = f3.canonicalRpc

  const apexPresent = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: f3.canonicalRpc },
  })
  assert.equal(apexPresent.ok, true)
  assert.equal(apexPresent.relation, "primary")
  assert.equal(isTrustedCanonicalContext(apexPresent), true)

  const wwwPresent = resolveProductSeoCanonicalContextV1({
    requestHost: `www.${f3.host}`,
    expectedTenantId: f3.expectedTenantId,
    authority: {
      kind: "rpc",
      row: {
        ...f3.canonicalRpc,
        request_host: `www.${f3.host}`,
        is_primary_request: false,
      },
    },
  })
  assert.equal(wwwPresent.ok, true)
  assert.equal(wwwPresent.relation, "www_alias")
  assert.equal(isTrustedCanonicalContext(wwwPresent), true)
  assert.equal(
    adaptCatalogProductToSeoInputV1(row, contextFrom(f3, { canonicalContext: wwwPresent })).input.canonicalUrl,
    "https://f3.example.test/p/classic-ouro",
  )

  const apexMissing = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: withoutHost },
  })
  assert.equal(apexMissing.ok, false)
  assert.equal(apexMissing.reason, "malformed_canonical_authority")
  assert.equal(isTrustedCanonicalContext(apexMissing), false)

  const wwwMissing = resolveProductSeoCanonicalContextV1({
    requestHost: `www.${f3.host}`,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: { ...withoutHost, is_primary_request: false } },
  })
  assert.equal(wwwMissing.ok, false)
  assert.equal(wwwMissing.reason, "malformed_canonical_authority")
  assert.equal(isTrustedCanonicalContext(wwwMissing), false)

  const emptyHost = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: { ...f3.canonicalRpc, request_host: "   " } },
  })
  assert.equal(emptyHost.ok, false)
  assert.equal(emptyHost.reason, "malformed_canonical_authority")

  const invalidType = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: { ...f3.canonicalRpc, request_host: 1 } },
  })
  assert.equal(invalidType.ok, false)
  assert.equal(invalidType.reason, "malformed_canonical_authority")

  const apexDivergent = resolveProductSeoCanonicalContextV1({
    requestHost: f3.host,
    expectedTenantId: f3.expectedTenantId,
    authority: { kind: "rpc", row: { ...f3.canonicalRpc, request_host: "other.example.test" } },
  })
  assert.equal(apexDivergent.ok, false)
  assert.equal(apexDivergent.reason, "host_mismatch")
  assert.equal(isTrustedCanonicalContext(apexDivergent), false)

  const wwwDivergent = resolveProductSeoCanonicalContextV1({
    requestHost: `www.${f3.host}`,
    expectedTenantId: f3.expectedTenantId,
    authority: {
      kind: "rpc",
      row: {
        ...f3.canonicalRpc,
        request_host: f3.host,
        is_primary_request: false,
      },
    },
  })
  assert.equal(wwwDivergent.ok, false)
  assert.equal(wwwDivergent.reason, "host_mismatch")
  assert.equal(isTrustedCanonicalContext(wwwDivergent), false)

  const shadowMissing = await runProductSeoShadowV1({
    context: contextFrom(f3, { canonicalContext: apexMissing }),
    loadCatalog: async () => ({ rows: f3.products, nextPage: null }),
  })
  assert.equal(shadowMissing.ok, false)
  assert.equal(shadowMissing.catalogComplete, false)
  assert.equal(shadowMissing.completeness, "incomplete")
  assert.equal(shadowMissing.metrics.total, 0)
})

test("official loader is verified; wrapper insert aborts with writesObserved; live rejects synthetic", async () => {
  const writeAttempts = []
  const supabase = {
    rpc() {
      return Promise.resolve({ data: f3.products, error: null })
    },
    insert() {},
  }
  const official = createHostBoundCatalogLoader({
    host: f3.host,
    supabase,
    writeAttempts,
  })
  assert.equal(isVerifiedCatalogLoader(official), true)
  assert.deepEqual(liveCatalogLoaderGate(official), { ok: true })

  const okReport = await runProductSeoShadowV1({
    context: contextFrom(f3),
    loadCatalog: official,
  })
  assertVerifiedReport(okReport)
  assert.equal(okReport.metrics.total, 4)
  assert.equal(okReport.completeness, "unknown")
  assert.equal(okReport.catalogComplete, false)

  const blockedAttempts = []
  const blockedClient = {
    rpc() {
      return Promise.resolve({ data: f3.products, error: null })
    },
    insert() {},
  }
  const blockedLoader = createHostBoundCatalogLoader({
    host: f3.host,
    supabase: blockedClient,
    writeAttempts: blockedAttempts,
  })
  const guarded = wrapReadOnlySupabase(blockedClient, blockedAttempts)
  assert.throws(() => guarded.insert())
  const blockedReport = await runProductSeoShadowV1({
    context: contextFrom(f3),
    loadCatalog: blockedLoader,
  })
  assert.equal(blockedReport.ok, false)
  assert.equal(blockedReport.reason, "write_attempted")
  assertVerifiedReport(blockedReport, ["insert"])

  const synthetic = async () => ({ rows: f3.products, nextPage: null })
  assert.equal(isVerifiedCatalogLoader(synthetic), false)
  assert.deepEqual(liveCatalogLoaderGate(synthetic), { ok: false, reason: "unverified_loader" })
  const liveSrc = readFileSync(join(root, "scripts/preview-product-seo-shadow-live-readonly.mjs"), "utf8")
  assert.equal(liveSrc.includes("liveCatalogLoaderGate"), true)
  assert.equal(liveSrc.includes("countKind: \"none\""), false)
  assert.equal(/loadCatalog:\s*async\s*\(\)\s*=>\s*\(\{\s*rows:\s*liveRows/.test(liveSrc), false)
})

