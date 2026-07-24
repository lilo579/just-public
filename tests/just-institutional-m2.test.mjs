import assert from "node:assert/strict"
import test from "node:test"

import {
  mergeComingSoonConfig,
  resolvePackagedInstitutionalSite,
  isInterstitialLegalPath,
} from "../src/lib/resolvePackagedInstitutionalSite.js"
import { justComingSoonModeConfig } from "../src/lib/justInstitutionalFreeze.js"

test("resolvePackagedInstitutionalSite: JUST hosts only", () => {
  assert.equal(resolvePackagedInstitutionalSite("www.justwebsites.com.br")?.slug, "just")
  assert.equal(resolvePackagedInstitutionalSite("justwebsites.com.br")?.slug, "just")
  assert.equal(resolvePackagedInstitutionalSite("www.3djewish.com.br"), null)
  assert.equal(resolvePackagedInstitutionalSite("www.marceloborer.com.br"), null)
})

test("isInterstitialLegalPath: allowlist", () => {
  assert.equal(isInterstitialLegalPath("/privacidade"), true)
  assert.equal(isInterstitialLegalPath("/termos"), true)
  assert.equal(isInterstitialLegalPath("/seguranca"), true)
  assert.equal(isInterstitialLegalPath("/catalogo"), false)
})

test("mergeComingSoonConfig: packaged defaults + hub override", () => {
  const merged = mergeComingSoonConfig(
    { headline: "Hub headline" },
    justComingSoonModeConfig,
  )
  assert.equal(merged.headline, "Hub headline")
  assert.equal(merged.leadForm?.submitLabel, "Quero saber primeiro")
  assert.equal(merged.showJustSignature, false)
  assert.ok(Array.isArray(merged.paragraphs) && merged.paragraphs.length === 3)
})

test("JUST coming soon freeze: lead form UI without capture", () => {
  assert.equal(justComingSoonModeConfig.leadCaptureEnabled, false)
  assert.ok(justComingSoonModeConfig.leadForm)
  assert.equal(justComingSoonModeConfig.ctaHref, null)
})
