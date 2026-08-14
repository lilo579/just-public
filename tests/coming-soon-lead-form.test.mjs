import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { resolveComingSoonLeadForm, shouldRenderComingSoonLeadForm } from "../src/lib/resolveComingSoonLeadForm.js"
import { mergeComingSoonConfig } from "../src/lib/resolvePackagedInstitutionalSite.js"
import { resolvePublicSiteMode } from "../src/lib/resolvePublicSiteMode.js"
import { justComingSoonModeConfig } from "../src/lib/justInstitutionalFreeze.js"
import { isInterstitialLegalPath } from "../src/lib/resolvePackagedInstitutionalSite.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function payload(siteMode, siteModeConfig) {
  return {
    source: {
      meta: {
        version: "homepage_source_v1",
        siteMode,
        siteModeConfig,
      },
    },
  }
}

test("resolveComingSoonLeadForm: flag false + leadForm present → no form", () => {
  assert.equal(
    resolveComingSoonLeadForm({
      leadCaptureEnabled: false,
      leadForm: { submitLabel: "Quero saber primeiro" },
    }),
    null,
  )
})

test("resolveComingSoonLeadForm: flag absent → no form", () => {
  assert.equal(
    resolveComingSoonLeadForm({
      leadForm: { submitLabel: "Enviar" },
    }),
    null,
  )
  assert.equal(resolveComingSoonLeadForm(null), null)
})

test("resolveComingSoonLeadForm: flag true + leadForm present → form", () => {
  const form = { submitLabel: "Avisar-me" }
  assert.equal(
    resolveComingSoonLeadForm({
      leadCaptureEnabled: true,
      leadForm: form,
    }),
    form,
  )
})

test("JUST freeze: packaged leadForm copy exists but capture is off", () => {
  assert.equal(justComingSoonModeConfig.leadCaptureEnabled, false)
  assert.ok(justComingSoonModeConfig.leadForm)
  assert.equal(resolveComingSoonLeadForm(justComingSoonModeConfig), null)
})

test("contract: COMING_SOON payload → ComingSoonPage without form when capture is off", () => {
  const homepage = payload("COMING_SOON", { leadCaptureEnabled: false })
  const resolved = resolvePublicSiteMode(homepage)
  assert.equal(resolved.mode, "COMING_SOON")
  assert.equal(resolved.interstitial, true)
  const merged = mergeComingSoonConfig(resolved.config, justComingSoonModeConfig)
  assert.ok(merged.headline)
  assert.ok(Array.isArray(merged.paragraphs) && merged.paragraphs.length === 3)
  assert.ok(merged.launchDate)
  assert.ok(merged.legalLinks?.length)
  assert.ok(merged.leadForm)
  assert.equal(merged.leadCaptureEnabled, false)
  assert.equal(resolveComingSoonLeadForm(merged), null)
})

test("contract: NORMAL payload → JustInstitutionalHomepage paint", () => {
  const homepage = payload("NORMAL", {})
  const resolved = resolvePublicSiteMode(homepage)
  assert.equal(resolved.mode, "NORMAL")
  assert.equal(resolved.interstitial, false)
})

test("index.astro uses resolveComingSoonLeadForm and institutional homepage", () => {
  const indexSrc = readFileSync(join(root, "src/pages/index.astro"), "utf8")
  assert.match(indexSrc, /resolveComingSoonLeadForm/)
  assert.match(indexSrc, /ComingSoonPage/)
  assert.match(indexSrc, /JustInstitutionalHomepage/)
  assert.match(indexSrc, /origin:\s*publicCanonical\.origin/)
  assert.match(indexSrc, /isLeadIntakeSafeMode/)
  assert.doesNotMatch(indexSrc, /tenantId\s*===\s*["']just["']/)
})

test("ComingSoonLeadForm does not simulate persistence success", () => {
  const formSrc = readFileSync(
    join(root, "src/components/site-modes/ComingSoonLeadForm.astro"),
    "utf8",
  )
  assert.doesNotMatch(formSrc, /Obrigado!/)
  assert.doesNotMatch(formSrc, /success\.hidden = false/)
  assert.doesNotMatch(formSrc, /Recebemos seus dados/)
  assert.match(formSrc, /preventDefault/)
  assert.match(formSrc, /disabled/)
})

test("shouldRenderComingSoonLeadForm: same policy as helper (direct ComingSoonPage caller)", () => {
  const form = { submitLabel: "Quero saber primeiro" }
  assert.equal(shouldRenderComingSoonLeadForm(false, form), false)
  assert.equal(shouldRenderComingSoonLeadForm(undefined, form), false)
  assert.equal(shouldRenderComingSoonLeadForm(null, form), false)
  assert.equal(shouldRenderComingSoonLeadForm(true, form), true)
  assert.equal(shouldRenderComingSoonLeadForm(true, null), false)
  assert.equal(
    shouldRenderComingSoonLeadForm(true, form),
    Boolean(resolveComingSoonLeadForm({ leadCaptureEnabled: true, leadForm: form })),
  )
  assert.equal(
    shouldRenderComingSoonLeadForm(false, form),
    Boolean(resolveComingSoonLeadForm({ leadCaptureEnabled: false, leadForm: form })),
  )
})

test("ComingSoonPage enforces leadCaptureEnabled at the component boundary", () => {
  const pageSrc = readFileSync(
    join(root, "src/components/site-modes/ComingSoonPage.astro"),
    "utf8",
  )
  assert.match(pageSrc, /leadCaptureEnabled/)
  assert.match(pageSrc, /shouldRenderComingSoonLeadForm\(leadCaptureEnabled, leadForm\)/)
  const indexSrc = readFileSync(join(root, "src/pages/index.astro"), "utf8")
  assert.match(indexSrc, /leadCaptureEnabled=\{siteModeConfig\.leadCaptureEnabled === true\}/)
  assert.match(indexSrc, /resolveComingSoonLeadForm/)
})

test("ComingSoonPage keeps legal, logo, headline, copy, launch without requiring form", () => {
  const pageSrc = readFileSync(
    join(root, "src/components/site-modes/ComingSoonPage.astro"),
    "utf8",
  )
  assert.match(pageSrc, /site-mode__logo/)
  assert.match(pageSrc, /site-mode__headline/)
  assert.match(pageSrc, /site-mode__lead/)
  assert.match(pageSrc, /site-mode__launch/)
  assert.match(pageSrc, /legalLinks/)
  assert.match(pageSrc, /showLead/)
})

test("internal catalog/about/contact/product routes redirect under interstitial", () => {
  for (const file of ["catalogo.astro", "sobre.astro", "contato.astro", "p/[slug].astro"]) {
    const src = readFileSync(join(root, "src/pages", file), "utf8")
    assert.match(src, /chrome\.interstitial/)
    assert.match(src, /Astro\.redirect\("\/", 302\)/)
  }
})

test("legal pages stay reachable and share JustLegalLayout", () => {
  assert.equal(isInterstitialLegalPath("/privacidade"), true)
  assert.equal(isInterstitialLegalPath("/termos"), true)
  assert.equal(isInterstitialLegalPath("/seguranca"), true)
  for (const file of ["privacidade.astro", "termos.astro", "seguranca.astro"]) {
    const src = readFileSync(join(root, "src/pages", file), "utf8")
    assert.match(src, /JustLegalLayout/)
    assert.match(src, /loadJustInstitutionalChrome/)
  }
})
