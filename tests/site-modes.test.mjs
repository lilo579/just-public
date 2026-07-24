import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_SITE_MODE,
  isInterstitialSiteMode,
  parseSiteModeConfig,
  resolveSiteMode,
} from "@just/site-engine-authority"
import { resolvePublicSiteMode } from "../src/lib/resolvePublicSiteMode.js"

test("resolveSiteMode: defaults and allowlist", () => {
  assert.equal(resolveSiteMode(undefined), DEFAULT_SITE_MODE)
  assert.equal(resolveSiteMode(""), "NORMAL")
  assert.equal(resolveSiteMode("coming_soon"), "COMING_SOON")
  assert.equal(resolveSiteMode("MAINTENANCE"), "MAINTENANCE")
  assert.equal(resolveSiteMode("LAUNCH_PARTY"), "NORMAL")
})

test("isInterstitialSiteMode", () => {
  assert.equal(isInterstitialSiteMode("NORMAL"), false)
  assert.equal(isInterstitialSiteMode("COMING_SOON"), true)
  assert.equal(isInterstitialSiteMode("MAINTENANCE"), true)
})

test("parseSiteModeConfig: JSON string and object", () => {
  const fromJson = parseSiteModeConfig(
    JSON.stringify({
      headline: "Em breve",
      ctaHref: "https://wa.me/5511999999999",
      socialLinks: [{ type: "instagram", url: "https://instagram.com/x" }],
    }),
  )
  assert.equal(fromJson.headline, "Em breve")
  assert.equal(fromJson.ctaHref, "https://wa.me/5511999999999")
  assert.equal(fromJson.socialLinks?.length, 1)
  assert.deepEqual(parseSiteModeConfig("not-json"), {})
  assert.deepEqual(parseSiteModeConfig(null), {})
})

test("resolvePublicSiteMode: reads meta.siteMode without tenant branching", () => {
  const normal = resolvePublicSiteMode({
    source: { meta: { siteMode: "NORMAL" } },
  })
  assert.equal(normal.mode, "NORMAL")
  assert.equal(normal.interstitial, false)

  const soon = resolvePublicSiteMode({
    source: {
      meta: {
        siteMode: "COMING_SOON",
        siteModeConfig: { headline: "Launching", email: "hi@example.com" },
      },
    },
  })
  assert.equal(soon.mode, "COMING_SOON")
  assert.equal(soon.interstitial, true)
  assert.equal(soon.config.headline, "Launching")
  assert.equal(soon.config.email, "hi@example.com")

  const missing = resolvePublicSiteMode({})
  assert.equal(missing.mode, "NORMAL")
  assert.equal(missing.interstitial, false)
})
