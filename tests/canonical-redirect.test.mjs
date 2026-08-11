import test from "node:test"
import assert from "node:assert/strict"
import {
  classifyPublicRoute,
  routeAllowsCanonicalRedirect,
} from "../src/lib/publicRouteKind.js"
import {
  CANONICAL_REDIRECT_CACHE_CONTROL,
  filterPublicRedirectQuery,
  INTERNAL_REDIRECT_QUERY_PARAMS,
  normalizePublicSeoPath,
  planCanonicalRedirect,
  PUBLIC_TRACKING_QUERY_PARAMS,
  resolvePublicRequestProtocol,
} from "../src/lib/canonicalRedirect.js"

function primary(host, requestHost = host) {
  return {
    host,
    origin: `https://${host}`,
    requestHost,
    isPrimaryRequest: host === requestHost,
  }
}

test("classifyPublicRoute: public pages vs assets vs ops vs preview", () => {
  assert.equal(classifyPublicRoute("/"), "public_page")
  assert.equal(classifyPublicRoute("/sobre"), "public_page")
  assert.equal(classifyPublicRoute("/robots.txt"), "public_page")
  assert.equal(classifyPublicRoute("/sitemap.xml"), "public_page")
  assert.equal(classifyPublicRoute("/_astro/x.css"), "asset")
  assert.equal(classifyPublicRoute("/fonts/just/Inter.woff2"), "asset")
  assert.equal(classifyPublicRoute("/branding/just/favicon.svg"), "asset")
  assert.equal(classifyPublicRoute("/favicon.ico"), "asset")
  assert.equal(classifyPublicRoute("/health"), "operational")
  assert.equal(classifyPublicRoute("/api/leads"), "operational")
  assert.equal(classifyPublicRoute("/preview"), "preview")
  assert.equal(routeAllowsCanonicalRedirect("public_page"), true)
  assert.equal(routeAllowsCanonicalRedirect("asset"), false)
  assert.equal(routeAllowsCanonicalRedirect("operational"), false)
  assert.equal(routeAllowsCanonicalRedirect("preview"), false)
})

test("host: primary match does not redirect", () => {
  const plan = planCanonicalRedirect({
    method: "GET",
    pathname: "/",
    searchParams: new URLSearchParams(),
    requestHost: "example.com.br",
    canonical: primary("example.com.br"),
    deployEnv: "production",
  })
  assert.equal(plan, null)
})

test("protocol: HTTP primary redirects directly to HTTPS primary", () => {
  const plan = planCanonicalRedirect({
    method: "GET",
    pathname: "/sobre",
    searchParams: new URLSearchParams(),
    requestHost: "example.com.br",
    requestProtocol: "http:",
    canonical: primary("example.com.br"),
    deployEnv: "production",
  })
  assert.equal(plan?.location, "https://example.com.br/sobre")
  assert.ok(plan?.reasons.includes("http"))
})

test("protocol + alias + path normalize in one redirect", () => {
  const plan = planCanonicalRedirect({
    method: "GET",
    pathname: "/homepage/",
    searchParams: new URLSearchParams(),
    requestHost: "www.example.com.br",
    requestProtocol: "http:",
    canonical: primary("example.com.br", "www.example.com.br"),
    deployEnv: "production",
  })
  assert.equal(plan?.location, "https://example.com.br/")
  assert.deepEqual(plan?.reasons, ["homepage", "alias", "http"])
})

test("protocol: trusts CF-Visitor and defaults local fixtures to HTTPS", () => {
  assert.equal(
    resolvePublicRequestProtocol(
      new Request("http://example.com.br", {
        headers: { "cf-visitor": '{"scheme":"http"}' },
      }),
    ),
    "http:",
  )
  assert.equal(
    resolvePublicRequestProtocol(new Request("http://example.com.br")),
    "https:",
  )
})

test("host: www request with apex primary → 301 apex", () => {
  const plan = planCanonicalRedirect({
    method: "GET",
    pathname: "/sobre",
    searchParams: new URLSearchParams("utm_source=gsc"),
    requestHost: "www.example.com.br",
    canonical: primary("example.com.br", "www.example.com.br"),
    deployEnv: "production",
  })
  assert.equal(plan?.status, 301)
  assert.equal(plan?.location, "https://example.com.br/sobre?utm_source=gsc")
  assert.ok(plan?.reasons.includes("alias"))
})

test("host: apex request with www primary → 301 www", () => {
  const plan = planCanonicalRedirect({
    method: "GET",
    pathname: "/contato",
    searchParams: new URLSearchParams(),
    requestHost: "example.com.br",
    canonical: primary("www.example.com.br", "example.com.br"),
    deployEnv: "production",
  })
  assert.equal(plan?.location, "https://www.example.com.br/contato")
})

test("host: extra alias → 301 primary", () => {
  const plan = planCanonicalRedirect({
    method: "GET",
    pathname: "/",
    searchParams: new URLSearchParams(),
    requestHost: "shop.example.com.br",
    canonical: primary("example.com.br", "shop.example.com.br"),
    deployEnv: "production",
  })
  assert.equal(plan?.location, "https://example.com.br/")
})

test("without canonical → no redirect (no request-host fallback)", () => {
  assert.equal(
    planCanonicalRedirect({
      method: "GET",
      pathname: "/sobre/",
      searchParams: new URLSearchParams(),
      requestHost: "example.com.br",
      canonical: null,
      deployEnv: "production",
    }),
    null,
  )
})

test("preview/staging skip redirects", () => {
  assert.equal(
    planCanonicalRedirect({
      method: "GET",
      pathname: "/sobre/",
      searchParams: new URLSearchParams(),
      requestHost: "www.example.com.br",
      canonical: primary("example.com.br", "www.example.com.br"),
      deployEnv: "preview",
    }),
    null,
  )
})

test("alias + trailing slash → single hop", () => {
  const plan = planCanonicalRedirect({
    method: "GET",
    pathname: "/sobre/",
    searchParams: new URLSearchParams(),
    requestHost: "www.example.com.br",
    canonical: primary("example.com.br", "www.example.com.br"),
    deployEnv: "production",
  })
  assert.equal(plan?.location, "https://example.com.br/sobre")
  assert.ok(plan?.reasons.includes("alias"))
  assert.ok(plan?.reasons.includes("trailing_slash"))
})

test("alias + /homepage → single hop to /", () => {
  const plan = planCanonicalRedirect({
    method: "GET",
    pathname: "/homepage/",
    searchParams: new URLSearchParams("utm_campaign=x&host=evil&debug=1"),
    requestHost: "www.example.com.br",
    canonical: primary("example.com.br", "www.example.com.br"),
    deployEnv: "production",
  })
  assert.equal(plan?.location, "https://example.com.br/?utm_campaign=x")
  assert.ok(plan?.reasons.includes("homepage"))
})

test("HEAD redirects like GET; POST does not", () => {
  const head = planCanonicalRedirect({
    method: "HEAD",
    pathname: "/",
    searchParams: new URLSearchParams(),
    requestHost: "www.example.com.br",
    canonical: primary("example.com.br", "www.example.com.br"),
    deployEnv: "production",
  })
  assert.equal(head?.status, 301)
  assert.equal(
    planCanonicalRedirect({
      method: "POST",
      pathname: "/",
      searchParams: new URLSearchParams(),
      requestHost: "www.example.com.br",
      canonical: primary("example.com.br", "www.example.com.br"),
      deployEnv: "production",
    }),
    null,
  )
})

test("path normalization: homepage and trailing slash; dynamic slug case preserved", () => {
  assert.deepEqual(normalizePublicSeoPath("/homepage"), {
    pathname: "/",
    reasons: ["homepage"],
  })
  assert.deepEqual(normalizePublicSeoPath("/contato/"), {
    pathname: "/contato",
    reasons: ["trailing_slash"],
  })
  assert.deepEqual(normalizePublicSeoPath("/Sobre"), {
    pathname: "/sobre",
    reasons: ["static_case"],
  })
  assert.deepEqual(normalizePublicSeoPath("/p/MySlug"), {
    pathname: "/p/MySlug",
    reasons: [],
  })
})

test("query filter preserves tracking and strips internals", () => {
  const filtered = filterPublicRedirectQuery(
    new URLSearchParams(
      "utm_source=a&gclid=1&host=x&debug=1&renderer=legacy&fbclid=z&custom=keep",
    ),
  )
  assert.equal(filtered.get("utm_source"), "a")
  assert.equal(filtered.get("gclid"), "1")
  assert.equal(filtered.get("fbclid"), "z")
  assert.equal(filtered.get("custom"), "keep")
  assert.equal(filtered.get("host"), null)
  assert.equal(filtered.get("debug"), null)
  assert.equal(filtered.get("renderer"), null)
  assert.ok(PUBLIC_TRACKING_QUERY_PARAMS.includes("utm_source"))
  assert.ok(INTERNAL_REDIRECT_QUERY_PARAMS.includes("host"))
})

test("assets and health never plan redirects even with alias canonical", () => {
  for (const path of ["/_astro/x.css", "/health", "/favicon.ico", "/branding/just/a.png"]) {
    assert.equal(
      planCanonicalRedirect({
        method: "GET",
        pathname: path,
        searchParams: new URLSearchParams(),
        requestHost: "www.example.com.br",
        canonical: primary("example.com.br", "www.example.com.br"),
        deployEnv: "production",
        routeKind: classifyPublicRoute(path),
      }),
      null,
      path,
    )
  }
})

test("redirect cache is short and not immutable / not s-maxage", () => {
  assert.match(CANONICAL_REDIRECT_CACHE_CONTROL, /max-age=60/)
  assert.doesNotMatch(CANONICAL_REDIRECT_CACHE_CONTROL, /immutable/)
  assert.doesNotMatch(CANONICAL_REDIRECT_CACHE_CONTROL, /s-maxage/)
})
