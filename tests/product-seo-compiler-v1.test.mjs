import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  PRODUCT_SEO_COMPILER_VERSION,
  FINGERPRINT_EXCLUDED,
  FINGERPRINT_INCLUDED,
  compileCatalogSeoV1,
  compileProductSeoV1,
  countCodePoints,
  identityKey,
  isIdentityRestatement,
  previewCatalogSeoReportOnly,
  stableStringify,
  validatePublicHttpsUrl,
} from "../src/lib/productSeoCompilerV1.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const fixtureDir = join(root, "tests/fixtures/product-seo-compiler")

function loadFixture(name) {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8"))
}

function byId(rows) {
  return Object.fromEntries(rows.map((row) => [row.productId, row]))
}

const alphaFix = loadFixture("tenant-alpha.json")
const betaFix = loadFixture("tenant-beta.json")
const jewishFix = loadFixture("jewish-118.json")

test("compiler version is stable", () => {
  assert.equal(PRODUCT_SEO_COMPILER_VERSION, "just-product-seo-compiler/v1")
})

test("same input recompiles byte-identical", () => {
  const a = compileCatalogSeoV1(alphaFix.products)
  const b = compileCatalogSeoV1(alphaFix.products)
  assert.equal(stableStringify(a), stableStringify(b))
  assert.equal(JSON.stringify(a), JSON.stringify(b))
})

test("fingerprint changes on relevant input change and stays on noop recompile", () => {
  const base = alphaFix.products[0]
  const once = compileProductSeoV1(base, alphaFix.products)
  const twice = compileProductSeoV1({ ...base }, alphaFix.products)
  assert.equal(once.contentFingerprint, twice.contentFingerprint)

  const renamed = compileProductSeoV1({ ...base, name: "Ouro Fosco" }, alphaFix.products)
  assert.notEqual(renamed.contentFingerprint, once.contentFingerprint)

  const newLine = compileProductSeoV1({ ...base, lineName: "Classic Plus" }, alphaFix.products)
  assert.notEqual(newLine.contentFingerprint, once.contentFingerprint)

  const newDesc = compileProductSeoV1({ ...base, description: "Classic Ouro artesanal" }, alphaFix.products)
  assert.notEqual(newDesc.contentFingerprint, once.contentFingerprint)

  const withTitle = compileProductSeoV1({ ...base, seoTitleOverride: "Anel Classic Ouro | Ateliê Alpha" }, alphaFix.products)
  assert.notEqual(withTitle.contentFingerprint, once.contentFingerprint)

  const withLabel = compileProductSeoV1({ ...base, identityLabelOverride: "Fosco" }, alphaFix.products)
  assert.notEqual(withLabel.contentFingerprint, once.contentFingerprint)

  const withDesc = compileProductSeoV1({ ...base, seoDescriptionOverride: "Anel Classic em ouro." }, alphaFix.products)
  assert.notEqual(withDesc.contentFingerprint, once.contentFingerprint)
})

test("seo title and description overrides are independent; invalid keeps automatic", () => {
  const catalog = alphaFix.products
  const target = catalog[0]
  const auto = compileProductSeoV1(target, catalog)
  assert.equal(auto.state, "auto_ready")

  const titleOnly = compileProductSeoV1({ ...target, seoTitleOverride: "Anel Classic Ouro | Ateliê Alpha" }, catalog)
  assert.equal(titleOnly.state, "auto_ready")
  assert.equal(titleOnly.seoTitleOverrideAccepted, true)
  assert.equal(titleOnly.seoTitle, "Anel Classic Ouro | Ateliê Alpha")
  assert.equal(titleOnly.ogTitle, auto.ogTitle)
  assert.equal(titleOnly.metaDescription, auto.metaDescription)
  assert.equal(titleOnly.effectiveProductName, auto.effectiveProductName)
  assert.equal(titleOnly.imageAlt, auto.imageAlt)

  const descOnly = compileProductSeoV1(
    { ...target, seoDescriptionOverride: "Anel da linha Classic em ouro." },
    catalog,
  )
  assert.equal(descOnly.state, "auto_ready")
  assert.equal(descOnly.seoDescriptionOverrideAccepted, true)
  assert.equal(descOnly.seoTitle, auto.seoTitle)
  assert.equal(descOnly.metaDescription, "Anel da linha Classic em ouro.")
  assert.equal(descOnly.ogDescription, "Anel da linha Classic em ouro.")
  assert.equal(descOnly.jsonLd.description, "Anel da linha Classic em ouro.")
  assert.equal(descOnly.jsonLd.name, auto.effectiveProductName)

  const invalidTitle = compileProductSeoV1(
    { ...target, seoTitleOverride: "<script>alert(1)</script>" },
    catalog,
  )
  assert.equal(invalidTitle.state, "auto_ready")
  assert.equal(invalidTitle.seoTitleOverrideRejected, true)
  assert.equal(invalidTitle.seoTitle, auto.seoTitle)
  assert.equal(invalidTitle.ogTitle, auto.ogTitle)

  const uuidTitle = compileProductSeoV1({ ...target, seoTitleOverride: target.productId }, catalog)
  assert.equal(uuidTitle.seoTitle, auto.seoTitle)
  assert.equal(uuidTitle.seoTitleOverrideRejected, true)

  const tooLong = compileProductSeoV1({ ...target, seoTitleOverride: "A".repeat(80) }, catalog)
  assert.equal(tooLong.seoTitle, auto.seoTitle)
  assert.ok(tooLong.overrideErrors.includes("seo_title_too_long"))
})

test("alpha: structured variants, collision-local, suspended; description does not identify", () => {
  const rows = compileCatalogSeoV1(alphaFix.products)
  const map = byId(rows)
  assert.equal(rows.filter((r) => r.state === "auto_ready").length, 6)
  assert.equal(rows.filter((r) => r.state === "needs_input").length, 2)
  assert.equal(rows.filter((r) => r.state === "suspended").length, 1)

  assert.equal(map["a1111111-1111-4111-8111-000000000001"].effectiveProductName, "Classic · Ouro")
  assert.equal(map["a1111111-1111-4111-8111-000000000003"].effectiveProductName, "Kossot · Marinho · Cosset")
  assert.equal(map["a1111111-1111-4111-8111-000000000004"].effectiveProductName, "Kossot · Marinho · Haste")
  assert.equal(map["a1111111-1111-4111-8111-000000000007"].effectiveProductName, "Gift · Cartão · Vertical")
  assert.equal(map["a1111111-1111-4111-8111-000000000008"].effectiveProductName, "Gift · Cartão · Horizontal")

  const twin = [
    map["a1111111-1111-4111-8111-000000000005"],
    map["a1111111-1111-4111-8111-000000000006"],
  ]
  assert.ok(twin.every((row) => row.state === "needs_input"))
  assert.ok(twin.every((row) => row.effectiveProductName === "Twin · Azul"))
  assert.ok(twin.every((row) => row.errors.includes("duplicate_effective_name")))
  assert.ok(twin.every((row) => row.jsonLd === null))
  assert.ok(twin.every((row) => row.robotsProposed === "noindex,follow"))
  assert.notEqual(twin[0].metaDescription, twin[1].metaDescription)
  assert.equal(map["a1111111-1111-4111-8111-000000000001"].state, "auto_ready")
  assert.equal(map["a1111111-1111-4111-8111-000000000009"].state, "suspended")
  assert.ok(map["a1111111-1111-4111-8111-000000000009"].errors.includes("not_public"))
})

test("beta: public codes disambiguate only when unique on every row; slogans ignored; offers only with real fields", () => {
  const rows = compileCatalogSeoV1(betaFix.products)
  const map = byId(rows)
  assert.equal(map["b2222222-2222-4222-8222-000000000003"].effectiveProductName, "Mesa · Terracota · BETA-MESA-A")
  assert.equal(map["b2222222-2222-4222-8222-000000000004"].effectiveProductName, "Mesa · Terracota · BETA-MESA-B")
  assert.equal(map["b2222222-2222-4222-8222-000000000003"].state, "auto_ready")
  assert.equal(map["b2222222-2222-4222-8222-000000000005"].state, "needs_input")
  assert.equal(map["b2222222-2222-4222-8222-000000000006"].state, "needs_input")
  assert.equal(map["b2222222-2222-4222-8222-000000000005"].effectiveProductName, "Atelier · Branco")
  assert.equal(map["b2222222-2222-4222-8222-000000000007"].state, "suspended")

  const withOffers = map["b2222222-2222-4222-8222-000000000001"]
  assert.equal(withOffers.jsonLd.offers.priceCurrency, "BRL")
  assert.equal(withOffers.jsonLd.offers.availability, "https://schema.org/InStock")
  assert.equal(withOffers.jsonLd.productID, withOffers.productId)
  assert.equal(withOffers.jsonLd.url, "https://beta.example.test/p/classic-ouro")
  assert.equal("sku" in withOffers.jsonLd, false)
  assert.equal("gtin" in withOffers.jsonLd, false)
  assert.equal("mpn" in withOffers.jsonLd, false)

  const noOffers = map["b2222222-2222-4222-8222-000000000003"]
  assert.equal("offers" in noOffers.jsonLd, false)
})

test("sequential isolation: alpha collision does not leak into beta", () => {
  const alpha = compileCatalogSeoV1(alphaFix.products)
  const beta = compileCatalogSeoV1(betaFix.products)
  const alphaAgain = compileCatalogSeoV1(alphaFix.products)
  assert.equal(stableStringify(alpha), stableStringify(alphaAgain))

  const alphaNeeds = alpha.filter((r) => r.state === "needs_input").map((r) => r.effectiveProductName)
  const betaReadyNames = beta.filter((r) => r.state === "auto_ready").map((r) => r.effectiveProductName)
  assert.ok(alphaNeeds.includes("Twin · Azul"))
  assert.ok(betaReadyNames.includes("Classic · Ouro"))
  assert.ok(betaReadyNames.includes("Classic · Prata"))
  assert.equal(
    beta.filter((r) => r.effectiveProductName === "Twin · Azul").length,
    0,
  )
  assert.equal(
    alpha.filter((r) => r.effectiveProductName.startsWith("Mesa · Terracota")).length,
    0,
  )
})

test("concurrent isolation: Promise.all catalogs stay independent", async () => {
  const [alpha, beta] = await Promise.all([
    Promise.resolve(compileCatalogSeoV1(alphaFix.products)),
    Promise.resolve(compileCatalogSeoV1(betaFix.products)),
  ])
  assert.equal(alpha.filter((r) => r.state === "needs_input").length, 2)
  assert.equal(beta.filter((r) => r.state === "needs_input").length, 2)
  assert.ok(alpha.every((r) => r.seoTitle.endsWith("| Ateliê Alpha") || r.state === "suspended"))
  assert.ok(beta.every((r) => r.seoTitle.endsWith("| Studio Beta") || r.state === "suspended"))
  const alphaIds = new Set(alpha.map((r) => r.productId))
  const betaIds = new Set(beta.map((r) => r.productId))
  for (const id of alphaIds) assert.equal(betaIds.has(id), false)
})

test("3D Jewish 118: description removed from identity; 112 auto_ready / 6 needs_input; zero writes, no offers", () => {
  const report = previewCatalogSeoReportOnly(jewishFix.products)
  assert.equal(report.mode, "report-only")
  assert.equal(report.publishesHtml, false)
  assert.equal(report.publishesSitemap, false)
  assert.equal(report.publishesRobots, false)
  assert.equal(report.publishesJsonLd, false)
  assert.equal(report.productCount, 118)
  assert.equal(report.byState.auto_ready, 112)
  assert.equal(report.byState.needs_input, 6)
  assert.equal(report.byState.override_ready, 0)
  assert.equal(report.byState.suspended, 0)
  assert.equal(report.needsInputPrompt, "Precisamos diferenciar estes produtos. Informe o tipo, modelo ou outra característica real.")
  assert.equal(report.needsInputCount, 6)
  assert.equal(report.hasStructuredResolutionCandidate, 0)
  assert.equal(report.requiresIdentityLabelOrNewAttribute, 6)
  assert.equal(report.indexingProposedCount, 112)
  assert.equal(report.inSitemapProposedCount, 112)
  assert.equal(report.jsonLdProposedCount, 112)
  assert.equal(report.structuredDataCompleteCount, 0)
  assert.equal(report.richResultEligibleCount, 0)
  assert.equal("couldResolveWithStructuredAttributeOrIdentityLabel" in report, false)
  assert.equal(report.needsInputPrompt.includes("preencher SEO"), false)

  const idToSlug = Object.fromEntries(jewishFix.products.map((p) => [p.productId, p.slug]))
  const needs = report.products.filter((r) => r.state === "needs_input")
  const slugs = needs.map((r) => idToSlug[r.productId]).sort()
  assert.deepEqual(slugs, [
    "marinho-ouro-claro-2",
    "marinho-ouro-claro-3",
    "marinho-ouro-claro-4",
    "marinho-ouro-claro-5",
    "prata-cobre-claro",
    "prata-cobre-claro-2",
  ])
  const marinho = needs.filter((r) => r.effectiveProductName === "Kossot · Marinho & Ouro Claro")
  const prata = needs.filter((r) => r.effectiveProductName === "Kossot · Prata & Cobre Claro")
  assert.equal(marinho.length, 4)
  assert.equal(prata.length, 2)
  assert.equal(Object.keys(report.collisionMatrix).length, 2)
  assert.ok(
    Object.values(report.collisionMatrix).every(
      (g) => g.identityKey && Array.isArray(g.productIds) && Array.isArray(g.displays),
    ),
  )
  assert.ok(needs.every((r) => r.needsInputPrompt === report.needsInputPrompt))

  for (const row of report.products) {
    if (row.jsonLd) {
      assert.equal("sku" in row.jsonLd, false)
      assert.equal("gtin" in row.jsonLd, false)
      assert.equal("mpn" in row.jsonLd, false)
      assert.equal("offers" in row.jsonLd, false)
      assert.equal(row.jsonLd.productID, row.productId)
      assert.equal(row.jsonLd.url, jewishFix.products.find((p) => p.productId === row.productId).canonicalUrl)
    }
  }
})

test("compiler source never uses description for identity and has no tenant branches", () => {
  const src = readFileSync(join(root, "src/lib/productSeoCompilerV1.js"), "utf8")
  assert.equal(src.includes("descriptionRemainder"), false)
  assert.equal(src.includes("leftover"), false)
  const identityBlock = src.slice(src.indexOf("function variantExtras"), src.indexOf("export function compileProductSeoV1"))
  assert.equal(identityBlock.includes("description"), false)
  assert.match(src, /applyStrict\(\(row\) => variantExtras/)
  assert.match(src, /applyStrict\(\(row\) => row\.facts\.categoryName\)/)
  assert.equal(/3djewish|just\.com|flavio|rossana|soraya|celina|marcelo/i.test(src), false)
  assert.equal(/if\s*\(\s*(tenant|host|slug|segment)/i.test(src), false)
  assert.equal(src.includes("preencher SEO"), false)
  assert.equal(src.includes("unsafeText"), false)
  assert.match(src, /HTML_ESCAPE_REQUIRED/)
  assert.match(src, /Never use set:html/)
})

test("preview is not wired into published HTML, sitemap, or robots", () => {
  const productPage = readFileSync(join(root, "src/pages/p/[slug].astro"), "utf8")
  const sitemap = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8")
  const robots = readFileSync(join(root, "src/pages/robots.txt.ts"), "utf8")
  for (const body of [productPage, sitemap, robots]) {
    assert.equal(body.includes("productSeoCompilerV1"), false)
    assert.equal(body.includes("compileProductSeoV1"), false)
    assert.equal(body.includes("compileCatalogSeoV1"), false)
  }
})

test("prepared SQL remains not applied", () => {
  const sql = readFileSync(join(root, "ops/seo001/product-publication-state.PREPARED.sql"), "utf8")
  assert.match(sql, /NÃO APLICADO|not applied/i)
  assert.equal(sql.includes("product_publication_state"), true)
  assert.match(sql, /identity_label_override/)
  assert.match(sql, /seo_title_override/)
  assert.match(sql, /seo_description_override/)
  assert.equal(/\btitle text\b/.test(sql), false)
})

function advProduct(id, fields) {
  return {
    productId: id,
    tenantId: "33333333-3333-4333-8333-333333333333",
    slug: `s-${id.slice(-4)}`,
    canonicalUrl: `https://adv.example.test/p/s-${id.slice(-4)}`,
    name: "Azul",
    lineName: "Twin",
    categoryName: "Pares",
    description: "",
    images: ["https://cdn.example.test/adv.webp"],
    brand: "Adv",
    visible: true,
    catalogEnabled: true,
    tenantActive: true,
    ...fields,
  }
}

test("adversarial: identical products with different slogans stay needs_input", () => {
  const rows = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000001", { description: "Edição limitada da coleção" }),
    advProduct("33333333-3333-4333-8333-000000000002", { description: "Feito à mão com cuidado" }),
  ])
  assert.ok(rows.every((r) => r.state === "needs_input"))
  assert.ok(rows.every((r) => r.effectiveProductName === "Twin · Azul"))
  assert.notEqual(rows[0].metaDescription, rows[1].metaDescription)
})

test("adversarial: color/model words in description do not resolve collision", () => {
  const rows = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000011", { description: "Kos Haste Marinho Cosset" }),
    advProduct("33333333-3333-4333-8333-000000000012", { description: "Kos com Pratinho Dourado" }),
  ])
  assert.ok(rows.every((r) => r.state === "needs_input"))
  assert.ok(rows.every((r) => r.effectiveProductName === "Twin · Azul"))
})

test("adversarial: category on only one row does not create false auto_ready", () => {
  const rows = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000021", { categoryName: "Copos" }),
    advProduct("33333333-3333-4333-8333-000000000022", { categoryName: "" }),
  ])
  assert.ok(rows.every((r) => r.state === "needs_input"))
  assert.ok(rows.every((r) => r.effectiveProductName === "Twin · Azul"))
})

test("adversarial: public code on only one row does not create false auto_ready", () => {
  const rows = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000031", { publicProductCode: "ADV-A", categoryName: "" }),
    advProduct("33333333-3333-4333-8333-000000000032", { publicProductCode: "", categoryName: "" }),
  ])
  assert.ok(rows.every((r) => r.state === "needs_input"))
  assert.ok(rows.every((r) => r.effectiveProductName === "Twin · Azul"))
})

test("adversarial: unique codes on every row resolve the group", () => {
  const rows = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000041", { publicProductCode: "ADV-A", categoryName: "" }),
    advProduct("33333333-3333-4333-8333-000000000042", { publicProductCode: "ADV-B", categoryName: "" }),
  ])
  assert.ok(rows.every((r) => r.state === "auto_ready"))
  const names = rows.map((r) => r.effectiveProductName).sort()
  assert.deepEqual(names, ["Twin · Azul · ADV-A", "Twin · Azul · ADV-B"])
})

test("adversarial: unique structured attributes on every row resolve the group", () => {
  const rows = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000051", { variantAttributes: ["Vertical"] }),
    advProduct("33333333-3333-4333-8333-000000000052", { variantAttributes: ["Horizontal"] }),
  ])
  assert.ok(rows.every((r) => r.state === "auto_ready"))
  const names = rows.map((r) => r.effectiveProductName).sort()
  assert.deepEqual(names, ["Twin · Azul · Horizontal", "Twin · Azul · Vertical"])
})

test("adversarial: case, accent, spacing and equivalent Unicode collide", () => {
  const nfdCafe = "Cafe\u0301"
  const rows = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000061", { name: "Café", lineName: "Natlan" }),
    advProduct("33333333-3333-4333-8333-000000000062", { name: "  CAFE  ", lineName: "natlan" }),
    advProduct("33333333-3333-4333-8333-000000000063", { name: nfdCafe, lineName: "Natlan" }),
  ])
  assert.ok(rows.every((r) => r.state === "needs_input"))
  assert.ok(rows.every((r) => r.errors.includes("duplicate_effective_name")))
})

test("adversarial: suspended product does not collide with actives", () => {
  const oneActive = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000071", { name: "Ouro", lineName: "Classic" }),
    advProduct("33333333-3333-4333-8333-000000000072", {
      name: "Ouro",
      lineName: "Classic",
      visible: false,
    }),
  ])
  const map = byId(oneActive)
  assert.equal(map["33333333-3333-4333-8333-000000000071"].state, "auto_ready")
  assert.equal(map["33333333-3333-4333-8333-000000000072"].state, "suspended")

  const twoActive = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-000000000073", { name: "Ouro", lineName: "Classic" }),
    advProduct("33333333-3333-4333-8333-000000000074", { name: "Ouro", lineName: "Classic" }),
    advProduct("33333333-3333-4333-8333-000000000075", {
      name: "Ouro",
      lineName: "Classic",
      visible: false,
    }),
  ])
  assert.equal(twoActive.filter((r) => r.state === "needs_input").length, 2)
  assert.equal(twoActive.filter((r) => r.state === "suspended").length, 1)
  assert.equal(
    twoActive.find((r) => r.state === "suspended").errors.includes("duplicate_effective_name"),
    false,
  )
})

test("adversarial: unique identityLabelOverride resolves only that product", () => {
  const a = advProduct("33333333-3333-4333-8333-000000000081")
  const b = advProduct("33333333-3333-4333-8333-000000000082")
  const baseline = compileCatalogSeoV1([a, b])
  const neighborBefore = baseline.find((r) => r.productId === b.productId)

  const rows = compileCatalogSeoV1([{ ...a, identityLabelOverride: "Cosset" }, b])
  const map = byId(rows)
  assert.equal(map[a.productId].state, "override_ready")
  assert.equal(map[a.productId].identityLabelAccepted, true)
  assert.equal(map[a.productId].effectiveProductName, "Twin · Azul · Cosset")
  assert.equal(map[a.productId].imageAlt, "Twin · Azul · Cosset")
  assert.equal(map[a.productId].ogTitle, "Twin · Azul · Cosset | Adv")
  assert.equal(map[a.productId].seoTitle, "Twin · Azul · Cosset | Adv")
  assert.equal(map[a.productId].jsonLd.name, "Twin · Azul · Cosset")
  assert.equal(map[b.productId].state, "needs_input")
  assert.equal(map[b.productId].effectiveProductName, neighborBefore.effectiveProductName)
  assert.equal(map[b.productId].seoTitle, neighborBefore.seoTitle)
  assert.equal(map[b.productId].metaDescription, neighborBefore.metaDescription)
  assert.equal(map[b.productId].needsInputPrompt, "Precisamos diferenciar estes produtos. Informe o tipo, modelo ou outra característica real.")
})

test("adversarial: two identical identityLabelOverride stay needs_input", () => {
  const a = advProduct("33333333-3333-4333-8333-000000000091")
  const b = advProduct("33333333-3333-4333-8333-000000000092")
  const rows = compileCatalogSeoV1([
    { ...a, identityLabelOverride: "Cosset" },
    { ...b, identityLabelOverride: "COSSET" },
  ])
  assert.ok(rows.every((r) => r.state === "needs_input"))
  assert.ok(rows.every((r) => r.identityLabelRejected))
  assert.ok(rows.every((r) => r.overrideErrors.includes("identity_label_duplicate")))
  assert.ok(rows.every((r) => r.effectiveProductName === "Twin · Azul"))
})

test("adversarial: clearing an override recompiles from normal fields", () => {
  const target = alphaFix.products[0]
  const catalog = alphaFix.products
  const never = compileProductSeoV1(target, catalog)
  const withFields = compileProductSeoV1(
    {
      ...target,
      seoTitleOverride: "Anel Classic Ouro | Ateliê Alpha",
      seoDescriptionOverride: "Anel da linha Classic em ouro.",
    },
    catalog,
  )
  const cleared = compileProductSeoV1(
    { ...target, seoTitleOverride: "", seoDescriptionOverride: null, identityLabelOverride: undefined },
    catalog,
  )
  assert.equal(stableStringify(cleared), stableStringify(never))
  assert.notEqual(withFields.seoTitle, never.seoTitle)
  assert.equal(cleared.seoTitle, never.seoTitle)
  assert.equal(cleared.metaDescription, never.metaDescription)
  assert.equal(cleared.contentFingerprint, never.contentFingerprint)
})

test("adversarial: tenant/host fields do not influence identity collision", () => {
  const alpha = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000a1", {
      tenantId: "11111111-1111-4111-8111-111111111111",
      identityLabelOverride: "Cosset",
    }),
    advProduct("33333333-3333-4333-8333-0000000000a2", {
      tenantId: "11111111-1111-4111-8111-111111111111",
    }),
  ])
  const beta = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000b1", {
      tenantId: "22222222-2222-4222-8222-222222222222",
      identityLabelOverride: "Cosset",
    }),
    advProduct("33333333-3333-4333-8333-0000000000b2", {
      tenantId: "22222222-2222-4222-8222-222222222222",
    }),
  ])
  assert.equal(alpha.find((r) => r.identityLabelAccepted).state, "override_ready")
  assert.equal(beta.find((r) => r.identityLabelAccepted).state, "override_ready")
  assert.equal(alpha.filter((r) => r.state === "needs_input").length, 1)
  assert.equal(beta.filter((r) => r.state === "needs_input").length, 1)
})

test("adversarial: suspended product does not reserve identityLabelOverride against actives", () => {
  const rows = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000c1", { identityLabelOverride: "Cosset" }),
    advProduct("33333333-3333-4333-8333-0000000000c2"),
    advProduct("33333333-3333-4333-8333-0000000000c3", {
      identityLabelOverride: "Cosset",
      visible: false,
    }),
  ])
  const map = byId(rows)
  assert.equal(map["33333333-3333-4333-8333-0000000000c1"].state, "override_ready")
  assert.equal(map["33333333-3333-4333-8333-0000000000c1"].effectiveProductName, "Twin · Azul · Cosset")
  assert.equal(map["33333333-3333-4333-8333-0000000000c2"].state, "needs_input")
  assert.equal(map["33333333-3333-4333-8333-0000000000c3"].state, "suspended")
})

function collidingPair(extraA = {}, extraB = {}) {
  return [
    advProduct("33333333-3333-4333-8333-0000000000d1", extraA),
    advProduct("33333333-3333-4333-8333-0000000000d2", extraB),
  ]
}

test("adversarial: plain-text policy rejects dangerous overrides and keeps automatic", () => {
  const auto = compileCatalogSeoV1(collidingPair())[0]
  const probes = [
    ["java\u200Bscript:alert(1)", ["seo_title_scheme", "seo_title_control"]],
    ["vbscript:alert(1)", ["seo_title_scheme"]],
    ["DATA:text/html,x", ["seo_title_scheme"]],
    [" JavaScript : alert(1)", ["seo_title_scheme"]],
    ["&lt;script&gt;", ["seo_title_markup"]],
    ["&#60;script&#62;", ["seo_title_markup"]],
    ["&#x3c;script&#x3e;", ["seo_title_markup"]],
    ["\u202ECosset", ["seo_title_control"]],
    ["Cosset\u200B", ["seo_title_control"]],
    ["\uFEFFCosset", ["seo_title_control"]],
    ["https://evil.example/x", ["seo_title_uri"]],
    ["http://evil.example/x", ["seo_title_uri"]],
    ["javascript&colon;alert(1)", ["seo_title_scheme"]],
    ["vbscript&colon;msg", ["seo_title_scheme"]],
    ["data&colon;text/html,x", ["seo_title_scheme"]],
    ["javascript\uFF1Aalert(1)", ["seo_title_scheme"]],
    ["DATA\uFF1Atext/html,x", ["seo_title_scheme"]],
  ]
  for (const [value, reasons] of probes) {
    const rows = compileCatalogSeoV1(collidingPair({ seoTitleOverride: value }))
    const a = rows.find((r) => r.productId.endsWith("d1"))
    assert.equal(a.seoTitleOverrideRejected, true, value)
    assert.equal(a.seoTitle, auto.seoTitle, value)
    assert.ok(
      reasons.some((reason) => a.overrideErrors.includes(reason)),
      `${value} -> ${reasons.join("|")} in ${a.overrideErrors}`,
    )
  }

  const identityProbes = [
    ["java\u200Bscript:alert(1)", ["identity_label_scheme", "identity_label_control"]],
    ["vbscript:msg", ["identity_label_scheme"]],
    ["data:text/html,x", ["identity_label_scheme"]],
    ["https://evil.example/x", ["identity_label_uri"]],
    ["&lt;script&gt;", ["identity_label_markup"]],
  ]
  for (const [value, reasons] of identityProbes) {
    const rows = compileCatalogSeoV1(collidingPair({ identityLabelOverride: value }))
    const a = rows.find((r) => r.productId.endsWith("d1"))
    assert.equal(a.identityLabelRejected, true, value)
    assert.equal(a.state, "needs_input", value)
    assert.equal(a.effectiveProductName, auto.effectiveProductName, value)
    assert.ok(
      reasons.some((reason) => a.overrideErrors.includes(reason)),
      `${value} -> ${reasons.join("|")} in ${a.overrideErrors}`,
    )
  }

  const okTitle = compileCatalogSeoV1(
    collidingPair({ seoTitleOverride: "Café perolado 😀 | Adv" }),
  ).find((r) => r.productId.endsWith("d1"))
  assert.equal(okTitle.seoTitleOverrideAccepted, true)
  assert.equal(okTitle.seoTitle, "Café perolado 😀 | Adv")

  const okDesc = compileCatalogSeoV1(
    collidingPair({ seoDescriptionOverride: "Peça em café com emoji 😀." }),
  ).find((r) => r.productId.endsWith("d1"))
  assert.equal(okDesc.seoDescriptionOverrideAccepted, true)
})

test("adversarial: Unicode length uses code points, never slices", () => {
  assert.equal(countCodePoints("😀"), 1)
  assert.equal(countCodePoints("A".repeat(70)), 70)
  const catalog = collidingPair()
  const auto = compileCatalogSeoV1(catalog)[0]
  const atLimit = compileCatalogSeoV1(
    collidingPair({ seoTitleOverride: "é".repeat(70) }),
  ).find((r) => r.productId.endsWith("d1"))
  assert.equal(atLimit.seoTitleOverrideAccepted, true)
  assert.equal(countCodePoints(atLimit.seoTitle), 70)
  const over = compileCatalogSeoV1(
    collidingPair({ seoTitleOverride: "é".repeat(71) }),
  ).find((r) => r.productId.endsWith("d1"))
  assert.equal(over.seoTitleOverrideRejected, true)
  assert.equal(over.seoTitle, auto.seoTitle)
  assert.ok(over.overrideErrors.includes("seo_title_too_long"))
})

test("adversarial: Cosset accepted; full restatement rejected; Ouro is not a false positive", () => {
  const a = advProduct("33333333-3333-4333-8333-0000000000e1", {
    name: "Marinho & Ouro Claro",
    lineName: "Kossot",
    categoryName: "Kossot",
    identityLabelOverride: "Cosset",
  })
  const b = advProduct("33333333-3333-4333-8333-0000000000e2", {
    name: "Marinho & Ouro Claro",
    lineName: "Kossot",
    categoryName: "Kossot",
  })
  const accepted = compileCatalogSeoV1([a, b])
  assert.equal(accepted.find((r) => r.productId === a.productId).effectiveProductName, "Kossot · Marinho & Ouro Claro · Cosset")
  assert.equal(accepted.find((r) => r.productId === a.productId).state, "override_ready")

  const restated = compileCatalogSeoV1([
    { ...a, identityLabelOverride: "Kossot · Marinho & Ouro Claro · Cosset" },
    b,
  ])
  const rA = restated.find((r) => r.productId === a.productId)
  assert.equal(rA.state, "needs_input")
  assert.equal(rA.effectiveProductName, "Kossot · Marinho & Ouro Claro")
  assert.ok(rA.overrideErrors.includes("identity_label_restatement"))

  const ouro = compileCatalogSeoV1([
    { ...a, identityLabelOverride: "Ouro" },
    b,
  ])
  assert.equal(ouro.find((r) => r.productId === a.productId).state, "override_ready")
  assert.equal(ouro.find((r) => r.productId === a.productId).effectiveProductName, "Kossot · Marinho & Ouro Claro · Ouro")
})

test("adversarial: Solar/Anelar accepted; restatement requires a real token boundary", () => {
  const solA = advProduct("33333333-3333-4333-8333-0000000000s1", {
    name: "Sol",
    lineName: "",
    categoryName: "",
    identityLabelOverride: "Solar",
  })
  const solB = advProduct("33333333-3333-4333-8333-0000000000s2", {
    name: "Sol",
    lineName: "",
    categoryName: "",
  })
  const solar = compileCatalogSeoV1([solA, solB])
  assert.equal(solar.find((r) => r.productId === solA.productId).state, "override_ready")
  assert.equal(solar.find((r) => r.productId === solA.productId).effectiveProductName, "Sol · Solar")

  const anelA = advProduct("33333333-3333-4333-8333-0000000000s3", {
    name: "Anel",
    lineName: "",
    categoryName: "",
    identityLabelOverride: "Anelar",
  })
  const anelB = advProduct("33333333-3333-4333-8333-0000000000s4", {
    name: "Anel",
    lineName: "",
    categoryName: "",
  })
  const anelar = compileCatalogSeoV1([anelA, anelB])
  assert.equal(anelar.find((r) => r.productId === anelA.productId).state, "override_ready")
  assert.equal(anelar.find((r) => r.productId === anelA.productId).effectiveProductName, "Anel · Anelar")

  assert.equal(isIdentityRestatement("Solar", ["Sol"]), false)
  assert.equal(isIdentityRestatement("Anelar", ["Anel"]), false)
  assert.equal(isIdentityRestatement("Kossot · Marinho & Ouro Claro · Cosset", ["Kossot", "Marinho & Ouro Claro"]), true)

  const boundaries = ["Sol · Extra", "Sol: Extra", "Sol：Extra", "Sol - Extra", "Sol | Extra", "Sol / Extra"]
  for (const label of boundaries) {
    assert.equal(isIdentityRestatement(label, ["Sol"]), true, label)
  }

  const restated = compileCatalogSeoV1([
    { ...solA, identityLabelOverride: "Sol · Extra" },
    solB,
  ])
  assert.equal(restated.find((r) => r.productId === solA.productId).state, "needs_input")
  assert.ok(restated.find((r) => r.productId === solA.productId).overrideErrors.includes("identity_label_restatement"))
})

test("adversarial: tenant structured fields never emit unsafe text", () => {
  const unique = advProduct("33333333-3333-4333-8333-0000000000t1", {
    name: "<script>alert(1)</script>",
    lineName: "Linha",
    description: "Peça artesanal única.",
  })
  const badName = compileCatalogSeoV1([unique])[0]
  assert.equal(badName.state, "needs_input")
  assert.ok(badName.blockingErrors.includes("identity_invalid"))
  assert.equal(String(badName.effectiveProductName).includes("<"), false)
  assert.equal(String(badName.seoTitle).includes("<script>"), false)
  assert.equal(JSON.stringify(badName).includes("<script>"), false)

  const jsName = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000t2", {
      name: "javascript:alert(1)",
      lineName: "Linha",
    }),
  ])[0]
  assert.equal(jsName.state, "needs_input")
  assert.equal(String(jsName.effectiveProductName).includes("javascript:"), false)

  const badBrand = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000t3", {
      name: "Unico",
      lineName: "Linha",
      brand: "javascript:alert(1)",
    }),
  ])[0]
  assert.equal(badBrand.state, "auto_ready")
  assert.ok(badBrand.qualityWarnings.includes("brand_scheme"))
  assert.equal(badBrand.seoTitle, "Linha · Unico")
  assert.equal(badBrand.seoTitle.includes("javascript"), false)

  const badDesc = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000t4", {
      name: "Unico",
      lineName: "Linha",
      description: "javascript:alert(1)",
    }),
  ])[0]
  assert.ok(badDesc.qualityWarnings.includes("description_scheme"))
  assert.equal(String(badDesc.metaDescription).includes("javascript:"), false)
  assert.ok(badDesc.metaDescription.includes("Linha"))
})

test("adversarial: images validate every item; only https public URLs enter JSON-LD", () => {
  const mixed = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000i1", {
      name: "Unico",
      lineName: "Linha",
      images: [
        "https://cdn.example.test/ok.webp",
        "javascript:alert(1)",
        "http://cdn.example.test/insecure.webp",
        "https://user:pass@cdn.example.test/creds.webp",
        "https://cdn.example.test/ok.webp",
        "data:text/html,x",
      ],
    }),
  ])[0]
  assert.equal(mixed.state, "auto_ready")
  assert.deepEqual(mixed.jsonLd.image, ["https://cdn.example.test/ok.webp"])
  assert.ok(mixed.qualityWarnings.includes("image_scheme") || mixed.qualityWarnings.includes("image_credentials"))
  assert.equal(JSON.stringify(mixed.jsonLd).includes("javascript:"), false)
  assert.equal(JSON.stringify(mixed.jsonLd).includes("user:pass"), false)

  const none = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000i2", {
      name: "Unico",
      lineName: "Linha",
      images: ["javascript:alert(1)", "http://cdn.example.test/x.webp", "file:///etc/passwd"],
    }),
  ])[0]
  assert.equal(none.state, "auto_ready")
  assert.ok(none.qualityWarnings.includes("missing_valid_image"))
  assert.equal(none.indexingProposed, true)
  assert.equal(none.inSitemapProposed, true)
  assert.equal(none.jsonLdProposed, true)
  assert.equal("image" in none.jsonLd, false)
  assert.equal(none.structuredDataComplete, false)
  assert.equal(validatePublicHttpsUrl("https://cdn.example.test/a.webp").ok, true)
  assert.equal(validatePublicHttpsUrl("javascript:alert(1)").ok, false)
})

test("indexing vs quality: missing image does not noindex; canonical and identity still block", () => {
  const noImage = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000q1", {
      name: "Unico",
      lineName: "Linha",
      images: [],
    }),
  ])[0]
  assert.equal(noImage.state, "auto_ready")
  assert.equal(noImage.indexingProposed, true)
  assert.equal(noImage.inSitemapProposed, true)
  assert.equal(noImage.jsonLdProposed, true)
  assert.equal(noImage.robotsProposed, "index,follow")
  assert.ok(noImage.qualityWarnings.includes("missing_valid_image"))
  assert.equal(noImage.blockingErrors.includes("missing_valid_image"), false)
  assert.equal("image" in noImage.jsonLd, false)
  assert.equal(noImage.structuredDataComplete, false)
  assert.equal(noImage.richResultEligible, false)

  const colliding = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000q2", { images: ["https://cdn.example.test/ok.webp"] }),
    advProduct("33333333-3333-4333-8333-0000000000q3", { images: ["https://cdn.example.test/ok.webp"] }),
  ])
  assert.ok(colliding.every((r) => r.state === "needs_input"))
  assert.ok(colliding.every((r) => r.blockingErrors.includes("duplicate_effective_name")))
  assert.ok(colliding.every((r) => r.indexingProposed === false))
  assert.ok(colliding.every((r) => r.inSitemapProposed === false))

  const badOverrideNoImage = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000q4", {
      name: "Unico",
      lineName: "Linha",
      images: [],
      seoTitleOverride: "javascript:alert(1)",
    }),
  ])[0]
  assert.equal(badOverrideNoImage.state, "auto_ready")
  assert.equal(badOverrideNoImage.indexingProposed, true)
  assert.ok(badOverrideNoImage.overrideErrors.includes("seo_title_scheme"))
  assert.ok(badOverrideNoImage.qualityWarnings.includes("missing_valid_image"))
  assert.equal(badOverrideNoImage.seoTitle.includes("javascript"), false)

  const badCanon = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000q5", {
      name: "Unico",
      lineName: "Linha",
      canonicalUrl: "javascript:alert(1)",
    }),
  ])[0]
  assert.equal(badCanon.state, "needs_input")
  assert.ok(badCanon.blockingErrors.includes("canonical_scheme") || badCanon.blockingErrors.includes("missing_canonical"))
  assert.equal(badCanon.indexingProposed, false)
  assert.equal(badCanon.jsonLd, null)

  const suspended = compileCatalogSeoV1([
    advProduct("33333333-3333-4333-8333-0000000000q6", {
      name: "Unico",
      lineName: "Linha",
      images: ["https://cdn.example.test/ok.webp"],
      visible: false,
    }),
  ])[0]
  assert.equal(suspended.state, "suspended")
  assert.equal(suspended.indexingProposed, false)
  assert.equal(suspended.inSitemapProposed, false)
  assert.equal(suspended.jsonLd, null)
})

test("catalog order does not change compiled result", () => {
  const a = compileCatalogSeoV1(jewishFix.products)
  const b = compileCatalogSeoV1([...jewishFix.products].reverse())
  assert.equal(stableStringify(a), stableStringify(b))
})

test("fingerprint table: tenantId excluded; every included field can change the hash", () => {
  const base = alphaFix.products[0]
  const once = compileProductSeoV1(base, alphaFix.products)
  assert.equal(
    compileProductSeoV1({ ...base, tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, alphaFix.products)
      .contentFingerprint,
    once.contentFingerprint,
  )
  assert.ok(FINGERPRINT_INCLUDED.includes("name"))
  assert.ok(FINGERPRINT_EXCLUDED.includes("tenantId"))
  assert.equal(FINGERPRINT_INCLUDED.includes("tenantId"), false)

  const mutators = {
    slug: "classic-ouro-x",
    canonicalUrl: "https://alpha.example.test/p/classic-ouro-x",
    name: "Ouro Fosco",
    lineName: "Classic Plus",
    categoryName: "Pulseiras",
    description: "Classic Ouro artesanal",
    variantAttributes: ["Fosco"],
    publicProductCode: "ALPHA-1",
    images: ["https://cdn.example.test/alpha/other.webp"],
    price: 91,
    currency: "USD",
    availability: "https://schema.org/InStock",
    brand: "Ateliê Alpha Extra",
    visible: false,
    catalogEnabled: false,
    tenantActive: false,
    identityLabelOverride: "Fosco",
    seoTitleOverride: "Anel Classic Ouro | Ateliê Alpha",
    seoDescriptionOverride: "Anel Classic em ouro.",
  }
  for (const field of FINGERPRINT_INCLUDED) {
    if (field === "compilerVersion" || field === "productId") continue
    assert.ok(field in mutators, field)
    const next = compileProductSeoV1({ ...base, [field]: mutators[field] }, alphaFix.products)
    assert.notEqual(next.contentFingerprint, once.contentFingerprint, field)
  }
})

test("collisionMatrix groups Café/Cafe/NFC/NFD as one identity key", () => {
  const nfdCafe = "Cafe\u0301"
  const report = previewCatalogSeoReportOnly([
    advProduct("33333333-3333-4333-8333-0000000000f1", { name: "Café", lineName: "Natlan" }),
    advProduct("33333333-3333-4333-8333-0000000000f2", { name: "  CAFE  ", lineName: "natlan" }),
    advProduct("33333333-3333-4333-8333-0000000000f3", { name: nfdCafe, lineName: "Natlan" }),
  ])
  const keys = Object.keys(report.collisionMatrix)
  assert.equal(keys.length, 1)
  assert.equal(keys[0], identityKey("Natlan · Café"))
  assert.equal(report.collisionMatrix[keys[0]].productIds.length, 3)
  assert.ok(report.collisionMatrix[keys[0]].displays.length >= 1)
})


