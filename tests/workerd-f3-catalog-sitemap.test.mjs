import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import { FIXTURE_ALPHA, TENANT_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import {
  F3_JEWISH_GSC_PRODUCT_PATHS,
  F3_JEWISH_HOST,
  F3_JEWISH_ORIGIN,
  F3_JEWISH_TENANT_ID,
} from "./fixtures/f3-jewish-catalog-paths.mjs"
import { FIXTURE_JUST_NORMAL } from "../src/poc/publicSiteFixtures.js"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import { requestWithHost, root, startWrangler } from "./helpers/workerd-poc.mjs"
import { buildCanonicalUrl } from "../src/lib/canonicalAuthority.js"

const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-f3-catalog-sitemap-anon"
const F3_PEER_HOST = "f3-peer.example.test"
const F3_PEER_TENANT_ID = "00000000-0000-4000-8000-f3peer000001"
const F3_RPC_ERROR_HOST = "f3-rpc-error.example.test"
const F3_RPC_ERROR_TENANT_ID = "00000000-0000-4000-8000-f3rpc0000001"
const F3_MISSING_PUB_HOST = "f3-missing-pub.example.test"
const F3_REVOKED_PUB_HOST = "f3-revoked-pub.example.test"
const F3_INVALID_PUB_HOST = "f3-invalid-pub.example.test"
const F3_MISMATCH_PUB_HOST = "f3-mismatch-pub.example.test"
const JUST_HOST = "www.justwebsites.com.br"
const JEWISH_WWW = `www.${F3_JEWISH_HOST}`

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

function f3Payload({
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
        presentationProfile: "f3.presentation.grid_v1",
      },
    },
    serializablePlan: {
      ...FIXTURE_ALPHA.serializablePlan,
      presentation: {
        profile: "f3.presentation.grid_v1",
        chrome: {
          heroLayout: "catalog",
          navItems: [
            { label: "Catálogo", href: "/catalogo" },
            { label: "Sobre", href: "/sobre" },
            { label: "Contato", href: "/contato" },
          ],
        },
      },
    },
  }
}

function locList(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

/** Approved publication sitemap: XML, production HTML cache baseline, never noindex. */
function assertApprovedSitemapHeaders(res) {
  assert.equal(res.status, 200)
  assert.match(String(res.headers["content-type"] || ""), /application\/xml/)
  assert.match(String(res.headers["content-type"] || ""), /charset=utf-8/)
  assert.match(String(res.headers["cache-control"] || ""), /max-age=0/)
  assert.match(String(res.headers["cache-control"] || ""), /must-revalidate/)
  assert.doesNotMatch(String(res.headers["cache-control"] || ""), /no-store/)
  assert.doesNotMatch(String(res.headers["x-robots-tag"] || ""), /noindex/)
}

/** Publication-blocked sitemap: XML + noindex + no-store. */
function assertNoindexSitemapHeaders(res) {
  assert.equal(res.status, 200)
  assert.match(String(res.headers["content-type"] || ""), /application\/xml/)
  assert.match(String(res.headers["cache-control"] || ""), /no-store/)
  assert.match(String(res.headers["x-robots-tag"] || ""), /noindex/)
}

function productRows(tenantId, paths) {
  return paths.map((productPath, index) => ({
    tenant_id: tenantId,
    product_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    slug: productPath.replace(/^\/p\//, ""),
    name: productPath,
  }))
}

test("workerd F3 catalog sitemap is tenant-scoped; non-F3 and JUST stay unchanged", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const jewishProducts = [...F3_JEWISH_GSC_PRODUCT_PATHS, "/p/vale-presente"]
  const extraHostFixtures = {
    [F3_JEWISH_HOST]: f3Payload({
      host: F3_JEWISH_HOST,
      tenantId: F3_JEWISH_TENANT_ID,
      companyName: "3D Jewish",
    }),
    [JEWISH_WWW]: f3Payload({
      host: F3_JEWISH_HOST,
      tenantId: F3_JEWISH_TENANT_ID,
      companyName: "3D Jewish",
      requestHost: JEWISH_WWW,
      isPrimaryRequest: false,
    }),
    [F3_PEER_HOST]: f3Payload({
      host: F3_PEER_HOST,
      tenantId: F3_PEER_TENANT_ID,
      companyName: "F3 Peer Shop",
    }),
    [F3_RPC_ERROR_HOST]: f3Payload({
      host: F3_RPC_ERROR_HOST,
      tenantId: F3_RPC_ERROR_TENANT_ID,
      companyName: "F3 Rpc Error",
    }),
    [TENANT_ALPHA.host]: {
      ...FIXTURE_ALPHA,
      publication: publication(TENANT_ALPHA.host),
    },
    [JUST_HOST]: {
      ...FIXTURE_JUST_NORMAL,
      publication: publication(JUST_HOST),
    },
  }

  const mock = startCanonicalPayloadMock(extraHostFixtures, {}, {
    rpcProductsByHost: {
      [F3_JEWISH_HOST]: [
        ...productRows(F3_JEWISH_TENANT_ID, jewishProducts),
        { tenant_id: F3_PEER_TENANT_ID, slug: "peer-only-product" },
      ],
      [F3_PEER_HOST]: productRows(F3_PEER_TENANT_ID, ["/p/peer-only-product"]),
    },
    rpcErrorHosts: [F3_RPC_ERROR_HOST],
  })
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

  const jewishCanonical = {
    host: F3_JEWISH_HOST,
    origin: F3_JEWISH_ORIGIN,
    requestHost: F3_JEWISH_HOST,
    isPrimaryRequest: true,
  }

  const jewishSitemap = await requestWithHost(port, F3_JEWISH_HOST, "/sitemap.xml")
  assertApprovedSitemapHeaders(jewishSitemap)
  const jewishLocs = locList(jewishSitemap.body)
  assert.deepEqual(jewishLocs.slice(0, 4), [
    `${F3_JEWISH_ORIGIN}/`,
    `${F3_JEWISH_ORIGIN}/catalogo`,
    `${F3_JEWISH_ORIGIN}/sobre`,
    `${F3_JEWISH_ORIGIN}/contato`,
  ])
  for (const gscPath of F3_JEWISH_GSC_PRODUCT_PATHS) {
    assert.equal(jewishLocs.includes(`${F3_JEWISH_ORIGIN}${gscPath}`), true, gscPath)
  }
  assert.equal(jewishLocs.includes(`${F3_JEWISH_ORIGIN}/p/vale-presente`), true)
  assert.equal(jewishLocs.includes(`${F3_JEWISH_ORIGIN}/p/peer-only-product`), false)
  for (const loc of jewishLocs) {
    const pathName = loc === `${F3_JEWISH_ORIGIN}/` ? "/" : loc.slice(F3_JEWISH_ORIGIN.length)
    assert.equal(loc, buildCanonicalUrl(jewishCanonical, pathName))
    assert.equal(loc.startsWith(F3_JEWISH_ORIGIN), true)
    assert.doesNotMatch(loc, /www\.3djewish/)
    assert.doesNotMatch(loc, /^http:\/\//)
    assert.doesNotMatch(loc, /[?&]/)
    assert.doesNotMatch(loc, /\/(admin|auth|login|preview)\b/)
  }

  const rpcErrorSitemap = await requestWithHost(port, F3_RPC_ERROR_HOST, "/sitemap.xml")
  assertApprovedSitemapHeaders(rpcErrorSitemap)
  assert.deepEqual(locList(rpcErrorSitemap.body), [
    `https://${F3_RPC_ERROR_HOST}/`,
    `https://${F3_RPC_ERROR_HOST}/catalogo`,
    `https://${F3_RPC_ERROR_HOST}/sobre`,
    `https://${F3_RPC_ERROR_HOST}/contato`,
  ])
  assert.doesNotMatch(rpcErrorSitemap.body, /<loc>[^<]*\/p\//)
  assert.doesNotMatch(rpcErrorSitemap.body, /f3_catalog_rpc/)

  const f1Sitemap = await requestWithHost(port, TENANT_ALPHA.host, "/sitemap.xml")
  assert.equal(f1Sitemap.status, 200)
  assert.deepEqual(locList(f1Sitemap.body), [`https://${TENANT_ALPHA.host}/`])
  assert.doesNotMatch(f1Sitemap.body, /\/catalogo|\/p\//)

  const justSitemap = await requestWithHost(port, JUST_HOST, "/sitemap.xml")
  assert.equal(justSitemap.status, 200)
  assert.deepEqual(locList(justSitemap.body), [
    `https://${JUST_HOST}/`,
    `https://${JUST_HOST}/privacidade`,
    `https://${JUST_HOST}/termos`,
    `https://${JUST_HOST}/seguranca`,
  ])
  assert.doesNotMatch(justSitemap.body, /\/catalogo|\/p\//)

  const [seqJewish, seqPeer] = [
    await requestWithHost(port, F3_JEWISH_HOST, "/sitemap.xml"),
    await requestWithHost(port, F3_PEER_HOST, "/sitemap.xml"),
  ]
  const [concJewish, concPeer] = await Promise.all([
    requestWithHost(port, F3_JEWISH_HOST, "/sitemap.xml"),
    requestWithHost(port, F3_PEER_HOST, "/sitemap.xml"),
  ])
  assert.deepEqual(locList(seqJewish.body), locList(concJewish.body))
  assert.deepEqual(locList(seqPeer.body), locList(concPeer.body))
  assert.equal(locList(seqPeer.body).includes(`https://${F3_PEER_HOST}/p/peer-only-product`), true)
  assert.equal(locList(seqPeer.body).some((loc) => loc.includes("3djewish")), false)
  assert.equal(locList(seqJewish.body).some((loc) => loc.includes("f3-peer")), false)

  const admin = await requestWithHost(port, F3_JEWISH_HOST, "/admin")
  assert.equal(admin.status, 404)
  assert.match(admin.body, /noindex/)
  assert.doesNotMatch(admin.body, /hub\.justwebsites/)

  const robots = await requestWithHost(port, F3_JEWISH_HOST, "/robots.txt")
  assert.equal(robots.status, 200)
  assert.match(robots.body, /Allow: \//)
  assert.doesNotMatch(robots.body, /Disallow: \//)
  assert.doesNotMatch(robots.body, /Disallow: \/admin/)
  assert.match(robots.body, new RegExp(`Sitemap: ${F3_JEWISH_ORIGIN}/sitemap.xml`))

  const wwwSitemap = await requestWithHost(port, JEWISH_WWW, "/sitemap.xml")
  assert.equal(wwwSitemap.status, 301)
  assert.equal(wwwSitemap.headers.location, `${F3_JEWISH_ORIGIN}/sitemap.xml`)

  const httpHome = await requestWithHost(port, F3_JEWISH_HOST, "/", {
    "cf-visitor": '{"scheme":"http"}',
  })
  assert.equal(httpHome.status, 301)
  assert.equal(httpHome.headers.location, `${F3_JEWISH_ORIGIN}/`)

  const httpWwwHome = await requestWithHost(port, JEWISH_WWW, "/", {
    "cf-visitor": '{"scheme":"http"}',
  })
  assert.equal(httpWwwHome.status, 301)
  assert.equal(httpWwwHome.headers.location, `${F3_JEWISH_ORIGIN}/`)
})

test("workerd F3 sitemap is empty when publication is missing, invalid, revoked, or mismatched", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const extraHostFixtures = {
    [F3_MISSING_PUB_HOST]: f3Payload({
      host: F3_MISSING_PUB_HOST,
      tenantId: "00000000-0000-4000-8000-f3miss000001",
      companyName: "F3 Missing Pub",
      pub: null,
    }),
    [F3_REVOKED_PUB_HOST]: f3Payload({
      host: F3_REVOKED_PUB_HOST,
      tenantId: "00000000-0000-4000-8000-f3revk000001",
      companyName: "F3 Revoked Pub",
      pub: publication(F3_REVOKED_PUB_HOST, { indexingEnabled: false }),
    }),
    [F3_INVALID_PUB_HOST]: f3Payload({
      host: F3_INVALID_PUB_HOST,
      tenantId: "00000000-0000-4000-8000-f3inv0000001",
      companyName: "F3 Invalid Pub",
      pub: { contractVersion: "v0", present: true, indexingEnabled: true },
    }),
    [F3_MISMATCH_PUB_HOST]: f3Payload({
      host: F3_MISMATCH_PUB_HOST,
      tenantId: "00000000-0000-4000-8000-f3mm00000001",
      companyName: "F3 Mismatch Pub",
      pub: publication("other-canonical.example.test"),
    }),
  }

  const mock = startCanonicalPayloadMock(extraHostFixtures, {}, {
    rpcProductsByHost: {
      [F3_MISSING_PUB_HOST]: productRows("00000000-0000-4000-8000-f3miss000001", [
        "/p/should-not-appear",
      ]),
      [F3_REVOKED_PUB_HOST]: productRows("00000000-0000-4000-8000-f3revk000001", [
        "/p/should-not-appear",
      ]),
      [F3_INVALID_PUB_HOST]: productRows("00000000-0000-4000-8000-f3inv0000001", [
        "/p/should-not-appear",
      ]),
      [F3_MISMATCH_PUB_HOST]: productRows("00000000-0000-4000-8000-f3mm00000001", [
        "/p/should-not-appear",
      ]),
    },
  })
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

  const blocked = [
    F3_MISSING_PUB_HOST,
    F3_REVOKED_PUB_HOST,
    F3_INVALID_PUB_HOST,
    F3_MISMATCH_PUB_HOST,
  ]
  for (const host of blocked) {
    const sitemap = await requestWithHost(port, host, "/sitemap.xml")
    assertNoindexSitemapHeaders(sitemap)
    assert.match(
      sitemap.body,
      /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><\/urlset>/,
    )
    assert.doesNotMatch(sitemap.body, /<loc>/)
    assert.doesNotMatch(sitemap.body, /should-not-appear/)
  }

  const rpcHosts = mock.calls.filter((call) => call.mode === "rpc").map((call) => call.host)
  for (const host of blocked) {
    assert.equal(rpcHosts.includes(host), false, `unapproved ${host} must not reach catalog RPC`)
  }
})

test("workerd preview sitemap stays empty noindex even for an approved F3 tenant", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const extraHostFixtures = {
    [F3_JEWISH_HOST]: f3Payload({
      host: F3_JEWISH_HOST,
      tenantId: F3_JEWISH_TENANT_ID,
      companyName: "3D Jewish",
    }),
  }
  const mock = startCanonicalPayloadMock(extraHostFixtures, {}, {
    rpcProductsByHost: {
      [F3_JEWISH_HOST]: productRows(F3_JEWISH_TENANT_ID, F3_JEWISH_GSC_PRODUCT_PATHS),
    },
  })
  const { baseUrl: mockUrl } = await mock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "preview",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER,
    SEO001_ENFORCE_PUBLICATION_INDEXING: "true",
  })

  t.after(async () => {
    await wrangler.stop()
    await mock.close()
  })

  await wrangler.ready()

  const sitemap = await requestWithHost(port, F3_JEWISH_HOST, "/sitemap.xml")
  assertNoindexSitemapHeaders(sitemap)
  assert.match(
    sitemap.body,
    /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><\/urlset>/,
  )
  assert.doesNotMatch(sitemap.body, /<loc>/)

  const robots = await requestWithHost(port, F3_JEWISH_HOST, "/robots.txt")
  assert.match(robots.body, /Disallow: \//)
  assert.doesNotMatch(robots.body, /Sitemap:/)
})
