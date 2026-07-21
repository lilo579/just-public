import test from "node:test"
import assert from "node:assert/strict"

import {
  buildPublicSitePayloadUrl,
  chooseHomepageRenderer,
  resolveRequestHost,
} from "../src/lib/publicHomepageHelpers.js"
import {
  sanitizeCssColor,
  themeTokensFromBranding,
  themeTokensToInlineStyle,
} from "../src/lib/themeFromBranding.js"

const PAYLOAD_BASE = "https://example.test/functions/v1/public-site-payload"

const TENANT_ALPHA = {
  id: "tenant_alpha",
  title: "Alpha Legal",
  primaryColor: "#112233",
  secondaryColor: "#445566",
  contactEmail: "alpha@example.com",
  host: "alpha.example.com",
  previewHost: "alpha.justwebsites.com.br",
}

const TENANT_BETA = {
  id: "tenant_beta",
  title: "Beta Studio",
  primaryColor: "#aabbcc",
  secondaryColor: "#ddeeff",
  contactEmail: "beta@example.com",
  host: "beta.example.com",
  previewHost: "beta.justwebsites.com.br",
}

function fixtureHomepage(tenant, { withPlan = true, withBlocks = false } = {}) {
  return {
    status: "ready",
    blocks: withBlocks
      ? [{ type: "hero", content: { title: tenant.title } }]
      : [],
    footer: {
      logoUrl: null,
      tagline: null,
      whatsappNumber: null,
      whatsappVisible: false,
      email: tenant.contactEmail,
      address: null,
      companyName: tenant.title,
      socialLinks: [],
    },
    source: {
      contact: {
        companyName: tenant.title,
        email: tenant.contactEmail,
      },
      meta: {
        branding: {
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          typography: "modern",
        },
      },
    },
    serializablePlan: withPlan
      ? {
          recipeId: "default",
          nodes: [{ type: "hero", props: { title: tenant.title } }],
        }
      : undefined,
  }
}

test("Host A and Host B produce distinct payload request hosts", () => {
  const urlA = buildPublicSitePayloadUrl(
    { kind: "host", host: TENANT_ALPHA.host },
    "public",
    PAYLOAD_BASE,
  )
  const urlB = buildPublicSitePayloadUrl(
    { kind: "host", host: TENANT_BETA.host },
    "public",
    PAYLOAD_BASE,
  )

  assert.match(urlA, /host=alpha\.example\.com/)
  assert.match(urlB, /host=beta\.example\.com/)
  assert.doesNotMatch(urlA, /beta/)
  assert.doesNotMatch(urlB, /alpha/)
})

test("preview hosts are passed through distinctly", () => {
  const urlA = buildPublicSitePayloadUrl(
    { kind: "host", host: TENANT_ALPHA.previewHost },
    "preview",
    PAYLOAD_BASE,
  )
  const urlB = buildPublicSitePayloadUrl(
    { kind: "host", host: TENANT_BETA.previewHost },
    "preview",
    PAYLOAD_BASE,
  )
  assert.match(urlA, /host=alpha\.justwebsites\.com\.br/)
  assert.match(urlB, /host=beta\.justwebsites\.com\.br/)
  assert.match(urlA, /mode=preview/)
})

test("resolveRequestHost prefers ?host= then URL.hostname then Host fallback", () => {
  const reqIgnored = new Request("https://ignored.example/", {
    headers: { host: "beta.example.com" },
  })
  assert.equal(
    resolveRequestHost(reqIgnored, new URLSearchParams("host=alpha.example.com")),
    "alpha.example.com",
  )
  // URL.hostname wins over conflicting Host header when authoritative.
  assert.equal(resolveRequestHost(reqIgnored, new URLSearchParams()), "ignored.example")

  const loopback = new Request("http://127.0.0.1:8793/", {
    headers: { host: "beta.example.com" },
  })
  assert.equal(resolveRequestHost(loopback, new URLSearchParams()), "beta.example.com")
})
test("canonical renderer is the default when serializablePlan exists", () => {
  const homepage = fixtureHomepage(TENANT_ALPHA)
  const choice = chooseHomepageRenderer(homepage)
  assert.equal(choice.mode, "canonical")
  assert.equal(choice.plan.nodes[0].props.title, "Alpha Legal")
})

test("valid serializablePlan renders via canonical choice", () => {
  const homepage = fixtureHomepage(TENANT_BETA)
  const choice = chooseHomepageRenderer(homepage)
  assert.equal(choice.mode, "canonical")
})

test("invalid plan does not silently fall back to another tenant or hardcoded content", () => {
  const broken = fixtureHomepage(TENANT_ALPHA, { withPlan: false, withBlocks: false })
  const choice = chooseHomepageRenderer(broken)
  assert.equal(choice.mode, "error")
  assert.equal(choice.reason, "canonical_plan_missing")
})

test("Shop/NoSource: no plan + blocks → legacy runtime (architectural)", () => {
  const homepage = fixtureHomepage(TENANT_ALPHA, { withPlan: false, withBlocks: true })
  const legacy = chooseHomepageRenderer(homepage)
  assert.equal(legacy.mode, "legacy")
  assert.equal(legacy.reason, "nosource_or_shop_legacy_runtime")
})

test("forceLegacy with canonical plan is rejected (kill-switch)", () => {
  const forced = chooseHomepageRenderer(fixtureHomepage(TENANT_ALPHA), {
    forceLegacy: true,
  })
  assert.equal(forced.mode, "error")
  assert.equal(forced.reason, "legacy_forbidden_for_canonical_plan")
})

test("theme A and theme B produce distinct CSS tokens", () => {
  const tokensA = themeTokensFromBranding({
    primaryColor: TENANT_ALPHA.primaryColor,
    secondaryColor: TENANT_ALPHA.secondaryColor,
  })
  const tokensB = themeTokensFromBranding({
    primaryColor: TENANT_BETA.primaryColor,
    secondaryColor: TENANT_BETA.secondaryColor,
  })

  assert.equal(tokensA["--site-color-primary"], "#112233")
  assert.equal(tokensB["--site-color-primary"], "#aabbcc")
  assert.notEqual(tokensA["--site-color-primary"], tokensB["--site-color-primary"])
  assert.notEqual(tokensA["--site-color-secondary"], tokensB["--site-color-secondary"])
})

test("invalid branding falls back to safe defaults", () => {
  assert.equal(sanitizeCssColor("red", "#2563eb"), "#2563eb")
  assert.equal(sanitizeCssColor("expression(alert(1))", "#2563eb"), "#2563eb")
  assert.equal(sanitizeCssColor("#gg0000", "#2563eb"), "#2563eb")

  const tokens = themeTokensFromBranding({
    primaryColor: "not-a-color",
    secondaryColor: "url(evil)",
    typography: "comic-sans-injected",
  })
  assert.equal(tokens["--site-color-primary"], "#2563eb")
  assert.match(tokens["--site-font-heading"], /system-ui/)
  assert.doesNotMatch(themeTokensToInlineStyle(tokens), /url\(|expression|comic/i)
})

test("Hub bare HSL branding components become hsl() tokens", () => {
  assert.equal(sanitizeCssColor("146 7% 45%", "#2563eb"), "hsl(146 7% 45%)")
  assert.equal(sanitizeCssColor("37 27% 94%", "#0f172a"), "hsl(37 27% 94%)")

  const tokens = themeTokensFromBranding({
    primaryColor: "146 7% 45%",
    secondaryColor: "37 27% 94%",
    accentColor: "207 4% 56%",
    typography: "modern",
  })
  assert.equal(tokens["--site-color-primary"], "hsl(146 7% 45%)")
  assert.equal(tokens["--site-color-background"], "hsl(37 27% 94%)")
  assert.equal(tokens["--site-color-accent"], "hsl(207 4% 56%)")
  assert.equal(tokens["--site-color-secondary"], "#0f172a")
})

test("alpha/beta isolation: no field leaks across fixtures", () => {
  const alpha = fixtureHomepage(TENANT_ALPHA)
  const beta = fixtureHomepage(TENANT_BETA)
  const tokensA = themeTokensFromBranding(alpha.source.meta.branding)
  const tokensB = themeTokensFromBranding(beta.source.meta.branding)
  const styleA = themeTokensToInlineStyle(tokensA)
  const styleB = themeTokensToInlineStyle(tokensB)
  const choiceA = chooseHomepageRenderer(alpha)
  const choiceB = chooseHomepageRenderer(beta)

  assert.equal(choiceA.mode, "canonical")
  assert.equal(choiceB.mode, "canonical")

  const alphaBlob = JSON.stringify({
    title: alpha.source.contact.companyName,
    email: alpha.footer.email,
    color: tokensA["--site-color-primary"],
    style: styleA,
    planTitle: choiceA.plan.nodes[0].props.title,
    host: TENANT_ALPHA.host,
  })
  const betaBlob = JSON.stringify({
    title: beta.source.contact.companyName,
    email: beta.footer.email,
    color: tokensB["--site-color-primary"],
    style: styleB,
    planTitle: choiceB.plan.nodes[0].props.title,
    host: TENANT_BETA.host,
  })

  for (const marker of ["Alpha Legal", "alpha@example.com", "#112233", "alpha.example.com"]) {
    assert.match(alphaBlob, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    assert.doesNotMatch(betaBlob, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  for (const marker of ["Beta Studio", "beta@example.com", "#aabbcc", "beta.example.com"]) {
    assert.match(betaBlob, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    assert.doesNotMatch(alphaBlob, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("public path helpers have no hard-coded tenant uuid or client slug", async () => {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")
  const root = path.resolve("src")
  const files = []

  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (/\.(ts|astro|mjs|js)$/.test(entry.name)) files.push(full)
    }
  }
  await walk(root)

  const forbidden = [/76a96afa/i, /3djewish/i, /marceloborer/i, /tenant_domains/]
  const offenders = []
  for (const file of files) {
    const text = await fs.readFile(file, "utf8")
    for (const re of forbidden) {
      if (re.test(text)) offenders.push(`${file}: ${re}`)
    }
  }
  assert.deepEqual(offenders, [])
})
