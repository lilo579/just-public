import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import {
  FIXTURE_CELINA,
  FIXTURE_FLAVIO,
  TENANT_CELINA,
  TENANT_FLAVIO,
} from "./fixtures/cinematic-editorial-payloads.mjs"
import { FIXTURE_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import { requestWithHost, root, startWrangler } from "./helpers/workerd-poc.mjs"

const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-tenant-favicon-celina-flavio"

const CELINA_HOST = "celinapiresdorio.com.br"
const CELINA_WWW = "www.celinapiresdorio.com.br"
const FLAVIO_HOST = "treinecomflaviohenrique.com.br"
const FLAVIO_WWW = "www.treinecomflaviohenrique.com.br"
const MARCELO_HOST = "marceloborer.com.br"

const CELINA_OG =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/WYV4aPnKjoaE2QhUCYSjBzCc2vS2/social-images/social-1778702156622-og-image.webp"
const FLAVIO_OG =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/WYV4aPnKjoaE2QhUCYSjBzCc2vS2/social-images/social-1777039481703-flavio-og-image.webp"
const MARCELO_OG = "https://cdn.example.test/marcelo-og.webp"

const FAVICON_FORBIDDEN = /gpt-engineer|lovable|storage\.googleapis|social-images|og-image\.webp/i

function withHost(payload, requestHost, primaryHost) {
  const next = structuredClone(payload)
  next.host = requestHost
  next.canonical = {
    host: primaryHost,
    origin: `https://${primaryHost}`,
    requestHost,
    isPrimaryRequest: requestHost === primaryHost,
  }
  return next
}

function tenantPayload(base, { host, tenantId, companyName, email, ogImage }) {
  const payload = withHost(structuredClone(base), host, host)
  payload.tenantId = tenantId
  payload.footer = {
    ...payload.footer,
    companyName,
    email,
  }
  payload.source = {
    ...payload.source,
    contact: {
      ...payload.source.contact,
      companyName,
      email,
    },
    meta: {
      ...payload.source.meta,
      seo: {
        ...(payload.source.meta?.seo ?? {}),
        ogImage,
      },
      branding: {
        ...(payload.source.meta?.branding ?? {}),
        logoUrl: ogImage,
        logoHorizontalUrl: ogImage,
      },
    },
  }
  if (payload.source.meta.seo) delete payload.source.meta.seo.favicon
  return payload
}

function iconHref(html) {
  return html.match(/<link rel="icon" href="([^"]+)"/i)?.[1] ?? ""
}

function appleHref(html) {
  return html.match(/<link rel="apple-touch-icon" href="([^"]+)"/i)?.[1] ?? ""
}

function canonicalHref(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] ?? ""
}

function ogImage(html) {
  return html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ?? ""
}

function assertNoForbiddenFavicon(html, label) {
  const icon = iconHref(html)
  assert.ok(icon, `${label} missing rel=icon`)
  assert.doesNotMatch(icon, FAVICON_FORBIDDEN, `${label} icon uses OG/GCS/Lovable`)
  assert.doesNotMatch(icon, /celina-pires\/og-image|flavio-personal\/og-image/)
}

test("workerd: Celina/Flavio favicon packs isolate; controls and discovery stay put", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const celinaPayload = tenantPayload(FIXTURE_CELINA, {
    host: CELINA_HOST,
    tenantId: TENANT_CELINA.tenantId,
    companyName: "Celina Pires do Rio Oliveira",
    email: "celina-favicon@example.test",
    ogImage: CELINA_OG,
  })
  const flavioPayload = tenantPayload(FIXTURE_FLAVIO, {
    host: FLAVIO_HOST,
    tenantId: TENANT_FLAVIO.tenantId,
    companyName: TENANT_FLAVIO.companyName,
    email: "flavio-favicon@example.test",
    ogImage: FLAVIO_OG,
  })
  const marceloPayload = tenantPayload(FIXTURE_ALPHA, {
    host: MARCELO_HOST,
    tenantId: "00000000-0000-4000-8000-00000000b0e1",
    companyName: "Marcelo Borer",
    email: "marcelo-favicon@example.test",
    ogImage: MARCELO_OG,
  })

  const extraHostFixtures = {
    [CELINA_HOST]: celinaPayload,
    [CELINA_WWW]: withHost(celinaPayload, CELINA_WWW, CELINA_HOST),
    [FLAVIO_HOST]: flavioPayload,
    [FLAVIO_WWW]: withHost(flavioPayload, FLAVIO_WWW, FLAVIO_HOST),
    [MARCELO_HOST]: marceloPayload,
  }
  const extraTenantByHost = {
    [CELINA_HOST]: { key: "celina", tenantId: TENANT_CELINA.tenantId },
    [CELINA_WWW]: { key: "celina", tenantId: TENANT_CELINA.tenantId },
    [FLAVIO_HOST]: { key: "flavio", tenantId: TENANT_FLAVIO.tenantId },
    [FLAVIO_WWW]: { key: "flavio", tenantId: TENANT_FLAVIO.tenantId },
    [MARCELO_HOST]: { key: "marcelo", tenantId: marceloPayload.tenantId },
  }

  const mock = startCanonicalPayloadMock(extraHostFixtures, extraTenantByHost)
  const { baseUrl: mockUrl } = await mock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "production",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER,
  })

  t.after(async () => {
    await wrangler.stop()
    await mock.close()
  })

  await wrangler.ready()

  async function html(host) {
    return requestWithHost(port, host, "/")
  }
  async function faviconIco(host) {
    return requestWithHost(port, host, "/favicon.ico")
  }

  function assertCelinaHtml(res, label) {
    assert.equal(res.status, 200, label)
    assert.equal(iconHref(res.body), "/branding/celina-pires/favicon.svg", label)
    assert.equal(appleHref(res.body), "/branding/celina-pires/apple-touch-icon.png", label)
    assert.equal(canonicalHref(res.body), `https://${CELINA_HOST}/`, label)
    assert.equal(ogImage(res.body), CELINA_OG, `${label} OG must stay Hub/GCS`)
    assertNoForbiddenFavicon(res.body, label)
    assert.doesNotMatch(res.body, /\/branding\/flavio-personal\//)
    assert.doesNotMatch(res.body, /\/branding\/marcelo-borer\//)
    assert.doesNotMatch(res.body, /\/branding\/just\//)
    assert.match(res.body, /rel="icon"/)
    assert.match(res.body, /type="image\/svg\+xml"/)
  }

  function assertFlavioHtml(res, label) {
    assert.equal(res.status, 200, label)
    assert.equal(iconHref(res.body), "/branding/flavio-personal/favicon.svg", label)
    assert.equal(appleHref(res.body), "/branding/flavio-personal/apple-touch-icon.png", label)
    assert.equal(canonicalHref(res.body), `https://${FLAVIO_HOST}/`, label)
    assert.equal(ogImage(res.body), FLAVIO_OG, `${label} OG must stay Hub/GCS`)
    assertNoForbiddenFavicon(res.body, label)
    assert.doesNotMatch(res.body, /\/branding\/celina-pires\//)
    assert.doesNotMatch(res.body, /\/branding\/marcelo-borer\//)
    assert.doesNotMatch(res.body, /\/branding\/just\//)
  }

  function assertIcoRedirect(res, packPath, label) {
    assert.equal(res.status, 302, label)
    const location = String(res.headers.location || "")
    assert.match(location, new RegExp(`${packPath.replaceAll("/", "\\/")}$`), label)
    assert.doesNotMatch(location, FAVICON_FORBIDDEN, label)
    assert.notEqual(res.status, 301, `${label} favicon must not follow host canonical 301`)
  }

  const orders = [
    [CELINA_HOST, FLAVIO_HOST, CELINA_HOST],
    [FLAVIO_HOST, CELINA_HOST, FLAVIO_HOST],
  ]
  for (const order of orders) {
    for (const host of order) {
      const res = await html(host)
      if (host === CELINA_HOST) assertCelinaHtml(res, `seq ${order.join("→")} ${host}`)
      else assertFlavioHtml(res, `seq ${order.join("→")} ${host}`)
    }
  }

  const concurrent = await Promise.all(
    [CELINA_HOST, FLAVIO_HOST, MARCELO_HOST, CELINA_HOST, FLAVIO_HOST].map(async (host) => ({
      host,
      res: await html(host),
    })),
  )
  for (const row of concurrent) {
    if (row.host === CELINA_HOST) assertCelinaHtml(row.res, `concurrent ${row.host}`)
    else if (row.host === FLAVIO_HOST) assertFlavioHtml(row.res, `concurrent ${row.host}`)
    else {
      assert.equal(row.res.status, 200)
      assert.equal(iconHref(row.res.body), "/branding/marcelo-borer/favicon.svg")
      assert.doesNotMatch(row.res.body, /\/branding\/celina-pires\//)
      assert.doesNotMatch(row.res.body, /\/branding\/flavio-personal\//)
    }
  }

  const celinaApex = await html(CELINA_HOST)
  const flavioApex = await html(FLAVIO_HOST)
  assertCelinaHtml(celinaApex, "celina apex")
  assertFlavioHtml(flavioApex, "flavio apex")

  const celinaWww = await html(CELINA_WWW)
  const flavioWww = await html(FLAVIO_WWW)
  assert.equal(celinaWww.status, 301)
  assert.equal(celinaWww.headers.location, `https://${CELINA_HOST}/`)
  assert.equal(flavioWww.status, 301)
  assert.equal(flavioWww.headers.location, `https://${FLAVIO_HOST}/`)

  const celinaIco = await faviconIco(CELINA_HOST)
  const celinaIcoWww = await faviconIco(CELINA_WWW)
  const flavioIco = await faviconIco(FLAVIO_HOST)
  const flavioIcoWww = await faviconIco(FLAVIO_WWW)
  const marceloIco = await faviconIco(MARCELO_HOST)
  assertIcoRedirect(celinaIco, "/branding/celina-pires/favicon.ico", "celina ico")
  assertIcoRedirect(celinaIcoWww, "/branding/celina-pires/favicon.ico", "celina www ico")
  assertIcoRedirect(flavioIco, "/branding/flavio-personal/favicon.ico", "flavio ico")
  assertIcoRedirect(flavioIcoWww, "/branding/flavio-personal/favicon.ico", "flavio www ico")
  assertIcoRedirect(marceloIco, "/branding/marcelo-borer/favicon.ico", "marcelo ico")

  const celinaSvg = await requestWithHost(port, CELINA_HOST, "/branding/celina-pires/favicon.svg")
  const flavioSvg = await requestWithHost(port, FLAVIO_HOST, "/branding/flavio-personal/favicon.svg")
  const celinaApple = await requestWithHost(port, CELINA_HOST, "/branding/celina-pires/apple-touch-icon.png")
  const flavioApple = await requestWithHost(port, FLAVIO_HOST, "/branding/flavio-personal/apple-touch-icon.png")
  assert.equal(celinaSvg.status, 200)
  assert.match(String(celinaSvg.headers["content-type"] || ""), /image\/svg\+xml/)
  assert.equal(flavioSvg.status, 200)
  assert.match(String(flavioSvg.headers["content-type"] || ""), /image\/svg\+xml/)
  assert.notEqual(celinaSvg.body, flavioSvg.body)
  assert.equal(celinaApple.status, 200)
  assert.match(String(celinaApple.headers["content-type"] || ""), /image\/png/)
  assert.equal(flavioApple.status, 200)
  assert.match(String(flavioApple.headers["content-type"] || ""), /image\/png/)

  const celinaRobots = await requestWithHost(port, CELINA_HOST, "/robots.txt")
  const flavioRobots = await requestWithHost(port, FLAVIO_HOST, "/robots.txt")
  const celinaSitemap = await requestWithHost(port, CELINA_HOST, "/sitemap.xml")
  const flavioSitemap = await requestWithHost(port, FLAVIO_HOST, "/sitemap.xml")
  assert.equal(celinaRobots.status, 200)
  assert.equal(flavioRobots.status, 200)
  assert.match(celinaRobots.body, new RegExp(`Sitemap: https://${CELINA_HOST}/sitemap.xml`))
  assert.match(flavioRobots.body, new RegExp(`Sitemap: https://${FLAVIO_HOST}/sitemap.xml`))
  assert.doesNotMatch(celinaRobots.body, new RegExp(FLAVIO_HOST))
  assert.doesNotMatch(flavioRobots.body, new RegExp(CELINA_HOST))
  assert.equal(celinaSitemap.status, 200)
  assert.equal(flavioSitemap.status, 200)
  assert.match(celinaSitemap.body, new RegExp(`https://${CELINA_HOST}/`))
  assert.match(flavioSitemap.body, new RegExp(`https://${FLAVIO_HOST}/`))
  assert.doesNotMatch(celinaSitemap.body, new RegExp(FLAVIO_HOST))
  assert.doesNotMatch(flavioSitemap.body, new RegExp(CELINA_HOST))
})
