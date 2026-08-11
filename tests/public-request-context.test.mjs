import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  resolvePublicRequestContext,
  getPublicRequestContext,
  PUBLIC_CANONICAL_CONTRACT_VERSION,
  shouldEmitServerTiming,
  buildServerTimingHeader,
} from "../src/lib/publicRequestContext.js"
import { TENANT_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("resolvePublicRequestContext reuses locals — one payload fetch per host/request", async () => {
  const host = TENANT_ALPHA.host
  const payload = {
    tenantId: TENANT_ALPHA.tenantId,
    canonical: {
      host,
      origin: `https://${host}`,
      requestHost: host,
      isPrimaryRequest: true,
    },
    source: { contact: { companyName: "Alpha" }, meta: {} },
  }

  let fetches = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    fetches += 1
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    /** @type {Record<string, unknown>} */
    const locals = {
      runtime: {
        env: {
          DEPLOY_ENV: "production",
          PUBLIC_SITE_PAYLOAD_URL:
            "https://example.test/functions/v1/public-site-payload",
          SUPABASE_ANON_KEY: "test-anon",
        },
      },
    }
    const request = new Request(`https://${host}/`, {
      headers: { host },
    })
    const url = new URL(request.url)

    const first = await resolvePublicRequestContext(request, url, locals)
    const second = await resolvePublicRequestContext(request, url, locals)
    assert.equal(first.result, "ok")
    assert.equal(second.result, "ok")
    assert.equal(first, second)
    assert.equal(fetches, 1)
    assert.equal(first.counters.payloadFetches, 1)
    assert.equal(getPublicRequestContext(locals)?.canonical?.host, host)
    assert.equal(locals.publicSitePayloadHost, host)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Server-Timing only for safe/debug envs by default", () => {
  assert.equal(shouldEmitServerTiming("preview", {}), true)
  assert.equal(shouldEmitServerTiming("staging", {}), true)
  assert.equal(shouldEmitServerTiming("production", {}), false)
  assert.equal(
    shouldEmitServerTiming("production", {
      runtime: { env: { PUBLIC_SERVER_TIMING: "true" } },
    }),
    true,
  )
  const header = buildServerTimingHeader({
    timings: { hostMs: 1.2, payloadMs: 3.4, canonicalMs: 5.6, totalMs: 10 },
  })
  assert.match(header, /canonical;dur=6/)
  assert.match(header, /payload;dur=3/)
  assert.doesNotMatch(header, /tenant|cookie|authorization/i)
})

test("canonical contract version is stable for health", () => {
  assert.equal(PUBLIC_CANONICAL_CONTRACT_VERSION, "seo001-v1")
})

test("structural: SEO authority paths must not invent request-host canonical", () => {
  const files = [
    "src/lib/canonicalAuthority.js",
    "src/lib/canonicalRedirect.js",
    "src/lib/publicRequestContext.js",
    "src/lib/publicPageSeo.js",
    "src/lib/justInstitutionalSeo.js",
    "src/middleware.ts",
    "src/pages/robots.txt.ts",
    "src/pages/sitemap.xml.ts",
    "src/pages/index.astro",
  ]

  for (const rel of files) {
    const text = readFileSync(path.join(root, rel), "utf8")
    assert.equal(
      text.includes("JUST_PUBLIC_ORIGIN"),
      false,
      `${rel} must not use JUST_PUBLIC_ORIGIN as SEO authority`,
    )
    assert.equal(
      text.includes("resolveJustPublicOrigin"),
      false,
      `${rel} must not decide canonical via resolveJustPublicOrigin`,
    )
    // Hardcoded template inventing origin from request host.
    assert.equal(
      /origin:\s*`https:\$\{[^}]*host[^}]*\}`/.test(text) &&
        rel.includes("canonicalAuthority") === false,
      false,
      `${rel}: avoid inventing https://\${host} origin in SEO authority code`,
    )
    assert.equal(
      /\.replace\(\s*\/\^www\\?\./.test(text),
      false,
      `${rel}: must not strip www to decide primary`,
    )
    assert.equal(
      /canonicalHost\s*\|\|\s*requestHost/.test(text),
      false,
      `${rel}: must not fall back canonicalHost || requestHost`,
    )
  }

  const ctx = readFileSync(path.join(root, "src/lib/publicRequestContext.js"), "utf8")
  assert.doesNotMatch(ctx, /caches\.default/)
  assert.doesNotMatch(ctx, /globalThis\.[A-Za-z]*[Cc]ache/)
  assert.match(ctx, /locals\.publicSitePayload/)
  assert.match(ctx, /publicRequestContext/)
})

test("structural: homepage prefers locals payload before refetch", () => {
  const index = readFileSync(path.join(root, "src/pages/index.astro"), "utf8")
  assert.match(index, /publicSitePayloadHost/)
  assert.match(index, /scopedPayload/)
  const mw = readFileSync(path.join(root, "src/middleware.ts"), "utf8")
  assert.match(mw, /resolvePublicRequestContext/)
  assert.match(mw, /publicAuthorityGateResponse/)
})
