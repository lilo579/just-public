import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildPublicHomepageSeo,
  resolveBrandFaviconUrl,
  resolvePackagedTenantFaviconPath,
} from "../src/lib/publicPageSeo.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const CELINA = {
  slug: "celina-pires",
  apex: "celinapiresdorio.com.br",
  www: "www.celinapiresdorio.com.br",
  pack: "/branding/celina-pires/favicon.svg",
  ico: "/branding/celina-pires/favicon.ico",
  apple: "/branding/celina-pires/apple-touch-icon.png",
  ogPoison:
    "https://storage.googleapis.com/gpt-engineer-file-uploads/WYV4aPnKjoaE2QhUCYSjBzCc2vS2/social-images/social-1778702156622-og-image.webp",
}

const FLAVIO = {
  slug: "flavio-personal",
  apex: "treinecomflaviohenrique.com.br",
  www: "www.treinecomflaviohenrique.com.br",
  pack: "/branding/flavio-personal/favicon.svg",
  ico: "/branding/flavio-personal/favicon.ico",
  apple: "/branding/flavio-personal/apple-touch-icon.png",
  ogPoison:
    "https://storage.googleapis.com/gpt-engineer-file-uploads/WYV4aPnKjoaE2QhUCYSjBzCc2vS2/social-images/social-1777039481703-flavio-og-image.webp",
}

const CONTROL_PACKS = [
  ["marceloborer.com.br", "www.marceloborer.com.br", "/branding/marcelo-borer/favicon.svg"],
  ["rossanamendonca.com.br", "www.rossanamendonca.com.br", "/branding/rossana-mendonca/favicon.svg"],
  ["sorayabarbosa.com.br", "www.sorayabarbosa.com.br", "/branding/soraya-barbosa/favicon.svg"],
  ["3djewish.com.br", "www.3djewish.com.br", "/branding/3d-jewish/favicon.svg"],
  ["justwebsites.com.br", "www.justwebsites.com.br", "/branding/just/favicon.svg"],
]

function primary(host, requestHost = host) {
  return {
    host,
    origin: `https://${host}`,
    requestHost,
    isPrimaryRequest: host === requestHost,
  }
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex")
}

function packFile(slug, name) {
  return join(root, "public/branding", slug, name)
}

function pngSize(buf) {
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function icoSizes(buf) {
  assert.equal(buf.readUInt16LE(0), 0)
  assert.equal(buf.readUInt16LE(2), 1)
  const count = buf.readUInt16LE(4)
  const sizes = []
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16
    const w = buf[off] || 256
    const h = buf[off + 1] || 256
    sizes.push(`${w}x${h}`)
  }
  return { count, sizes }
}

test("Celina and Flavio packs exist with square canvas, MIME, and distinct hashes", () => {
  const files = ["favicon.svg", "favicon.ico", "apple-touch-icon.png"]
  /** @type {Record<string, string>} */
  const hashes = {}
  for (const tenant of [CELINA, FLAVIO]) {
    for (const name of files) {
      const buf = readFileSync(packFile(tenant.slug, name))
      hashes[`${tenant.slug}/${name}`] = sha256(buf)
      if (name.endsWith(".svg")) {
        const text = buf.toString("utf8")
        assert.match(text, /viewBox="0 0 512 512"/)
        assert.match(text, /href="data:image\/png;base64,/)
        assert.doesNotMatch(text, /https:\/\//)
        assert.doesNotMatch(text, /lovable|gpt-engineer|googleapis|storage\.googleapis/i)
        assert.doesNotMatch(text, /xlink:href/)
      }
      if (name.endsWith(".png")) {
        const { width, height } = pngSize(buf)
        assert.equal(width, 180)
        assert.equal(height, 180)
      }
      if (name.endsWith(".ico")) {
        const { count, sizes } = icoSizes(buf)
        assert.equal(count, 3)
        assert.deepEqual(new Set(sizes), new Set(["16x16", "32x32", "48x48"]))
      }
    }
  }
  for (const name of files) {
    assert.notEqual(
      hashes[`celina-pires/${name}`],
      hashes[`flavio-personal/${name}`],
      `${name} hashes must differ across tenants`,
    )
  }

  const flavioSvg = readFileSync(packFile("flavio-personal", "favicon.svg"), "utf8")
  const png = Buffer.from(flavioSvg.match(/base64,([A-Za-z0-9+/=]+)/)[1], "base64")
  assert.equal(pngSize(png).width, 512)
  assert.equal(pngSize(png).height, 512)
})

test("Celina/Flavio host map isolates packs; apex equals www; controls unchanged", () => {
  for (const tenant of [CELINA, FLAVIO]) {
    assert.equal(resolvePackagedTenantFaviconPath(tenant.apex), tenant.pack)
    assert.equal(resolvePackagedTenantFaviconPath(tenant.www), tenant.pack)
    assert.equal(resolvePackagedTenantFaviconPath(tenant.apex, { preferIco: true }), tenant.ico)
    assert.equal(resolvePackagedTenantFaviconPath(tenant.www, { preferIco: true }), tenant.ico)
  }
  assert.notEqual(CELINA.pack, FLAVIO.pack)
  assert.notEqual(resolvePackagedTenantFaviconPath(CELINA.apex), resolvePackagedTenantFaviconPath(FLAVIO.apex))
  assert.equal(resolvePackagedTenantFaviconPath(CELINA.apex), resolvePackagedTenantFaviconPath(CELINA.www))
  assert.equal(resolvePackagedTenantFaviconPath(FLAVIO.apex), resolvePackagedTenantFaviconPath(FLAVIO.www))

  for (const [apex, www, path] of CONTROL_PACKS) {
    assert.equal(resolvePackagedTenantFaviconPath(apex), path, apex)
    assert.equal(resolvePackagedTenantFaviconPath(www), path, www)
  }
})

test("packaged Celina/Flavio win over OG/GCS/Lovable; explicit Hub favicon still wins", () => {
  for (const tenant of [CELINA, FLAVIO]) {
    const seo = buildPublicHomepageSeo({
      host: tenant.apex,
      canonical: primary(tenant.apex),
      companyName: tenant.slug,
      branding: {
        logoUrl: tenant.ogPoison,
        logoHorizontalUrl: tenant.ogPoison,
      },
      seo: { ogImage: tenant.ogPoison },
    })
    assert.equal(seo.faviconUrl, tenant.pack)
    assert.equal(seo.ogImage, tenant.ogPoison)
    assert.equal(seo.canonicalUrl, `https://${tenant.apex}/`)
    assert.equal(seo.robots, "index, follow")
    assert.doesNotMatch(seo.faviconUrl, /og-image|gpt-engineer|lovable|googleapis/i)

    const wwwSeo = buildPublicHomepageSeo({
      host: tenant.www,
      canonical: primary(tenant.apex, tenant.www),
      companyName: tenant.slug,
      seo: { ogImage: tenant.ogPoison },
    })
    assert.equal(wwwSeo.faviconUrl, tenant.pack)
    assert.equal(wwwSeo.canonicalUrl, `https://${tenant.apex}/`)

    const explicit = resolveBrandFaviconUrl({
      host: tenant.apex,
      favicon: "https://cdn.example/explicit-favicon.ico",
      ogImage: tenant.ogPoison,
    })
    assert.equal(explicit, "https://cdn.example/explicit-favicon.ico")
  }
})

test("Celina and Flavio never resolve to each other's pack", () => {
  for (const host of [CELINA.apex, CELINA.www]) {
    assert.equal(resolvePackagedTenantFaviconPath(host), CELINA.pack)
    assert.notEqual(resolvePackagedTenantFaviconPath(host), FLAVIO.pack)
  }
  for (const host of [FLAVIO.apex, FLAVIO.www]) {
    assert.equal(resolvePackagedTenantFaviconPath(host), FLAVIO.pack)
    assert.notEqual(resolvePackagedTenantFaviconPath(host), CELINA.pack)
  }
})

test("apple-touch policy lists Celina and Flavio packs", () => {
  const src = readFileSync(join(root, "src/components/PublicSiteHead.astro"), "utf8")
  assert.match(src, /"celina-pires"/)
  assert.match(src, /"flavio-personal"/)
  assert.match(src, /PACKS_WITH_APPLE_TOUCH/)
})
