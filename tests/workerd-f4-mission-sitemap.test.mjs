import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import { FIXTURE_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import { requestWithHost, root, startWrangler } from "./helpers/workerd-poc.mjs"

const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-f4-mission-sitemap-anon"

const F4_HOST = "www.dorot-f4-sitemap.example.test"
const F4_TENANT_ID = "00000000-0000-4000-8000-00000000f4s1"

/**
 * Dorot-shaped F4 mission routes.
 * `/clube/assinar` is included when listed in missionRoutes (Dorot standalone
 * includes the signup path in its sitemap) — collectPublicSitemapPaths mirrors that.
 */
const F4_MISSION_ROUTES = [
  {
    kind: "content_page",
    path: "/privacidade",
    title: "Aviso de Privacidade",
    heading: "Aviso de Privacidade",
    body: "Privacy body",
  },
  {
    kind: "content_page",
    path: "/termos-do-clube",
    title: "Informações do Clube",
    heading: "Informações do Clube",
    body: "Club terms body",
  },
  {
    kind: "form_signup_shell",
    path: "/clube/assinar",
    title: "Assinar o Clube",
    heading: "Assinar o Clube",
    body: "Signup body",
  },
]

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

function f4Payload({
  host,
  tenantId,
  companyName,
  requestHost = host,
  isPrimaryRequest = true,
  pub = publication(host),
}) {
  return {
    ...FIXTURE_ALPHA,
    tenantId,
    host,
    routes: F4_MISSION_ROUTES,
    canonical: {
      host,
      origin: `https://${host}`,
      requestHost,
      isPrimaryRequest,
    },
    publication: pub,
    source: {
      ...FIXTURE_ALPHA.source,
      contact: {
        ...FIXTURE_ALPHA.source?.contact,
        companyName,
        email: `${tenantId.slice(0, 8)}@example.test`,
      },
      meta: {
        ...FIXTURE_ALPHA.source?.meta,
        presentationProfile: "f4.presentation.mission_v1",
      },
      missionRoutes: F4_MISSION_ROUTES,
    },
    serializablePlan: {
      ...FIXTURE_ALPHA.serializablePlan,
      presentation: {
        profile: "f4.presentation.mission_v1",
        chrome: {
          heroLayout: "cinematic",
          aboutLayout: "standard",
          ctaLayout: "standard",
          footerSurface: "dark",
          justSignatureBand: true,
          headerOverHero: true,
          navItems: [
            { label: "Sobre", href: "/#sobre" },
            { label: "Patrocínio", href: "/#sponsorship" },
            { label: "Publicações", href: "/#published" },
            { label: "Contato", href: "/#contact" },
          ],
          headerCtaLabel: "Fale conosco",
          headerCtaHref: "/#contact",
          legalLinks: [
            { label: "Privacidade", href: "/privacidade" },
            { label: "Termos do Clube", href: "/termos-do-clube" },
          ],
        },
      },
    },
  }
}

function locList(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

function assertApprovedSitemapHeaders(res) {
  assert.equal(res.status, 200)
  assert.match(String(res.headers["content-type"] || ""), /application\/xml/)
  assert.match(String(res.headers["content-type"] || ""), /charset=utf-8/)
  assert.match(String(res.headers["cache-control"] || ""), /max-age=0/)
  assert.match(String(res.headers["cache-control"] || ""), /must-revalidate/)
  assert.doesNotMatch(String(res.headers["cache-control"] || ""), /no-store/)
  assert.doesNotMatch(String(res.headers["x-robots-tag"] || ""), /noindex/)
}

function assertNoindexSitemapHeaders(res) {
  assert.equal(res.status, 200)
  assert.match(String(res.headers["content-type"] || ""), /application\/xml/)
  assert.match(String(res.headers["cache-control"] || ""), /no-store/)
  assert.match(String(res.headers["x-robots-tag"] || ""), /noindex/)
}

test("workerd F4 production sitemap is INDEXABLE for mission routes including /clube/assinar", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const extraHostFixtures = {
    [F4_HOST]: f4Payload({
      host: F4_HOST,
      tenantId: F4_TENANT_ID,
      companyName: "Dorot F4 Sitemap",
    }),
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

  const sitemap = await requestWithHost(port, F4_HOST, "/sitemap.xml")
  assertApprovedSitemapHeaders(sitemap)
  const locs = locList(sitemap.body)
  assert.deepEqual(locs, [
    `https://${F4_HOST}/`,
    `https://${F4_HOST}/privacidade`,
    `https://${F4_HOST}/termos-do-clube`,
    `https://${F4_HOST}/clube/assinar`,
  ])

  const robots = await requestWithHost(port, F4_HOST, "/robots.txt")
  assert.match(robots.body, new RegExp(`Sitemap: https://${F4_HOST}/sitemap.xml`))
})

test("workerd F4 staging safe-mode sitemap stays empty noindex", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const extraHostFixtures = {
    [F4_HOST]: f4Payload({
      host: F4_HOST,
      tenantId: F4_TENANT_ID,
      companyName: "Dorot F4 Sitemap",
    }),
  }
  const mock = startCanonicalPayloadMock(extraHostFixtures)
  const { baseUrl: mockUrl } = await mock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "staging",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER,
    SEO001_ENFORCE_PUBLICATION_INDEXING: "true",
  })

  t.after(async () => {
    await wrangler.stop()
    await mock.close()
  })

  await wrangler.ready()

  const sitemap = await requestWithHost(port, F4_HOST, "/sitemap.xml")
  assertNoindexSitemapHeaders(sitemap)
  assert.match(
    sitemap.body,
    /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><\/urlset>/,
  )
  assert.doesNotMatch(sitemap.body, /<loc>/)
})
