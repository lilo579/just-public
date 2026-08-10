import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildJustComingSoonJsonLd,
  isJustPublicHost,
  JUST_OG_IMAGE_HEIGHT,
  JUST_OG_IMAGE_WIDTH,
} from "../src/lib/justInstitutionalSeo.js"
import { justComingSoonSeo } from "../src/lib/justInstitutionalFreeze.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

test("isJustPublicHost recognizes apex and www", () => {
  assert.equal(isJustPublicHost("www.justwebsites.com.br"), true)
  assert.equal(isJustPublicHost("justwebsites.com.br"), true)
  assert.equal(isJustPublicHost("WWW.JustWebsites.com.br"), true)
  assert.equal(isJustPublicHost("marceloborer.com.br"), false)
})

test("JUST_PUBLIC_ORIGIN authority helpers are removed from institutional SEO module", () => {
  const src = readFileSync(join(root, "src/lib/justInstitutionalSeo.js"), "utf8")
  assert.equal(src.includes("JUST_PUBLIC_ORIGIN"), false)
  assert.equal(src.includes("resolveJustPublicOrigin"), false)
  const robots = readFileSync(join(root, "src/pages/robots.txt.ts"), "utf8")
  const sitemap = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8")
  assert.equal(robots.includes("resolveJustPublicOrigin"), false)
  assert.equal(sitemap.includes("resolveJustPublicOrigin"), false)
  assert.equal(robots.includes("https://${host}"), false)
  assert.equal(sitemap.includes("https://${host}"), false)
  assert.match(robots, /OAI-SearchBot/)
  assert.match(sitemap, /buildCanonicalUrl/)
})

test("OG image dimensions match pack file", () => {
  assert.equal(JUST_OG_IMAGE_WIDTH, 1200)
  assert.equal(JUST_OG_IMAGE_HEIGHT, 630)
})

test("buildJustComingSoonJsonLd uses contract origin only", () => {
  const origin = "https://example-primary.test"
  const graph = buildJustComingSoonJsonLd({
    origin,
    description: justComingSoonSeo.description,
    ogDescription: justComingSoonSeo.ogDescription,
  })
  assert.equal(graph["@graph"][0].url, `${origin}/`)
  assert.equal(graph["@graph"][1].url, `${origin}/`)
  assert.throws(() => buildJustComingSoonJsonLd({}), /requires canonical origin/)
})

test("index.astro JUST JSON-LD passes publicCanonical.origin", () => {
  const indexSrc = readFileSync(join(root, "src/pages/index.astro"), "utf8")
  assert.match(indexSrc, /origin:\s*publicCanonical\.origin/)
})
