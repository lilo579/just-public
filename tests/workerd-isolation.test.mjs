import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import {
  TENANT_ALPHA,
  TENANT_BETA,
  TENANT_GAMMA,
} from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import {
  assertNoCrossTenant,
  assertTenantHtml,
  extractAssetUrls,
  requestWithHost,
  root,
  startWrangler,
} from "./helpers/workerd-poc.mjs"

const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-slice6-anon-placeholder-not-real"
const TENANTS = [TENANT_ALPHA, TENANT_BETA, TENANT_GAMMA]
const BY_KEY = {
  alpha: TENANT_ALPHA,
  beta: TENANT_BETA,
  gamma: TENANT_GAMMA,
}

/**
 * @param {string[]} keys
 * @param {number} port
 * @param {ReturnType<typeof startCanonicalPayloadMock>} mock
 */
async function runSequence(keys, port, mock) {
  /** @type {{ order: number, key: string, status: number, renderer: string | null, ms: number, company: boolean, primary: boolean }[]} */
  const rows = []
  const callStart = mock.calls.length

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const tenant = BY_KEY[key]
    const res = await requestWithHost(port, tenant.host)
    const renderer =
      res.body.match(/data-renderer="([^"]+)"/)?.[1] ?? null
    rows.push({
      order: i + 1,
      key,
      status: res.status,
      renderer,
      ms: res.ms,
      company: res.body.includes(tenant.companyName),
      primary: res.body.includes(`--site-color-primary:${tenant.primaryColor}`),
    })
    assertTenantHtml(tenant, res, assert)
    assertNoCrossTenant(tenant, TENANTS, res, assert)
  }

  const newCalls = mock.calls.slice(callStart)
  assert.equal(newCalls.length, keys.length)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const tenant = BY_KEY[key]
    const call = newCalls[i]
    assert.equal(call.host, tenant.host)
    assert.equal(call.tenant, tenant.tenantId)
    assert.equal(call.tenantKey, key)
    assert.equal(call.status, 200)
    assert.equal(call.mode, "public")
    assert.ok(call.timestamp)
  }

  return rows
}

/**
 * @param {string[]} keys
 * @param {number} port
 */
async function runConcurrent(keys, port) {
  const started = Date.now()
  const results = await Promise.all(
    keys.map(async (key) => {
      const tenant = BY_KEY[key]
      const res = await requestWithHost(port, tenant.host)
      return {
        key,
        status: res.status,
        renderer: res.body.match(/data-renderer="([^"]+)"/)?.[1] ?? null,
        ms: res.ms,
        body: res.body,
        tenant,
      }
    }),
  )
  const wall = Date.now() - started

  for (const r of results) {
    assertTenantHtml(r.tenant, r, assert)
    assertNoCrossTenant(r.tenant, TENANTS, r, assert)
    assert.equal(r.renderer, "canonical")
  }

  return { results, wall }
}

test("workerd multi-tenant isolation: sequences, concurrency, stress, assets", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const mock = startCanonicalPayloadMock()
  const { baseUrl: mockUrl } = await mock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "staging",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER,
  })

  t.after(async () => {
    await wrangler.stop()
    await mock.close()
  })

  await wrangler.ready()

  const longSeq = ["alpha", "beta", "gamma", "alpha", "gamma", "beta", "alpha"]
  const seq1 = await runSequence(longSeq, port, mock)
  assert.ok(seq1.every((r) => r.status === 200 && r.renderer === "canonical"))

  const alphaRepeat = await runSequence(["alpha", "alpha", "alpha", "alpha"], port, mock)
  assert.ok(alphaRepeat.every((r) => r.key === "alpha" && r.company))

  const gammaRepeat = await runSequence(["gamma", "gamma", "gamma"], port, mock)
  assert.ok(gammaRepeat.every((r) => r.key === "gamma" && r.company))

  const pingPong = await runSequence(
    ["beta", "alpha", "beta", "alpha", "beta"],
    port,
    mock,
  )
  assert.deepEqual(
    pingPong.map((r) => r.key),
    ["beta", "alpha", "beta", "alpha", "beta"],
  )

  // Repeatability: same long sequence again → identical fingerprints.
  const seq2 = await runSequence(longSeq, port, mock)
  assert.deepEqual(
    seq1.map((r) => ({ key: r.key, status: r.status, renderer: r.renderer, company: r.company, primary: r.primary })),
    seq2.map((r) => ({ key: r.key, status: r.status, renderer: r.renderer, company: r.company, primary: r.primary })),
  )

  // Concurrency waves (each at least twice).
  for (let wave = 0; wave < 2; wave++) {
    const c1 = await runConcurrent(["alpha", "beta", "gamma"], port)
    assert.equal(c1.results.length, 3)
    const c2 = await runConcurrent(["alpha", "alpha", "alpha"], port)
    assert.ok(c2.results.every((r) => r.key === "alpha"))
    const c3 = await runConcurrent(
      ["gamma", "beta", "alpha", "gamma", "beta"],
      port,
    )
    assert.deepEqual(
      c3.results.map((r) => r.key).sort(),
      ["alpha", "beta", "beta", "gamma", "gamma"].sort(),
    )
    assert.ok(c1.wall > 0 && c2.wall > 0 && c3.wall > 0)
  }

  // Stress: alternating tenants for consistency only (not a benchmark).
  const stressKeys = []
  for (let i = 0; i < 30; i++) {
    stressKeys.push(["alpha", "beta", "gamma"][i % 3])
  }
  await runSequence(stressKeys, port, mock)

  // Assets: same URLs across Alpha/Beta/Gamma; CSS has zero tenant strings.
  const htmlByKey = {}
  for (const key of ["alpha", "beta", "gamma"]) {
    const res = await requestWithHost(port, BY_KEY[key].host)
    htmlByKey[key] = res.body
  }
  const assetsAlpha = extractAssetUrls(htmlByKey.alpha)
  const assetsBeta = extractAssetUrls(htmlByKey.beta)
  const assetsGamma = extractAssetUrls(htmlByKey.gamma)
  assert.deepEqual(assetsAlpha, assetsBeta)
  assert.deepEqual(assetsBeta, assetsGamma)

  for (const url of assetsAlpha) {
    assert.doesNotMatch(url, /alpha|beta|gamma|tenant_|justwebsites|example\.test/i)
  }

  const cssUrls = assetsAlpha.filter((u) => u.endsWith(".css"))
  assert.ok(cssUrls.length >= 1)
  for (const cssUrl of cssUrls) {
    const cssRes = await fetch(`http://127.0.0.1:${port}${cssUrl}`)
    assert.equal(cssRes.status, 200)
    assert.match(cssRes.headers.get("content-type") ?? "", /text\/css/i)
    const cssText = await cssRes.text()
    for (const tenant of TENANTS) {
      const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      assert.doesNotMatch(cssText, new RegExp(esc(tenant.companyName)))
      assert.doesNotMatch(cssText, new RegExp(esc(tenant.email)))
      assert.doesNotMatch(cssText, new RegExp(esc(tenant.phone)))
      assert.doesNotMatch(cssText, new RegExp(esc(tenant.primaryColor), "i"))
      assert.doesNotMatch(cssText, new RegExp(esc(tenant.secondaryColor), "i"))
      assert.doesNotMatch(cssText, new RegExp(esc(tenant.slug)))
    }
    assert.doesNotMatch(cssText, /\bAlpha Consulting\b|\bBeta Studio\b|\bGamma Labs\b/)
  }

  // Distinct HTML across tenants (shared assets do not imply shared HTML).
  assert.notEqual(htmlByKey.alpha, htmlByKey.beta)
  assert.notEqual(htmlByKey.beta, htmlByKey.gamma)
  assert.notEqual(htmlByKey.alpha, htmlByKey.gamma)

  // Payload cross-delivery impossible: each mock call host matches served tenant.
  for (const call of mock.calls) {
    if (call.status !== 200 || !call.tenantKey) continue
    const expected = BY_KEY[call.tenantKey]
    assert.equal(call.host, expected.host)
    assert.equal(call.tenant, expected.tenantId)
  }

  // No real Supabase; no Node compat.
  assert.doesNotMatch(wrangler.output, /ehondnpqztvybvgsjnxe\.supabase\.co/)
  assert.doesNotMatch(wrangler.output, /nodejs_compat/)
  assert.ok(mock.calls.every((c) => c.hasAuth === true || c.status === 404))
})

test("source audit: no mutable cross-tenant module state in homepage/theme path", async () => {
  const files = [
    "src/lib/publicHomepage.ts",
    "src/lib/publicHomepageHelpers.js",
    "src/lib/themeFromBranding.js",
    "src/lib/themeFromBranding.ts",
    "src/lib/runtimeEnv.js",
    "src/components/CanonicalHomepageRenderer.astro",
    "src/components/SiteTheme.astro",
    "src/components/canonicalHomepageCtaAdapter.js",
    "src/components/canonicalHomepageBenefitsAdapter.js",
  ]

  /** Patterns that would indicate shared mutable request/tenant state. */
  const forbidden = [
    /^(?:export\s+)?let\s+\w+\s*=/m,
    /^(?:export\s+)?var\s+\w+\s*=/m,
    /new\s+Map\s*\(/,
    /new\s+WeakMap\s*\(/,
    /globalThis\.\w+\s*=/,
    /(?:^|\s)(?:tenantCache|payloadCache|homepageCache|globalCache)\b/,
    /singleton/i,
  ]

  for (const rel of files) {
    const text = await fs.readFile(path.join(root, rel), "utf8")
    for (const re of forbidden) {
      assert.doesNotMatch(
        text,
        re,
        `${rel} must not contain mutable shared state pattern ${re}`,
      )
    }
  }

  // themeFromBranding DEFAULTS / FONT_ALLOWLIST are immutable shared constants (OK).
  const theme = await fs.readFile(path.join(root, "src/lib/themeFromBranding.js"), "utf8")
  assert.match(theme, /const DEFAULTS = \{/)
  assert.doesNotMatch(theme, /DEFAULTS\[.+\]\s*=/)
  assert.doesNotMatch(theme, /let\s+DEFAULTS/)
})
