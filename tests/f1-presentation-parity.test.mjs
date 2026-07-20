import test from "node:test"
import assert from "node:assert/strict"
import {
  resolveF1PresentationChrome,
  resolveF1PresentationProfile,
} from "../src/lib/f1PresentationProfile.js"
import {
  resolveFontStack,
  themeTokensFromBranding,
  THEME_FONT_KEYS,
} from "../src/lib/themeFromBranding.js"
import { buildPublicHomepageSeo } from "../src/lib/publicPageSeo.js"
import { shouldRenderBenefitsAsFeatures } from "../src/components/canonicalHomepageBenefitsAdapter.js"

test("resolves classic and engine chrome without tenant branching", () => {
  const classic = resolveF1PresentationChrome(
    resolveF1PresentationProfile("f1.presentation.classic_v1"),
  )
  assert.equal(classic.processIndexIcons, false)
  assert.equal(classic.benefitsAsFeatureCards, false)
  assert.equal(classic.servicesAsCardGrid, true)
  assert.equal(classic.justSignatureBand, false)
})

test("falls back to engine_v1 for unknown profile", () => {
  assert.equal(
    resolveF1PresentationProfile("something-else"),
    "f1.presentation.engine_v1",
  )
})

test("supports lato explicitly (not via classic→Georgia)", () => {
  assert.ok(THEME_FONT_KEYS.includes("lato"))
  const lato = resolveFontStack("lato")
  assert.match(lato.heading, /Lato/)
  assert.ok(lato.load)

  const classic = resolveFontStack("classic")
  assert.match(classic.heading, /Georgia/)
  assert.equal(classic.load, null)
})

test("rejects arbitrary font families", () => {
  const fonts = resolveFontStack("Comic Sans MS")
  assert.equal(fonts.key, "modern")
})

test("emits Lato tokens when branding.typography is lato", () => {
  const tokens = themeTokensFromBranding({ typography: "lato" })
  assert.match(tokens["--site-font-heading"], /Lato/)
  assert.equal(tokens.__fontKey, "lato")
})

test("prefers explicit seo payload over hero derivation", () => {
  const seo = buildPublicHomepageSeo({
    host: "example.test",
    companyName: "Acme",
    plan: {
      nodes: [
        {
          componentKey: "hero",
          props: { title: "Hero Title", subtitle: "Hero subtitle" },
        },
      ],
    },
    seo: {
      title: "Explicit Title",
      description: "Explicit Description",
      ogTitle: "OG Title",
      ogDescription: "OG Desc",
      ogImage: "https://cdn.example/og.png",
      favicon: "https://cdn.example/favicon.png",
      jsonLdType: "Person",
    },
  })
  assert.equal(seo.title, "Explicit Title")
  assert.equal(seo.description, "Explicit Description")
  assert.equal(seo.ogTitle, "OG Title")
  assert.equal(seo.jsonLd["@type"], "Person")
  assert.equal(seo.ogImage, "https://cdn.example/og.png")
})

test("classic chrome suppresses index-icon feature cards for title-only benefits", () => {
  const block = {
    type: "benefits",
    content: {
      title: "Diferenciais",
      items: [{ title: "A" }, { title: "B" }, { title: "C" }],
      metrics: [],
    },
  }
  assert.equal(shouldRenderBenefitsAsFeatures(block), true)
  const chrome = resolveF1PresentationChrome("f1.presentation.classic_v1")
  assert.equal(
    chrome.benefitsAsFeatureCards && shouldRenderBenefitsAsFeatures(block),
    false,
  )
})
