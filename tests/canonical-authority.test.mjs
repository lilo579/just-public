import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  asPublicCanonicalContract,
  buildCanonicalUrl,
  requirePublicCanonical,
  toAbsoluteCanonicalUrl,
  CanonicalAuthorityError,
  fetchPublicCanonicalFromRpc,
} from "../src/lib/canonicalAuthority.js"
import { buildPublicHomepageSeo } from "../src/lib/publicPageSeo.js"
import { buildJustComingSoonJsonLd } from "../src/lib/justInstitutionalSeo.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const wwwPrimary = Object.freeze({
  host: "www.example.com.br",
  origin: "https://www.example.com.br",
  requestHost: "example.com.br",
  isPrimaryRequest: false,
})

const apexPrimary = Object.freeze({
  host: "example.com.br",
  origin: "https://example.com.br",
  requestHost: "www.example.com.br",
  isPrimaryRequest: false,
})

test("asPublicCanonicalContract rejects incomplete shapes", () => {
  assert.equal(asPublicCanonicalContract(null), null)
  assert.equal(asPublicCanonicalContract({ host: "a.com" }), null)
  assert.equal(
    asPublicCanonicalContract({
      host: "a.com",
      origin: "http://a.com",
      requestHost: "a.com",
      isPrimaryRequest: true,
    }),
    null,
  )
})

test("request apex with www primary → HTML SEO uses www", () => {
  const seo = buildPublicHomepageSeo({
    host: "example.com.br",
    canonical: wwwPrimary,
    pathname: "/",
    companyName: "Example",
    noindex: false,
  })
  assert.equal(seo.canonicalUrl, "https://www.example.com.br/")
  assert.equal(seo.jsonLd.url, "https://www.example.com.br/")
})

test("request www with apex primary → HTML SEO uses apex", () => {
  const seo = buildPublicHomepageSeo({
    host: "www.example.com.br",
    canonical: apexPrimary,
    pathname: "/",
    companyName: "Example",
    branding: {},
    seo: { ogImage: "/branding/x/og-image.jpg" },
    noindex: false,
  })
  assert.equal(seo.canonicalUrl, "https://example.com.br/")
  assert.equal(seo.ogImage, "https://example.com.br/branding/x/og-image.jpg")
  assert.equal(seo.jsonLd.url, "https://example.com.br/")
})

test("alias host shares the same primary origin", () => {
  const seo = buildPublicHomepageSeo({
    host: "shop.example.com.br",
    canonical: {
      host: "example.com.br",
      origin: "https://example.com.br",
      requestHost: "shop.example.com.br",
      isPrimaryRequest: false,
    },
    pathname: "/sobre",
    companyName: "Example",
    noindex: false,
  })
  assert.equal(seo.canonicalUrl, "https://example.com.br/sobre")
})

test("UTM and query never appear on canonical URL", () => {
  assert.equal(
    buildCanonicalUrl(apexPrimary, "/contato?utm_source=gsc&host=x"),
    "https://example.com.br/contato",
  )
})

test("homepage ends with slash; internals do not", () => {
  assert.equal(buildCanonicalUrl(apexPrimary, "/"), "https://example.com.br/")
  assert.equal(buildCanonicalUrl(apexPrimary, "/catalogo/"), "https://example.com.br/catalogo")
})

test("relative image absolutized on canonical origin", () => {
  assert.equal(
    toAbsoluteCanonicalUrl("https://www.example.com.br", "/branding/x/og.jpg"),
    "https://www.example.com.br/branding/x/og.jpg",
  )
})

test("preview/noindex may omit canonical without inventing request-host", () => {
  assert.equal(
    requirePublicCanonical(null, { deployEnv: "preview", noindex: false }),
    null,
  )
  assert.equal(requirePublicCanonical(null, { noindex: true }), null)
  const seo = buildPublicHomepageSeo({
    host: "preview.example.com",
    companyName: "Preview",
    noindex: true,
  })
  assert.equal(seo.canonicalUrl, "")
  assert.equal(seo.robots, "noindex, nofollow")
})

test("public without canonical fails closed", () => {
  assert.throws(
    () => requirePublicCanonical(null, { deployEnv: "production", noindex: false }),
    (err) => err instanceof CanonicalAuthorityError && err.code === "missing_primary_domain",
  )
  assert.throws(
    () =>
      buildPublicHomepageSeo({
        host: "example.com.br",
        companyName: "X",
        noindex: false,
      }),
    /canonical authority required/,
  )
})

test("JUST Coming Soon JSON-LD uses provided origin not hardcoded www", () => {
  const graph = buildJustComingSoonJsonLd({
    origin: "https://www.justwebsites.com.br",
  })
  assert.equal(graph["@graph"][0].url, "https://www.justwebsites.com.br/")
  assert.throws(() => buildJustComingSoonJsonLd({}), /requires canonical origin/)
})

test("no request-host self-canonical when primary differs", () => {
  const seo = buildPublicHomepageSeo({
    host: "marceloborer.com.br",
    canonical: {
      host: "www.marceloborer.com.br",
      origin: "https://www.marceloborer.com.br",
      requestHost: "marceloborer.com.br",
      isPrimaryRequest: false,
    },
    companyName: "Marcelo Borer",
    noindex: false,
  })
  assert.equal(seo.canonicalUrl, "https://www.marceloborer.com.br/")
  assert.notEqual(seo.canonicalUrl, "https://marceloborer.com.br/")
})

test("fetchPublicCanonicalFromRpc maps primary_host without www surgery", async () => {
  const calls = []
  const supabase = {
    rpc: async (fn, args) => {
      calls.push({ fn, args })
      return {
        data: [
          {
            tenant_id: "t1",
            primary_host: "www.example.com.br",
            request_host: "example.com.br",
            is_primary_request: false,
            has_primary: true,
          },
        ],
        error: null,
      }
    },
  }
  const contract = await fetchPublicCanonicalFromRpc(supabase, "example.com.br")
  assert.deepEqual(calls[0], {
    fn: "public_host_canonical_authority",
    args: { p_host: "example.com.br" },
  })
  assert.deepEqual(contract, {
    host: "www.example.com.br",
    origin: "https://www.example.com.br",
    requestHost: "example.com.br",
    isPrimaryRequest: false,
  })
})

test("404 page is noindex and never emits a competitive canonical", () => {
  const src = readFileSync(join(root, "src/pages/404.astro"), "utf8")
  assert.match(src, /robots=["']noindex,\s*follow["']/)
  assert.match(src, /canonicalUrl=\{undefined\}/)
  assert.equal(/https:\/\/\$\{host\}/.test(src), false)
  assert.equal(/canonicalUrl=\{[^}]*pathname/.test(src), false)
})

test("PublicSiteHead emits at most one canonical link and matches og:url", () => {
  const src = readFileSync(join(root, "src/components/PublicSiteHead.astro"), "utf8")
  const canonicalLinks = src.match(/rel=["']canonical["']/g) || []
  assert.equal(canonicalLinks.length, 1)
  assert.match(src, /\{canonicalUrl && <link rel="canonical"/)
  assert.match(src, /\{canonicalUrl && <meta property="og:url"/)
  assert.equal(src.includes("document.createElement"), false)
})

test("renderer SEO sources have no www strip or tenant canonical map", () => {
  const files = [
    "src/lib/canonicalAuthority.js",
    "src/lib/publicPageSeo.js",
    "src/lib/justInstitutionalSeo.js",
    "src/pages/index.astro",
    "src/pages/sobre.astro",
    "src/pages/contato.astro",
    "src/pages/catalogo.astro",
    "src/pages/c.astro",
  ]
  for (const rel of files) {
    const src = readFileSync(join(root, rel), "utf8")
    assert.equal(
      /replace\(\s*\/\^www\\\./.test(src),
      false,
      `${rel} must not strip www`,
    )
    assert.equal(
      /CANONICAL_.*BY_TENANT|canonicalHostByTenant|TENANT_CANONICAL/.test(src),
      false,
      `${rel} must not hardcode tenant canonical map`,
    )
  }
})
