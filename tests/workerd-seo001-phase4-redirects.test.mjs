import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { TENANT_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import { requestWithHost, root, startWrangler } from "./helpers/workerd-poc.mjs"

const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-seo001-phase4-anon"
const ALIAS_HOST = `www.${TENANT_ALPHA.host}`

test("workerd Phase 4: alias host 301 to primary; sitemap/robots follow canonical.origin", async (t) => {
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

  const primaryHome = await requestWithHost(port, TENANT_ALPHA.host, "/")
  assert.equal(primaryHome.status, 200)

  const aliasHome = await requestWithHost(port, ALIAS_HOST, "/")
  assert.equal(aliasHome.status, 301)
  assert.equal(
    aliasHome.headers.location,
    `https://${TENANT_ALPHA.host}/`,
  )

  const aliasSlash = await requestWithHost(port, ALIAS_HOST, "/homepage?utm_source=t&host=x")
  assert.equal(aliasSlash.status, 301)
  assert.equal(
    aliasSlash.headers.location,
    `https://${TENANT_ALPHA.host}/?utm_source=t`,
  )

  const aliasAsset = await requestWithHost(port, ALIAS_HOST, "/favicon.ico")
  assert.notEqual(aliasAsset.status, 301)

  const robotsPrimary = await requestWithHost(port, TENANT_ALPHA.host, "/robots.txt")
  assert.equal(robotsPrimary.status, 200)
  assert.match(robotsPrimary.body, /OAI-SearchBot/)
  assert.match(
    robotsPrimary.body,
    new RegExp(`Sitemap: https://${TENANT_ALPHA.host}/sitemap.xml`),
  )

  const robotsAlias = await requestWithHost(port, ALIAS_HOST, "/robots.txt")
  assert.equal(robotsAlias.status, 301)
  assert.equal(
    robotsAlias.headers.location,
    `https://${TENANT_ALPHA.host}/robots.txt`,
  )

  const sitemapPrimary = await requestWithHost(port, TENANT_ALPHA.host, "/sitemap.xml")
  assert.equal(sitemapPrimary.status, 200)
  assert.match(sitemapPrimary.body, new RegExp(`https://${TENANT_ALPHA.host}/`))
  assert.doesNotMatch(sitemapPrimary.body, /\/homepage/)
  assert.doesNotMatch(sitemapPrimary.body, new RegExp(ALIAS_HOST))

  const sitemapAlias = await requestWithHost(port, ALIAS_HOST, "/sitemap.xml")
  assert.equal(sitemapAlias.status, 301)
  assert.equal(
    sitemapAlias.headers.location,
    `https://${TENANT_ALPHA.host}/sitemap.xml`,
  )
})

test("workerd Phase 4: preview does not alias-redirect", async (t) => {
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
  })

  t.after(async () => {
    await wrangler.stop()
    await payloadMock.close()
  })

  await wrangler.ready()

  const aliasHome = await requestWithHost(port, ALIAS_HOST, "/")
  assert.equal(aliasHome.status, 200)
  assert.notEqual(aliasHome.status, 301)

  const robots = await requestWithHost(port, TENANT_ALPHA.host, "/robots.txt")
  assert.equal(robots.status, 200)
  assert.match(robots.body, /Disallow: \//)
  assert.doesNotMatch(robots.body, /Sitemap:/)
})
