import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  HOST_AUTHORITY_UNAVAILABLE,
  HOST_MISSING_PRIMARY,
  HOST_UNKNOWN,
  SEO001_TENANT_A,
  SEO001_TENANT_B,
} from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import { requestWithHost, root, startWrangler } from "./helpers/workerd-poc.mjs"

const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-seo001-phase6-anon"

/**
 * Prove the renderer obeys DB primary (apex OR www), not a hardcoded apex policy.
 */
test("workerd Phase 6: two-tenant apex/www matrix + fail-closed + single payload fetch", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const payloadMock = startCanonicalPayloadMock()
  const { baseUrl: mockUrl } = await payloadMock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "production",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER,
  })

  t.after(async () => {
    await wrangler.stop()
    await payloadMock.close()
  })

  await wrangler.ready()

  // --- Tenant A: apex primary ---
  const aPrimary = await requestWithHost(port, SEO001_TENANT_A.primary, "/")
  assert.equal(aPrimary.status, 200)
  assert.match(aPrimary.body, /rel="canonical" href="https:\/\/alpha\.com\.br\/"/)
  assert.match(aPrimary.body, /property="og:url" content="https:\/\/alpha\.com\.br\/"/)
  assert.doesNotMatch(aPrimary.body, /www\.alpha\.com\.br/)

  const aAlias = await requestWithHost(port, SEO001_TENANT_A.alias, "/")
  assert.equal(aAlias.status, 301)
  assert.equal(aAlias.headers.location, "https://alpha.com.br/")

  const aSlash = await requestWithHost(
    port,
    SEO001_TENANT_A.alias,
    "/homepage/?utm_source=phase6",
  )
  assert.equal(aSlash.status, 301)
  assert.equal(aSlash.headers.location, "https://alpha.com.br/?utm_source=phase6")

  const aRobots = await requestWithHost(port, SEO001_TENANT_A.primary, "/robots.txt")
  assert.equal(aRobots.status, 200)
  assert.match(aRobots.body, /Sitemap: https:\/\/alpha\.com\.br\/sitemap\.xml/)
  assert.match(aRobots.body, /OAI-SearchBot/)

  const aSitemap = await requestWithHost(port, SEO001_TENANT_A.primary, "/sitemap.xml")
  assert.equal(aSitemap.status, 200)
  assert.match(aSitemap.body, /https:\/\/alpha\.com\.br\//)
  assert.doesNotMatch(aSitemap.body, /www\.alpha\.com\.br/)
  assert.doesNotMatch(aSitemap.body, /beta\.com\.br/)

  // --- Tenant B: www primary (proves no apex hardcoding) ---
  const bPrimary = await requestWithHost(port, SEO001_TENANT_B.primary, "/")
  assert.equal(bPrimary.status, 200)
  assert.match(
    bPrimary.body,
    /rel="canonical" href="https:\/\/www\.beta\.com\.br\/"/,
  )
  assert.match(
    bPrimary.body,
    /property="og:url" content="https:\/\/www\.beta\.com\.br\/"/,
  )
  assert.doesNotMatch(bPrimary.body, /"https:\/\/beta\.com\.br\/"/)

  const bAlias = await requestWithHost(port, SEO001_TENANT_B.alias, "/")
  assert.equal(bAlias.status, 301)
  assert.equal(bAlias.headers.location, "https://www.beta.com.br/")

  const bRobots = await requestWithHost(port, SEO001_TENANT_B.primary, "/robots.txt")
  assert.equal(bRobots.status, 200)
  assert.match(bRobots.body, /Sitemap: https:\/\/www\.beta\.com\.br\/sitemap\.xml/)

  const bSitemap = await requestWithHost(port, SEO001_TENANT_B.primary, "/sitemap.xml")
  assert.equal(bSitemap.status, 200)
  assert.match(bSitemap.body, /https:\/\/www\.beta\.com\.br\//)
  assert.doesNotMatch(bSitemap.body, /https:\/\/beta\.com\.br\//)
  assert.doesNotMatch(bSitemap.body, /alpha\.com\.br/)

  // Isolation: A HTML must not contain B company marker
  assert.doesNotMatch(aPrimary.body, /Beta SEO001 Co/)
  assert.doesNotMatch(bPrimary.body, /Alpha SEO001 Co/)

  // Fail closed
  const missing = await requestWithHost(port, HOST_MISSING_PRIMARY, "/")
  assert.equal(missing.status, 422)
  assert.equal(missing.headers["cache-control"], "no-store")
  assert.match(missing.headers["x-robots-tag"] || "", /noindex/)

  const unavailable = await requestWithHost(port, HOST_AUTHORITY_UNAVAILABLE, "/")
  assert.equal(unavailable.status, 503)
  assert.equal(unavailable.headers["cache-control"], "no-store")
  assert.match(unavailable.headers["x-robots-tag"] || "", /noindex/)

  const unknown = await requestWithHost(port, HOST_UNKNOWN, "/")
  assert.equal(unknown.status, 404)
  assert.equal(unknown.headers["cache-control"], "no-store")

  const health = await requestWithHost(port, SEO001_TENANT_A.primary, "/health")
  assert.equal(health.status, 200)
  const healthJson = JSON.parse(health.body)
  assert.equal(healthJson.status, "ok")
  assert.equal(healthJson.canonicalContractVersion, "seo001-v1")
  assert.equal(healthJson.features.sharedAuthorityCache, false)

  const asset = await requestWithHost(port, SEO001_TENANT_A.alias, "/favicon.ico")
  assert.notEqual(asset.status, 301)

  // Single payload fetch per homepage request (middleware + page reuse locals).
  const beforeHome = payloadMock.calls.length
  const reuseHome = await requestWithHost(port, SEO001_TENANT_A.primary, "/")
  assert.equal(reuseHome.status, 200)
  const homeCalls = payloadMock.calls
    .slice(beforeHome)
    .filter((c) => c.host === SEO001_TENANT_A.primary && c.status === 200)
  assert.equal(
    homeCalls.length,
    1,
    `expected 1 payload fetch for /, got ${homeCalls.length}: ${JSON.stringify(homeCalls)}`,
  )
})

test("workerd Phase 6: preview stays noindex and skips alias redirect", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const payloadMock = startCanonicalPayloadMock()
  const { baseUrl: mockUrl } = await payloadMock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "preview",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER,
    POC_FIXTURE_MODE: "false",
    PUBLIC_SERVER_TIMING: "true",
  })

  t.after(async () => {
    await wrangler.stop()
    await payloadMock.close()
  })

  await wrangler.ready()

  const alias = await requestWithHost(port, SEO001_TENANT_A.alias, "/")
  assert.equal(alias.status, 200)
  assert.notEqual(alias.status, 301)
  assert.match(alias.headers["x-robots-tag"] || "", /noindex/)
  assert.match(alias.headers["server-timing"] || "", /canonical;dur=/)

  const robots = await requestWithHost(port, SEO001_TENANT_A.primary, "/robots.txt")
  assert.equal(robots.status, 200)
  assert.match(robots.body, /Disallow: \//)
  assert.doesNotMatch(robots.body, /Sitemap:/)
})
