import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import {
  CELINA_MARKERS,
  CINEMATIC_HOST_FIXTURES,
  CINEMATIC_TENANTS,
  HOST_CELINA_LEGACY,
  HOST_CELINA_V1_NO_SEED,
  HOST_FLAVIO_LEGACY,
  HOST_NEXO_UNKNOWN,
  TENANT_CELINA,
  TENANT_FLAVIO,
  TENANT_NEXO,
} from "./fixtures/cinematic-editorial-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import { requestWithHost, root, startWrangler } from "./helpers/workerd-poc.mjs"

const workerEntry = path.join(root, "dist/_worker.js/index.js")

const TENANT_BY_HOST = {
  [TENANT_FLAVIO.host]: TENANT_FLAVIO,
  [TENANT_FLAVIO.wwwHost]: TENANT_FLAVIO,
  [TENANT_CELINA.host]: TENANT_CELINA,
  [TENANT_CELINA.wwwHost]: TENANT_CELINA,
  [TENANT_NEXO.host]: TENANT_NEXO,
  [TENANT_NEXO.wwwHost]: TENANT_NEXO,
  [HOST_FLAVIO_LEGACY]: TENANT_FLAVIO,
  [HOST_CELINA_LEGACY]: TENANT_CELINA,
  [HOST_NEXO_UNKNOWN]: TENANT_NEXO,
  [HOST_CELINA_V1_NO_SEED]: TENANT_CELINA,
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function assertFlavioHtml(res) {
  assert.equal(res.status, 200)
  assert.match(res.body, /data-renderer="canonical"/)
  assert.match(res.body, new RegExp(escapeRe(TENANT_FLAVIO.companyName)))
  assert.match(res.body, new RegExp(escapeRe(TENANT_FLAVIO.title)))
  assert.match(res.body, /data-f1-atmosphere="pt_dark"/)
  assert.match(res.body, /cdn\.example\.test\/flavio\/hero\.mp4|proof-01\.jpeg|proof-02\.jpeg/)
  assert.match(res.body, /Quero treinar com método/)
  assert.match(res.body, /#metodo/)
  assert.match(res.body, new RegExp(escapeRe(`--site-color-primary:${TENANT_FLAVIO.primaryColor}`), "i"))
  for (const marker of CELINA_MARKERS) {
    assert.doesNotMatch(res.body, new RegExp(escapeRe(marker), "i"))
  }
  assert.doesNotMatch(res.body, /hero\.jpg/)
  assert.doesNotMatch(res.body, new RegExp(escapeRe(TENANT_CELINA.companyName)))
}

function assertCelinaHtml(res) {
  assert.equal(res.status, 200)
  assert.match(res.body, /data-renderer="canonical"/)
  assert.match(res.body, new RegExp(escapeRe(TENANT_CELINA.companyName)))
  assert.match(res.body, /criança/i)
  assert.match(res.body, /40\+/)
  assert.match(res.body, /hero\.jpg/)
  assert.doesNotMatch(res.body, /Quero treinar com método/)
  assert.doesNotMatch(res.body, /proof-02\.jpeg/)
  assert.doesNotMatch(res.body, new RegExp(escapeRe(TENANT_FLAVIO.companyName)))
}

function assertNexoHtml(res) {
  assert.equal(res.status, 200)
  assert.match(res.body, /data-renderer="canonical"/)
  assert.match(res.body, new RegExp(escapeRe(TENANT_NEXO.companyName)))
  assert.match(res.body, new RegExp(escapeRe(TENANT_NEXO.title)))
  for (const marker of CELINA_MARKERS) {
    assert.doesNotMatch(res.body, new RegExp(escapeRe(marker), "i"))
  }
  assert.doesNotMatch(res.body, /Quero treinar com método/)
  assert.doesNotMatch(res.body, /proof-02\.jpeg/)
  assert.doesNotMatch(res.body, /hero\.jpg/)
}

async function htmlFor(port, host) {
  return requestWithHost(port, host)
}

test("workerd cinematic editorial isolation: sequences, concurrency, stress, apex/www", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const mock = startCanonicalPayloadMock(CINEMATIC_HOST_FIXTURES, TENANT_BY_HOST)
  const { baseUrl: mockUrl } = await mock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "staging",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: "poc-slice6-anon-placeholder-not-real",
  })

  try {
    await wrangler.ready()

    const flavioThenCelina = ["flavio", "celina", "flavio"]
    const celinaThenFlavio = ["celina", "flavio", "celina"]
    const byKey = { flavio: TENANT_FLAVIO, celina: TENANT_CELINA, nexo: TENANT_NEXO }
    const assertHtml = { flavio: assertFlavioHtml, celina: assertCelinaHtml, nexo: assertNexoHtml }

    for (const order of [flavioThenCelina, celinaThenFlavio]) {
      const start = mock.calls.length
      for (const key of order) {
        const tenant = byKey[key]
        const res = await htmlFor(port, tenant.host)
        assertHtml[key](res)
      }
      const calls = mock.calls.slice(start)
      assert.equal(calls.length, order.length)
      for (let i = 0; i < order.length; i++) {
        assert.equal(calls[i].host, byKey[order[i]].host)
        assert.equal(calls[i].tenant, byKey[order[i]].tenantId)
        assert.equal(calls[i].status, 200)
      }
    }

    const concurrentKeys = ["flavio", "celina", "nexo", "flavio", "celina", "nexo"]
    const concurrent = await Promise.all(
      concurrentKeys.map((key) => htmlFor(port, byKey[key].host).then((res) => ({ key, res }))),
    )
    for (const row of concurrent) assertHtml[row.key](row.res)

    const stressKeys = Array.from({ length: 24 }, (_, i) => CINEMATIC_TENANTS[i % 3].key)
    const stress = await Promise.all(
      stressKeys.map((key) => htmlFor(port, byKey[key].host).then((res) => ({ key, res }))),
    )
    for (const row of stress) assertHtml[row.key](row.res)

    const apex = await htmlFor(port, TENANT_FLAVIO.host)
    const www = await htmlFor(port, TENANT_FLAVIO.wwwHost)
    assertFlavioHtml(apex)
    assertFlavioHtml(www)
    assert.match(www.body, /data-f1-atmosphere="pt_dark"/)

    const celinaWww = await htmlFor(port, TENANT_CELINA.wwwHost)
    assertCelinaHtml(celinaWww)
    const nexoWww = await htmlFor(port, TENANT_NEXO.wwwHost)
    assertNexoHtml(nexoWww)

    const flavioLegacy = await htmlFor(port, HOST_FLAVIO_LEGACY)
    assert.equal(flavioLegacy.status, 200)
    assert.match(flavioLegacy.body, /criança/i)
    assert.match(flavioLegacy.body, /hero\.jpg/)
    assert.match(flavioLegacy.body, new RegExp(escapeRe(TENANT_FLAVIO.companyName)))

    const celinaLegacy = await htmlFor(port, HOST_CELINA_LEGACY)
    assert.equal(celinaLegacy.status, 200)
    assert.match(celinaLegacy.body, /criança/i)
    assert.match(celinaLegacy.body, /40\+/)

    const unknown = await htmlFor(port, HOST_NEXO_UNKNOWN)
    assert.equal(unknown.status, 200)
    assert.doesNotMatch(unknown.body, /criança/i)
    assert.doesNotMatch(unknown.body, /Quero treinar com método/)
    assert.doesNotMatch(unknown.body, /hero\.jpg/)

    const celinaNoSeed = await htmlFor(port, HOST_CELINA_V1_NO_SEED)
    assert.equal(celinaNoSeed.status, 200)
    assert.doesNotMatch(celinaNoSeed.body, /criança/i)
    assert.doesNotMatch(celinaNoSeed.body, /40\+/)
    assert.doesNotMatch(celinaNoSeed.body, /hero\.jpg/)

    const hosts = new Set(mock.calls.map((call) => `${call.host}:${call.tenant}`))
    assert.ok(hosts.size >= 6)
  } finally {
    await wrangler.stop()
    await mock.close()
  }
})
