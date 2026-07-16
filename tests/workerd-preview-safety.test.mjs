import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import { TENANT_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"
import { requestWithHost, root, startWrangler } from "./helpers/workerd-poc.mjs"

const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-slice65-anon-placeholder-not-real"
const PROD_LEADS = "https://ehondnpqztvybvgsjnxe.supabase.co/functions/v1/leads"
const PROD_LEADS_HOST = "ehondnpqztvybvgsjnxe.supabase.co"

/** @param {string} html */
function extractLeadForm(html) {
  const match = html.match(/<form\b[^>]*data-lead-form\b[^>]*>[\s\S]*?<\/form>/i)
  return match?.[0] ?? null
}

test("workerd Preview Safety: staging/preview disable LeadForm intake; production preserves it", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const payloadMock = startCanonicalPayloadMock()
  const { baseUrl: mockUrl } = await payloadMock.listen()

  t.after(async () => {
    await payloadMock.close()
  })

  /**
   * @param {string} deployEnv
   * @returns {Promise<{ status: number, body: string, wranglerOutput: string }>}
   */
  async function renderWithDeployEnv(deployEnv) {
    const port = await freePort()
    const wrangler = startWrangler(port, {
      DEPLOY_ENV: deployEnv,
      PUBLIC_SITE_PAYLOAD_URL: mockUrl,
      SUPABASE_ANON_KEY: PLACEHOLDER,
    })
    await wrangler.ready()
    try {
      const res = await requestWithHost(port, TENANT_ALPHA.host)
      return { status: res.status, body: res.body, wranglerOutput: wrangler.output }
    } finally {
      await wrangler.stop()
    }
  }

  // --- Preview / staging: no disabled LeadForm chrome (WhatsApp CTA only) ---
  for (const envName of ["preview", "staging"]) {
    const res = await renderWithDeployEnv(envName)

    assert.equal(res.status, 200)
    const form = extractLeadForm(res.body)
    assert.equal(
      form,
      null,
      `LeadForm must not render under DEPLOY_ENV=${envName} (preview chrome removed)`,
    )
    assert.doesNotMatch(res.body, /Envio desativado neste preview/)
    assert.doesNotMatch(res.body, /lead-form--safe/)
    assert.doesNotMatch(res.body, /data-lead-form-safe/)

    // Whole HTML must not ship production leads intake credentials in preview/staging.
    assert.doesNotMatch(res.body, new RegExp(`${PROD_LEADS_HOST}/functions/v1/leads`))
    assert.doesNotMatch(res.body, /service_role|SUPABASE_SERVICE_ROLE/i)
    assert.doesNotMatch(res.body, new RegExp(`data-anon-key="${PLACEHOLDER}"`))

    assert.doesNotMatch(res.wranglerOutput, new RegExp(`${PROD_LEADS_HOST}/functions/v1/leads`))
    assert.doesNotMatch(res.wranglerOutput, /nodejs_compat/)
  }

  // Client submit cannot call production when safe: empty intake + data-lead-form-safe early return.
  // SSR itself must not initiate leads traffic.
  assert.ok(
    !payloadMock.calls.some((c) => String(c.pathname).includes("leads")),
    "payload mock must never receive leads traffic",
  )

  // --- Production: DR-001 WhatsApp-only — no public LeadForm ---
  const prod = await renderWithDeployEnv("production")
  assert.equal(prod.status, 200)
  const prodForm = extractLeadForm(prod.body)
  assert.equal(prodForm, null, "LeadForm must not render (DR-001 WhatsApp-only)")
  assert.doesNotMatch(prod.body, /data-lead-form-safe="true"/)
  assert.doesNotMatch(prod.body, /Envio desativado neste preview/)
  assert.doesNotMatch(prod.body, /service_role|SUPABASE_SERVICE_ROLE/i)
  assert.doesNotMatch(prod.body, /SUPABASE_SERVICE_ROLE/i)

  assert.ok(
    !payloadMock.calls.some((c) => String(c.pathname).includes("leads")),
    "payload mock must never receive leads traffic",
  )
})

test("build assets: no service_role; preview-safe helper has no hard-coded prod leads URL", async () => {
  const runtimeEnv = await fs.readFile(path.join(root, "src/lib/runtimeEnv.js"), "utf8")
  assert.match(runtimeEnv, /isLeadIntakeSafeMode/)
  assert.doesNotMatch(runtimeEnv, /ehondnpqztvybvgsjnxe/)
  assert.doesNotMatch(runtimeEnv, /functions\/v1\/leads/)

  const leadForm = await fs.readFile(path.join(root, "src/components/LeadForm.astro"), "utf8")
  assert.match(leadForm, /isLeadIntakeSafeMode/)
  assert.match(leadForm, /data-lead-form-safe/)
  assert.doesNotMatch(leadForm, /service_role/i)

  try {
    await fs.access(path.join(root, "dist"))
  } catch {
    return
  }
  const astroDir = path.join(root, "dist/_astro")
  try {
    for (const name of await fs.readdir(astroDir)) {
      if (!/\.(js|mjs|css)$/.test(name)) continue
      const text = await fs.readFile(path.join(astroDir, name), "utf8")
      assert.doesNotMatch(text, /service_role|SUPABASE_SERVICE_ROLE/i)
    }
  } catch {
    /* optional */
  }
})
