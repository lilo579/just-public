#!/usr/bin/env node
/**
 * Shadow / report-only preview. Stdout JSON only. Zero writes.
 *
 * Usage:
 *   node scripts/preview-product-seo-shadow-v1.mjs tests/fixtures/product-seo-compiler/jewish-118.json
 *   node scripts/preview-product-seo-shadow-v1.mjs tests/fixtures/product-seo-compiler/source-f3-rpc-list.json
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { resolveProductSeoCanonicalContextV1 } from "../src/lib/productSeoCanonicalContextV1.js"
import { runProductSeoShadowV1 } from "../src/lib/productSeoShadowRunnerV1.js"

const fixturePath = process.argv[2]
if (!fixturePath) {
  console.error("usage: node scripts/preview-product-seo-shadow-v1.mjs <fixture.json>")
  process.exit(2)
}

const raw = JSON.parse(readFileSync(resolve(fixturePath), "utf8"))
const products = Array.isArray(raw.products) ? raw.products : raw
const first = products[0] || {}
const host = raw.host || "shadow.example.test"
const expectedTenantId =
  raw.expectedTenantId || first.tenantId || first.tenant_id || "00000000-0000-4000-8000-000000000000"

const canonicalContext = resolveProductSeoCanonicalContextV1({
  requestHost: host,
  expectedTenantId,
  authority: raw.canonicalRpc
    ? { kind: "rpc", row: raw.canonicalRpc }
    : raw.canonical
      ? {
          kind: "payload",
          payload: {
            tenantId: expectedTenantId,
            canonical: raw.canonical,
            publication: raw.publication,
          },
        }
      : { kind: "unavailable" },
})

const report = await runProductSeoShadowV1({
  context: {
    expectedTenantId,
    host,
    brand: raw.brand || raw.tenantBrand || "",
    catalogEnabled: true,
    tenantActive: true,
    canonicalContext,
  },
  loadCatalog: async () => ({ rows: products, nextPage: null }),
})

const slim = {
  mode: report.mode,
  writes: report.writes,
  publishesHtml: report.publishesHtml,
  publishesSitemap: report.publishesSitemap,
  publishesRobots: report.publishesRobots,
  publishesJsonLd: report.publishesJsonLd,
  persistsOverrides: report.persistsOverrides,
  persistsPublicationState: report.persistsPublicationState,
  touchesGsc: report.touchesGsc,
  adapterVersion: report.adapterVersion,
  runnerVersion: report.runnerVersion,
  compilerVersion: report.compilerVersion,
  loadedCount: report.loadedCount,
  adaptedCount: report.adaptedCount,
  rejectedCount: report.rejectedCount,
  rejectReasons: report.rejectReasons,
  catalogComplete: report.catalogComplete,
  completeness: report.completeness,
  completenessReason: report.completenessReason,
  incomplete: report.incomplete,
  incompleteReason: report.incompleteReason,
  usableForEnforcement: report.usableForEnforcement,
  canonical: canonicalContext.ok
    ? {
        source: canonicalContext.source,
        requestHost: canonicalContext.requestHost,
        primaryHost: canonicalContext.primaryHost,
        relation: canonicalContext.relation,
        tenantId: canonicalContext.tenantId,
      }
    : { ok: false, reason: canonicalContext.reason },
  metrics: report.metrics,
  collisionMatrix: report.collisionMatrix,
  needsInputPrompt: report.needsInputPrompt,
  needsInput: (report.products || [])
    .filter((row) => row.state === "needs_input")
    .map((row) => ({
      productId: row.productId,
      effectiveProductName: row.effectiveProductName,
      blockingErrors: row.blockingErrors,
    })),
}

process.stdout.write(`${JSON.stringify(slim, null, 2)}\n`)
