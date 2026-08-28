#!/usr/bin/env node
/**
 * Report-only preview for JUST Product SEO Compiler v1.
 * Prints JSON to stdout. Does not write HTML, sitemap, robots, DB, or GSC.
 *
 * Usage:
 *   node scripts/preview-product-seo-compiler-v1.mjs tests/fixtures/product-seo-compiler/jewish-118.json
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { previewCatalogSeoReportOnly } from "../src/lib/productSeoCompilerV1.js"

const fixturePath = process.argv[2]
if (!fixturePath) {
  console.error("usage: node scripts/preview-product-seo-compiler-v1.mjs <fixture.json>")
  process.exit(2)
}

const raw = JSON.parse(readFileSync(resolve(fixturePath), "utf8"))
const products = Array.isArray(raw.products) ? raw.products : raw
const report = previewCatalogSeoReportOnly(products)

const slim = {
  mode: report.mode,
  publishesHtml: report.publishesHtml,
  publishesSitemap: report.publishesSitemap,
  publishesRobots: report.publishesRobots,
  publishesJsonLd: report.publishesJsonLd,
  compilerVersion: report.compilerVersion,
  productCount: report.productCount,
  byState: report.byState,
  collisionMatrix: report.collisionMatrix,
  needsInputPrompt: report.needsInputPrompt,
  couldResolveWithStructuredAttributeOrIdentityLabel:
    report.couldResolveWithStructuredAttributeOrIdentityLabel,
  needsInput: report.products
    .filter((row) => row.state === "needs_input")
    .map((row) => ({
      productId: row.productId,
      effectiveProductName: row.effectiveProductName,
      errors: row.errors,
      prompt: row.needsInputPrompt,
    })),
}

process.stdout.write(`${JSON.stringify(slim, null, 2)}\n`)
