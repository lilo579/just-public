import test from "node:test"
import assert from "node:assert/strict"
import {
  resolveF1PresentationChrome,
  resolveF1PresentationProfile,
  resolveHeaderLogoUrl,
  resolveFooterLogoUrl,
} from "@just/site-engine-authority"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
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
  assert.equal(classic.processIndexIcons, true)
  assert.equal(classic.processBadgeEmphasis, "primary")
  assert.equal(classic.benefitsAsFeatureCards, true)
  assert.equal(classic.servicesAsCardGrid, false)
  assert.equal(classic.servicesLayout, "classic-split")
  assert.equal(classic.benefitsLayout, "classic-feature-cards")
  assert.equal(classic.justSignatureBand, false)
})

test("classic chrome declares footer surface and social emphasis", () => {
  const classic = resolveF1PresentationChrome("f1.presentation.classic_v1")
  const engine = resolveF1PresentationChrome("f1.presentation.engine_v1")
  assert.equal(classic.footerSurface, "light")
  assert.equal(classic.footerSocialIconEmphasis, "primary")
  assert.equal(classic.footerLogoStrategy, "mono-adaptive")
  assert.equal(engine.footerSocialIconEmphasis, "muted")
  assert.equal(engine.footerLogoStrategy, "engine-preserving")
})

test("resolveFooterLogoUrl mono-adaptive on light footer prefers horizontal", () => {
  const chrome = resolveF1PresentationChrome("f1.presentation.classic_v1")
  const branding = {
    logoUrl: "https://cdn.example/color.png",
    logoHorizontalUrl: "https://cdn.example/mono-dark.png",
    logoWhiteUrl: "https://cdn.example/mono-light.png",
  }
  assert.equal(resolveFooterLogoUrl(branding, chrome), "https://cdn.example/mono-dark.png")
  assert.equal(resolveHeaderLogoUrl(branding, chrome), "https://cdn.example/color.png")
})

test("resolveFooterLogoUrl on dark footer prefers white variant", () => {
  const chrome = {
    ...resolveF1PresentationChrome("f1.presentation.classic_v1"),
    footerSurface: "dark",
  }
  const branding = {
    logoUrl: "https://cdn.example/color.png",
    logoHorizontalUrl: "https://cdn.example/mono-dark.png",
    logoWhiteUrl: "https://cdn.example/mono-light.png",
  }
  assert.equal(resolveFooterLogoUrl(branding, chrome), "https://cdn.example/mono-light.png")
})

test("resolveFooterLogoUrl fallback when mono assets missing", () => {
  const classic = resolveF1PresentationChrome("f1.presentation.classic_v1")
  assert.equal(
    resolveFooterLogoUrl({ logoUrl: "https://cdn.example/only-color.png" }, classic),
    "https://cdn.example/only-color.png",
  )
  const engine = resolveF1PresentationChrome("f1.presentation.engine_v1")
  assert.equal(
    resolveFooterLogoUrl(
      {
        logoUrl: "https://cdn.example/brand.png",
        logoHorizontalUrl: "https://cdn.example/horiz.png",
      },
      engine,
    ),
    "https://cdn.example/horiz.png",
  )
})

test("footer presentation has no tenant branching or hardcoded Soraya colors", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..")
  const footerSrc = readFileSync(join(root, "src/components/Footer.astro"), "utf8")
  const indexSrc = readFileSync(join(root, "src/pages/index.astro"), "utf8")
  const pkg = readFileSync(join(root, "package.json"), "utf8")
  for (const src of [footerSrc, indexSrc]) {
    assert.doesNotMatch(src, /soraya|marcelo|rossana/i)
    assert.doesNotMatch(src, /tenantId|hostname/i)
  }
  assert.doesNotMatch(pkg, /Keep in sync/i)
  assert.match(pkg, /@just\/site-engine-authority/)
  assert.match(footerSrc, /data-social-emphasis/)
  assert.match(footerSrc, /--site-color-primary/)
  assert.equal(
    existsSync(join(root, "src/lib/f1PresentationProfile.js")),
    false,
    "presentation mirror must be removed",
  )
})

test("resolveHeaderLogoUrl prefers brand logo for classic_v1", () => {
  const chrome = resolveF1PresentationChrome("f1.presentation.classic_v1")
  const url = resolveHeaderLogoUrl(
    {
      logoUrl: "https://cdn.example/color.png",
      logoHorizontalUrl: "https://cdn.example/horizontal.png",
    },
    chrome,
  )
  assert.equal(url, "https://cdn.example/color.png")
})

test("cinematic_v1 chrome exposes over-hero and editorial without tenant keys", () => {
  const cinematic = resolveF1PresentationChrome("f1.presentation.cinematic_v1")
  assert.equal(cinematic.heroLayout, "cinematic")
  assert.equal(cinematic.headerOverHero, true)
  assert.equal(cinematic.processLayout, "cinematic-journey")
  assert.equal(cinematic.ctaLayout, "cinematic-band")
  assert.ok(cinematic.cinematicEditorial)
  assert.equal(cinematic.cinematicEditorial.processSupplementalSteps.length, 2)
  assert.ok(cinematic.cinematicEditorial.navItems.length > 0)
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/lib/enrichPlanPaintWithPresentationChrome.js"),
    "utf8",
  )
  assert.doesNotMatch(src, /celina|b7c2d3c1|tenantId/i)
})

test("resolveHeaderOverHeroLogoUrl prefers white logo when over-hero", async () => {
  const { resolveHeaderOverHeroLogoUrl } = await import("@just/site-engine-authority")
  const cinematic = resolveF1PresentationChrome("f1.presentation.cinematic_v1")
  const url = resolveHeaderOverHeroLogoUrl(
    {
      logoUrl: "https://cdn.example/color.png",
      logoWhiteUrl: "https://cdn.example/white.png",
    },
    cinematic,
  )
  assert.equal(url, "https://cdn.example/white.png")
})

test("supports lato explicitly (not via classic→Georgia)", () => {
  assert.ok(THEME_FONT_KEYS.includes("lato"))
  const lato = resolveFontStack("lato")
  assert.match(lato.heading, /Lato/)
  assert.ok(lato.load)

  // classic is the Hub typography key for self-hosted Lato (media ownership).
  const classic = resolveFontStack("classic")
  assert.match(classic.heading, /Lato/)
  assert.equal(classic.load, "/fonts/lato/lato.css")
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
    canonical: {
      host: "example.test",
      origin: "https://example.test",
      requestHost: "example.test",
      isPrimaryRequest: true,
    },
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
  assert.equal(seo.canonicalUrl, "https://example.test/")
})

test("classic chrome uses feature cards for title-only benefits", () => {
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
  assert.equal(chrome.benefitsLayout, "classic-feature-cards")
  assert.equal(
    chrome.benefitsAsFeatureCards && shouldRenderBenefitsAsFeatures(block),
    true,
  )
})
