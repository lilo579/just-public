import test from "node:test"
import assert from "node:assert/strict"

import { resolvePackagedInstitutionalSite } from "../src/lib/resolvePackagedInstitutionalSite.js"
import { buildCanonicalUrl } from "../src/lib/canonicalAuthority.js"
import {
  EMPTY_SITEMAP_XML,
  F3_CATALOG_RPC_TIMEOUT_MS,
  F3_CATALOG_STATIC_PATHS,
  buildSitemapXml,
  collectF3ProductPaths,
  collectPublicSitemapPaths,
  escapeXml,
  loadF3CatalogProductRows,
  sanitizePublicProductSlug,
} from "../src/lib/publicSitemap.js"
import {
  F3_JEWISH_GSC_PRODUCT_PATHS,
  F3_JEWISH_HOST,
  F3_JEWISH_ORIGIN,
  F3_JEWISH_PRODUCT_PATHS,
  F3_JEWISH_SITEMAP_PATHS,
  F3_JEWISH_STATIC_PATHS,
  F3_JEWISH_TENANT_ID,
} from "./fixtures/f3-jewish-catalog-paths.mjs"

const jewishCanonical = {
  host: F3_JEWISH_HOST,
  origin: F3_JEWISH_ORIGIN,
  requestHost: F3_JEWISH_HOST,
  isPrimaryRequest: true,
}

function rowsFor(tenantId, paths, extra = []) {
  return [
    ...paths.map((path, index) => ({
      tenant_id: tenantId,
      product_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      slug: path.replace(/^\/p\//, ""),
      name: path,
    })),
    ...extra,
  ]
}

function locList(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError")
}

/**
 * Supabase PostgREST builder mock: rpc() returns a thenable with abortSignal(signal).
 * @param {(signal: AbortSignal) => Promise<unknown>} handler
 */
function rpcClient(handler) {
  return {
    rpc() {
      return {
        abortSignal(signal) {
          return handler(signal)
        },
      }
    },
  }
}

function immediateRpc(payload) {
  return rpcClient(async (signal) => {
    if (signal.aborted) throw abortError()
    return payload
  })
}

/**
 * Slow RPC whose simulated work is cancelled when AbortSignal fires.
 * @param {{
 *   delayMs: number
 *   payload: unknown
 *   state: { rpcFinished?: boolean, aborted?: boolean, signal?: AbortSignal }
 * }} input
 */
function hangingRpc(input) {
  return rpcClient((signal) => {
    input.state.signal = signal
    return new Promise((resolve, reject) => {
      const work = setTimeout(() => {
        input.state.rpcFinished = true
        resolve(input.payload)
      }, input.delayMs)
      const onAbort = () => {
        clearTimeout(work)
        input.state.aborted = true
        reject(abortError())
      }
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener("abort", onAbort, { once: true })
    })
  })
}

test("sanitizePublicProductSlug fail-closes on query, path, and operator junk", () => {
  assert.equal(sanitizePublicProductSlug("bege-ouro-velho"), "bege-ouro-velho")
  assert.equal(sanitizePublicProductSlug("grande-24cm-x-24cm---cores-variadas"), "grande-24cm-x-24cm---cores-variadas")
  assert.equal(sanitizePublicProductSlug("foo?category=1"), "")
  assert.equal(sanitizePublicProductSlug("foo/bar"), "")
  assert.equal(sanitizePublicProductSlug("../x"), "")
  assert.equal(sanitizePublicProductSlug("admin"), "admin")
  assert.equal(sanitizePublicProductSlug(""), "")
  assert.equal(sanitizePublicProductSlug("has space"), "")
})

test("3D Jewish F3 sitemap is static routes plus host-scoped published products", () => {
  const paths = collectPublicSitemapPaths({
    family: "f3",
    tenantId: F3_JEWISH_TENANT_ID,
    productRows: rowsFor(F3_JEWISH_TENANT_ID, F3_JEWISH_PRODUCT_PATHS, [
      { tenant_id: F3_JEWISH_TENANT_ID, slug: "removed-product" },
      { tenant_id: "00000000-0000-4000-8000-other000001", slug: "foreign-tenant" },
      { tenant_id: F3_JEWISH_TENANT_ID, slug: "bad?query" },
      { tenant_id: F3_JEWISH_TENANT_ID, slug: "/admin" },
      { tenant_id: F3_JEWISH_TENANT_ID, slug: "" },
    ]),
  })

  const withoutInjected = paths.filter((path) => path !== "/p/removed-product")
  assert.deepEqual(withoutInjected, [...F3_JEWISH_SITEMAP_PATHS])
  assert.equal(paths.includes("/p/removed-product"), true)
  assert.equal(paths.includes("/p/foreign-tenant"), false)
  assert.equal(paths.includes("/p/bad?query"), false)
  assert.equal(paths.includes("/admin"), false)

  for (const gscPath of F3_JEWISH_GSC_PRODUCT_PATHS) {
    assert.equal(paths.includes(gscPath), true, gscPath)
  }

  const xml = buildSitemapXml(jewishCanonical, paths.filter((path) => path !== "/p/removed-product"))
  const locs = locList(xml)
  assert.deepEqual(
    locs,
    F3_JEWISH_SITEMAP_PATHS.map((path) => buildCanonicalUrl(jewishCanonical, path)),
  )
  assert.equal(locs.length, 122)
  assert.equal(locs[0], `${F3_JEWISH_ORIGIN}/`)
  for (const loc of locs) {
    assert.equal(loc.startsWith(`${F3_JEWISH_ORIGIN}`), true)
    assert.doesNotMatch(loc, /www\.3djewish/)
    assert.doesNotMatch(loc, /^http:\/\//)
    assert.doesNotMatch(loc, /[?&]/)
  }
  assert.doesNotMatch(xml, /<loc>[^<]*\/(admin|auth|login|preview|api)\b/)
  assert.doesNotMatch(xml, /<loc>[^<]*\/c</)
})

test("inactive or missing product slugs stay out of the F3 sitemap", () => {
  const paths = collectPublicSitemapPaths({
    family: "f3",
    tenantId: F3_JEWISH_TENANT_ID,
    productRows: rowsFor(F3_JEWISH_TENANT_ID, F3_JEWISH_GSC_PRODUCT_PATHS),
  })
  assert.deepEqual(paths.slice(0, 4), [...F3_JEWISH_STATIC_PATHS])
  assert.equal(paths.includes("/p/cobre-claro-2"), true)
  assert.equal(paths.includes("/p/produto-removido"), false)
  assert.equal(collectF3ProductPaths({ tenantId: F3_JEWISH_TENANT_ID, rows: [] }).length, 0)
  assert.deepEqual(
    collectF3ProductPaths({ tenantId: "", rows: rowsFor(F3_JEWISH_TENANT_ID, F3_JEWISH_GSC_PRODUCT_PATHS) }),
    [],
  )
})

test("non-F3 and packaged JUST sitemaps keep current path sets", () => {
  assert.deepEqual(collectPublicSitemapPaths({ family: "f1", tenantId: "x" }), ["/"])
  assert.deepEqual(
    collectPublicSitemapPaths({
      family: "f3",
      packaged: resolvePackagedInstitutionalSite("www.justwebsites.com.br"),
      tenantId: "just",
      productRows: rowsFor("just", ["/p/should-not-appear"]),
    }),
    ["/", "/privacidade", "/termos", "/seguranca"],
  )
})

test("F3 tenant isolation is sequential and concurrent", async () => {
  const tenantA = "00000000-0000-4000-8000-aaa000000001"
  const tenantB = "00000000-0000-4000-8000-bbb000000002"
  const collectA = () =>
    collectPublicSitemapPaths({
      family: "f3",
      tenantId: tenantA,
      productRows: [
        { tenant_id: tenantA, slug: "bege-ouro-velho" },
        { tenant_id: tenantB, slug: "foreign-leak" },
      ],
    })
  const collectB = () =>
    collectPublicSitemapPaths({
      family: "f3",
      tenantId: tenantB,
      productRows: [
        { tenant_id: tenantB, slug: "cobre-claro-flush" },
        { tenant_id: tenantA, slug: "bege-ouro-velho" },
      ],
    })

  const sequentialA = collectA()
  const sequentialB = collectB()
  assert.equal(sequentialA.includes("/p/bege-ouro-velho"), true)
  assert.equal(sequentialA.includes("/p/foreign-leak"), false)
  assert.equal(sequentialA.includes("/p/cobre-claro-flush"), false)
  assert.equal(sequentialB.includes("/p/cobre-claro-flush"), true)
  assert.equal(sequentialB.includes("/p/bege-ouro-velho"), false)

  const [concurrentA, concurrentB] = await Promise.all([
    Promise.resolve(collectA()),
    Promise.resolve(collectB()),
  ])
  assert.deepEqual(concurrentA, sequentialA)
  assert.deepEqual(concurrentB, sequentialB)
})

test("each sitemap loc matches the page canonical builder and stays on HTTPS primary", () => {
  const paths = collectPublicSitemapPaths({
    family: "f3",
    tenantId: F3_JEWISH_TENANT_ID,
    productRows: rowsFor(F3_JEWISH_TENANT_ID, F3_JEWISH_GSC_PRODUCT_PATHS),
  })
  const xml = buildSitemapXml(jewishCanonical, paths)
  for (const loc of locList(xml)) {
    const path = loc === `${F3_JEWISH_ORIGIN}/` ? "/" : loc.slice(F3_JEWISH_ORIGIN.length)
    assert.equal(loc, buildCanonicalUrl(jewishCanonical, path))
    assert.equal(loc.startsWith("https://3djewish.com.br"), true)
    assert.equal(loc.includes("www."), false)
    assert.equal(loc.startsWith("http://"), false)
  }
  assert.deepEqual(F3_CATALOG_STATIC_PATHS, F3_JEWISH_STATIC_PATHS)
})

test("loadF3CatalogProductRows fail-closes without identity, client, or RPC success", async () => {
  const okClient = immediateRpc({
    data: [{ tenant_id: F3_JEWISH_TENANT_ID, slug: "bege-ouro-velho" }],
    error: null,
  })
  assert.deepEqual(
    await loadF3CatalogProductRows({
      supabase: okClient,
      host: F3_JEWISH_HOST,
      tenantId: F3_JEWISH_TENANT_ID,
    }),
    [{ tenant_id: F3_JEWISH_TENANT_ID, slug: "bege-ouro-velho" }],
  )
  assert.deepEqual(
    await loadF3CatalogProductRows({ supabase: okClient, host: F3_JEWISH_HOST, tenantId: "" }),
    [],
  )
  assert.deepEqual(
    await loadF3CatalogProductRows({
      supabase: immediateRpc({ data: null, error: { message: "boom" } }),
      host: F3_JEWISH_HOST,
      tenantId: F3_JEWISH_TENANT_ID,
    }),
    [],
  )
  assert.equal(EMPTY_SITEMAP_XML.includes("<loc>"), false)
})

test("XML loc values are escaped and product rows fail closed on invalid RPC payloads", async () => {
  assert.equal(escapeXml(`https://x.test/p/a&b<"'>`), "https://x.test/p/a&amp;b&lt;&quot;&apos;&gt;")
  assert.equal(F3_CATALOG_RPC_TIMEOUT_MS, 4000)

  const xml = buildSitemapXml(jewishCanonical, ["/", "/catalogo", "/p/bege-ouro-velho"])
  assert.match(xml, /<loc>https:\/\/3djewish\.com\.br\/p\/bege-ouro-velho<\/loc>/)

  const mixed = await loadF3CatalogProductRows({
    supabase: immediateRpc({
      data: [
        null,
        "not-a-row",
        { tenant_id: F3_JEWISH_TENANT_ID, slug: "bege-ouro-velho" },
        { tenant_id: F3_JEWISH_TENANT_ID, slug: "bege-ouro-velho" },
        { tenant_id: "other", slug: "foreign" },
        ["array"],
      ],
      error: null,
    }),
    host: F3_JEWISH_HOST,
    tenantId: F3_JEWISH_TENANT_ID,
  })
  assert.deepEqual(
    collectF3ProductPaths({ tenantId: F3_JEWISH_TENANT_ID, rows: mixed }),
    ["/p/bege-ouro-velho"],
  )

  assert.deepEqual(
    await loadF3CatalogProductRows({
      supabase: immediateRpc({ data: { slug: "not-an-array" }, error: null }),
      host: F3_JEWISH_HOST,
      tenantId: F3_JEWISH_TENANT_ID,
    }),
    [],
  )

  const unordered = collectF3ProductPaths({
    tenantId: F3_JEWISH_TENANT_ID,
    rows: [
      { tenant_id: F3_JEWISH_TENANT_ID, slug: "zebra" },
      { tenant_id: F3_JEWISH_TENANT_ID, slug: "alpha" },
      { tenant_id: F3_JEWISH_TENANT_ID, slug: "alpha" },
    ],
  })
  assert.deepEqual(unordered, ["/p/alpha", "/p/zebra"])
})

test("approved F3 catalog load success still yields the 122 fixture URLs", async () => {
  const rows = await loadF3CatalogProductRows({
    supabase: immediateRpc({
      data: rowsFor(F3_JEWISH_TENANT_ID, F3_JEWISH_PRODUCT_PATHS),
      error: null,
    }),
    host: F3_JEWISH_HOST,
    tenantId: F3_JEWISH_TENANT_ID,
  })
  const paths = collectPublicSitemapPaths({
    family: "f3",
    tenantId: F3_JEWISH_TENANT_ID,
    productRows: rows,
  })
  assert.equal(paths.length, 122)
  assert.deepEqual(paths, [...F3_JEWISH_SITEMAP_PATHS])
  const xml = buildSitemapXml(jewishCanonical, paths)
  assert.equal(locList(xml).length, 122)
  assert.doesNotMatch(xml, /f3_catalog_rpc/)
})

test("fast catalog RPC completes and the abort timer is cleared", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let aborted = false
  /** @type {AbortSignal | null} */
  let seen = null
  const rows = await loadF3CatalogProductRows({
    supabase: rpcClient(async (signal) => {
      seen = signal
      signal.addEventListener("abort", () => {
        aborted = true
      })
      return {
        data: [{ tenant_id: F3_JEWISH_TENANT_ID, slug: "bege-ouro-velho" }],
        error: null,
      }
    }),
    host: F3_JEWISH_HOST,
    tenantId: F3_JEWISH_TENANT_ID,
    timeoutMs: 4000,
  })
  t.mock.timers.tick(10_000)
  assert.equal(aborted, false)
  assert.equal(seen?.aborted, false)
  assert.equal(rows.length, 1)
})

test("slow catalog RPC is aborted; simulated work does not finish", async () => {
  const rejections = []
  const onUnhandled = (reason) => {
    rejections.push(reason)
  }
  process.on("unhandledRejection", onUnhandled)
  const state = { rpcFinished: false, aborted: false }
  try {
    const timedOut = await loadF3CatalogProductRows({
      supabase: hangingRpc({
        delayMs: 5000,
        payload: {
          data: [{ tenant_id: F3_JEWISH_TENANT_ID, slug: "late-product" }],
          error: null,
        },
        state,
      }),
      host: F3_JEWISH_HOST,
      tenantId: F3_JEWISH_TENANT_ID,
      timeoutMs: 20,
    })
    await new Promise((resolve) => setTimeout(resolve, 80))
    assert.deepEqual(timedOut, [])
    assert.equal(state.signal.aborted, true)
    assert.equal(state.aborted, true)
    assert.equal(state.rpcFinished, false)
    assert.equal(rejections.length, 0)
    assert.deepEqual(
      collectPublicSitemapPaths({
        family: "f3",
        tenantId: F3_JEWISH_TENANT_ID,
        productRows: timedOut,
      }),
      [...F3_CATALOG_STATIC_PATHS],
    )
  } finally {
    process.off("unhandledRejection", onUnhandled)
  }
})

test("concurrent catalog loads use independent abort signals", async () => {
  /** @type {AbortSignal[]} */
  const signals = []
  const client = rpcClient(async (signal) => {
    signals.push(signal)
    if (signal.aborted) throw abortError()
    return { data: [], error: null }
  })
  await Promise.all([
    loadF3CatalogProductRows({
      supabase: client,
      host: "a.example.test",
      tenantId: "00000000-0000-4000-8000-aaaa00000001",
      timeoutMs: 4000,
    }),
    loadF3CatalogProductRows({
      supabase: client,
      host: "b.example.test",
      tenantId: "00000000-0000-4000-8000-bbbb00000002",
      timeoutMs: 4000,
    }),
  ])
  assert.equal(signals.length, 2)
  assert.notEqual(signals[0], signals[1])
  assert.equal(signals[0].aborted, false)
  assert.equal(signals[1].aborted, false)
})

test("aborting one tenant catalog RPC does not abort another", async () => {
  const slow = { rpcFinished: false, aborted: false }
  const fast = { rpcFinished: false, aborted: false }
  const fastTenant = "00000000-0000-4000-8000-fast00000001"
  const [slowRows, fastRows] = await Promise.all([
    loadF3CatalogProductRows({
      supabase: hangingRpc({
        delayMs: 5000,
        payload: { data: [{ tenant_id: "slow", slug: "slow-product" }], error: null },
        state: slow,
      }),
      host: "slow.example.test",
      tenantId: "00000000-0000-4000-8000-slow00000001",
      timeoutMs: 20,
    }),
    loadF3CatalogProductRows({
      supabase: hangingRpc({
        delayMs: 5,
        payload: { data: [{ tenant_id: fastTenant, slug: "fast-product" }], error: null },
        state: fast,
      }),
      host: "fast.example.test",
      tenantId: fastTenant,
      timeoutMs: 4000,
    }),
  ])
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.deepEqual(slowRows, [])
  assert.equal(slow.aborted, true)
  assert.equal(slow.signal.aborted, true)
  assert.equal(slow.rpcFinished, false)
  assert.equal(fast.aborted, false)
  assert.equal(fast.signal.aborted, false)
  assert.equal(fast.rpcFinished, true)
  assert.equal(fastRows.length, 1)
  assert.deepEqual(
    collectPublicSitemapPaths({ family: "f3", tenantId: fastTenant, productRows: fastRows }),
    ["/", "/catalogo", "/sobre", "/contato", "/p/fast-product"],
  )
})

test("RPC builders without abortSignal fail closed instead of racing a timer", async () => {
  const started = Date.now()
  const rows = await loadF3CatalogProductRows({
    supabase: {
      rpc() {
        return new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                data: [{ tenant_id: F3_JEWISH_TENANT_ID, slug: "late-product" }],
                error: null,
              }),
            200,
          )
        })
      },
    },
    host: F3_JEWISH_HOST,
    tenantId: F3_JEWISH_TENANT_ID,
    timeoutMs: 4000,
  })
  assert.deepEqual(rows, [])
  assert.ok(Date.now() - started < 100)
})

test("factory sitemap code does not hardcode the 3D Jewish catalog snapshot", async () => {
  const { readFileSync } = await import("node:fs")
  const { dirname, join } = await import("node:path")
  const { fileURLToPath } = await import("node:url")
  const root = join(dirname(fileURLToPath(import.meta.url)), "..")
  const impl = readFileSync(join(root, "src/lib/publicSitemap.js"), "utf8")
  const route = readFileSync(join(root, "src/pages/sitemap.xml.ts"), "utf8")
  assert.doesNotMatch(impl, /3djewish|bege-ouro-velho|cobre-claro-flush/)
  assert.doesNotMatch(route, /3djewish|bege-ouro-velho|cobre-claro-flush/)
  assert.doesNotMatch(impl, /\/catalogo\?/)
  assert.match(impl, /F3_CATALOG_STATIC_PATHS/)
  assert.match(impl, /AbortController/)
  assert.match(impl, /abortSignal/)
  assert.doesNotMatch(impl, /Promise\.race/)
})
