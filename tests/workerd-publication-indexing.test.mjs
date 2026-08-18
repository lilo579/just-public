import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import { FIXTURE_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import { requestWithHost, root, startWrangler } from "./helpers/workerd-poc.mjs"

const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-publication-indexing-anon"
const APPROVED_HOST = "approved-pub.example.test"
const MISSING_HOST = "missing-pub.example.test"
const FOREIGN_HOST = "foreign-pub.example.test"
const MISMATCH_HOST = "mismatch-pub.example.test"

function publication(host, extra = {}) {
  return {
    contractVersion: "v1",
    present: true,
    indexingEnabled: true,
    domainState: "domain_bound",
    seoState: "seo_validated",
    canonicalHost: host,
    ...extra,
  }
}

function payloadFor(host, pub, companyName, email) {
  return {
    ...FIXTURE_ALPHA,
    tenantId: "00000000-0000-4000-8000-000000000099",
    host,
    canonical: {
      host,
      origin: `https://${host}`,
      requestHost: host,
      isPrimaryRequest: true,
    },
    publication: pub,
    source: {
      ...FIXTURE_ALPHA.source,
      contact: {
        ...FIXTURE_ALPHA.source?.contact,
        companyName,
        email,
      },
    },
  }
}

test("workerd flag ON: approved stays indexable; missing publication is noindex/no-store", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const extraHostFixtures = {
    [APPROVED_HOST]: payloadFor(
      APPROVED_HOST,
      publication(APPROVED_HOST),
      "Approved Pub Co",
      "approved@example.test",
    ),
    [MISSING_HOST]: payloadFor(MISSING_HOST, null, "Missing Pub Co", "missing@example.test"),
    [FOREIGN_HOST]: payloadFor(
      FOREIGN_HOST,
      publication(FOREIGN_HOST),
      "Foreign Pub Co",
      "foreign@example.test",
    ),
    [MISMATCH_HOST]: payloadFor(
      MISMATCH_HOST,
      publication(FOREIGN_HOST),
      "Mismatch Pub Co",
      "mismatch@example.test",
    ),
  }

  const mock = startCanonicalPayloadMock(extraHostFixtures)
  const { baseUrl: mockUrl } = await mock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "production",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER,
    SEO001_ENFORCE_PUBLICATION_INDEXING: "true",
  })

  t.after(async () => {
    await wrangler.stop()
    await mock.close()
  })

  await wrangler.ready()

  const health = await fetch(`http://127.0.0.1:${port}/health`)
  const healthBody = await health.json()
  assert.equal(healthBody.publicationContractVersion, "v1")
  assert.equal(healthBody.publicationIndexingEnforced, true)

  const approvedHtml = await requestWithHost(port, APPROVED_HOST, "/")
  assert.equal(approvedHtml.status, 200)
  assert.match(approvedHtml.body, /rel="canonical" href="https:\/\/approved-pub\.example\.test\/"/)
  assert.match(approvedHtml.body, /property="og:url" content="https:\/\/approved-pub\.example\.test\/"/)
  assert.match(approvedHtml.body, /Approved Pub Co/)
  assert.doesNotMatch(approvedHtml.body, /noindex/)
  assert.doesNotMatch(approvedHtml.body, /Foreign Pub Co|foreign-pub\.example\.test/)
  assert.doesNotMatch(approvedHtml.headers["x-robots-tag"] || "", /noindex/)
  assert.doesNotMatch(String(approvedHtml.headers["cache-control"] || ""), /no-store/)

  const approvedRobots = await requestWithHost(port, APPROVED_HOST, "/robots.txt")
  assert.equal(approvedRobots.status, 200)
  assert.match(approvedRobots.body, /Allow: \//)
  assert.doesNotMatch(approvedRobots.body, /Disallow: \//)
  assert.match(approvedRobots.body, /Sitemap: https:\/\/approved-pub\.example\.test\/sitemap\.xml/)
  assert.doesNotMatch(approvedRobots.headers["x-robots-tag"] || "", /noindex/)

  const approvedSitemap = await requestWithHost(port, APPROVED_HOST, "/sitemap.xml")
  assert.equal(approvedSitemap.status, 200)
  assert.match(approvedSitemap.body, /https:\/\/approved-pub\.example\.test\//)
  assert.doesNotMatch(approvedSitemap.body, /<urlset[^>]*><\/urlset>/)
  assert.doesNotMatch(approvedSitemap.body, /foreign-pub\.example\.test/)
  assert.doesNotMatch(approvedSitemap.headers["x-robots-tag"] || "", /noindex/)

  const missingHtml = await requestWithHost(port, MISSING_HOST, "/")
  assert.equal(missingHtml.status, 200)
  assert.match(missingHtml.body, /noindex/)
  assert.match(missingHtml.headers["x-robots-tag"] || "", /noindex/)
  assert.match(String(missingHtml.headers["cache-control"] || ""), /no-store/)
  assert.doesNotMatch(missingHtml.body, /rel="canonical" href="https:\/\/alpha\.justwebsites\.com\.br/)
  assert.doesNotMatch(missingHtml.body, /Approved Pub Co|Foreign Pub Co|foreign-pub\.example\.test/)

  const missingRobots = await requestWithHost(port, MISSING_HOST, "/robots.txt")
  assert.equal(missingRobots.status, 200)
  assert.match(missingRobots.body, /Disallow: \//)
  assert.doesNotMatch(missingRobots.body, /Allow: \//)
  assert.match(missingRobots.headers["x-robots-tag"] || "", /noindex/)
  assert.match(String(missingRobots.headers["cache-control"] || ""), /no-store/)

  const missingSitemap = await requestWithHost(port, MISSING_HOST, "/sitemap.xml")
  assert.equal(missingSitemap.status, 200)
  assert.match(missingSitemap.body, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><\/urlset>/)
  assert.doesNotMatch(missingSitemap.body, /<loc>/)
  assert.match(missingSitemap.headers["x-robots-tag"] || "", /noindex/)
  assert.match(String(missingSitemap.headers["cache-control"] || ""), /no-store/)

  const mismatchHtml = await requestWithHost(port, MISMATCH_HOST, "/")
  assert.equal(mismatchHtml.status, 200)
  assert.match(mismatchHtml.body, /noindex/)
  assert.match(mismatchHtml.headers["x-robots-tag"] || "", /noindex/)
  assert.match(String(mismatchHtml.headers["cache-control"] || ""), /no-store/)
  assert.doesNotMatch(mismatchHtml.body, /Approved Pub Co|Foreign Pub Co/)

  const approvedC = await requestWithHost(port, APPROVED_HOST, "/c")
  assert.equal(approvedC.status, 200)
  assert.doesNotMatch(approvedC.body, /noindex/)
  assert.doesNotMatch(approvedC.headers["x-robots-tag"] || "", /noindex/)
  assert.doesNotMatch(String(approvedC.headers["cache-control"] || ""), /no-store/)
  assert.doesNotMatch(approvedC.body, /Foreign Pub Co|foreign-pub\.example\.test/)

  const missingC = await requestWithHost(port, MISSING_HOST, "/c")
  assert.equal(missingC.status, 200)
  assert.match(missingC.body, /noindex/)
  assert.match(missingC.headers["x-robots-tag"] || "", /noindex/)
  assert.match(String(missingC.headers["cache-control"] || ""), /no-store/)

  const favicon = await requestWithHost(port, MISSING_HOST, "/favicon.ico")
  assert.ok(
    favicon.status === 200 || favicon.status === 302 || favicon.status === 404,
    `favicon status intact, got ${favicon.status}`,
  )
  assert.doesNotMatch(
    favicon.headers["x-robots-tag"] || "",
    /noindex/,
    "favicon must not inherit publication-missing X-Robots-Tag",
  )
  if (favicon.status === 302) {
    assert.ok(favicon.headers.location, "favicon redirect Location intact")
    assert.doesNotMatch(
      String(favicon.headers["cache-control"] || ""),
      /no-store/,
      "favicon 302 must keep its own cache, not gate no-store",
    )
  } else if (favicon.status === 404) {
    assert.equal(favicon.body, "", "favicon 404 body intact (empty, not HTML)")
  }

  const brandingAsset = await requestWithHost(
    port,
    MISSING_HOST,
    "/branding/just/favicon.svg",
  )
  assert.equal(brandingAsset.status, 200)
  assert.match(brandingAsset.body, /<svg/i)
  assert.doesNotMatch(brandingAsset.headers["x-robots-tag"] || "", /noindex/)
  assert.doesNotMatch(String(brandingAsset.headers["cache-control"] || ""), /no-store/)
})
