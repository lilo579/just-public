import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  isProductionHtmlCacheBaseline,
  resolveHtmlCacheControl,
} from "../src/lib/cacheHeaders.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("staging/preview HTML Cache-Control is no-store", () => {
  assert.equal(resolveHtmlCacheControl("staging", 200), "no-store")
  assert.equal(resolveHtmlCacheControl("preview", 200), "no-store")
  assert.equal(resolveHtmlCacheControl(" STAGING ", 200), "no-store")
})

test("production HTML Cache-Control is must-revalidate without s-maxage", () => {
  const value = resolveHtmlCacheControl("production", 200)
  assert.equal(value, "public, max-age=0, must-revalidate")
  assert.equal(isProductionHtmlCacheBaseline(value), true)
  assert.doesNotMatch(value, /s-maxage/i)
})

test("error responses always use no-store (any deploy env)", () => {
  assert.equal(resolveHtmlCacheControl("production", 404), "no-store")
  assert.equal(resolveHtmlCacheControl("staging", 503), "no-store")
  assert.equal(resolveHtmlCacheControl("production", 400), "no-store")
})

test("unset deploy env defaults to no-store (no shared HTML cache)", () => {
  assert.equal(resolveHtmlCacheControl(undefined, 200), "no-store")
  assert.equal(resolveHtmlCacheControl("", 200), "no-store")
  assert.equal(resolveHtmlCacheControl("weird", 200), "no-store")
})

test("public/_headers sets immutable for /_astro/* and /fonts/*; branding is TTL-only", () => {
  const text = fs.readFileSync(path.join(root, "public/_headers"), "utf8")
  assert.match(text, /\/_astro\/\*/)
  assert.match(text, /\/fonts\/\*/)
  assert.match(text, /\/branding\/\*/)
  assert.match(
    text,
    /\/_astro\/\*[\s\S]*?Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/,
  )
  assert.match(
    text,
    /\/fonts\/\*[\s\S]*?Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/,
  )
  assert.match(
    text,
    /\/branding\/\*[\s\S]*?Cache-Control:\s*public,\s*max-age=604800/,
  )
  assert.doesNotMatch(text, /\/favicon/)
  assert.doesNotMatch(text, /\/health/)
  assert.doesNotMatch(text, /^\/\s*$/m)
})

test("no Cache API / KV / shared-edge TTL / tenant Vary in cache baseline sources", () => {
  const files = [
    "src/lib/cacheHeaders.js",
    "src/middleware.ts",
    "public/_headers",
  ]
  for (const rel of files) {
    const text = fs.readFileSync(path.join(root, rel), "utf8")
    assert.doesNotMatch(text, /caches\.open|CacheStorage|KVNamespace/i)
    // Forbid enabling shared-edge TTL (`s-maxage=…`), not prose about rejecting it.
    assert.doesNotMatch(text, /s-maxage\s*=/i)
    assert.doesNotMatch(text, /Vary:\s*Host/i)
  }
})
