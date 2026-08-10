import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  HOST_MALFORMED,
  HOST_UNKNOWN,
  TENANT_ALPHA,
  TENANT_BETA,
} from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-slice4-anon-placeholder-not-real"

/**
 * @param {number} port
 * @param {Record<string, string>} vars
 */
function startWrangler(port, vars) {
  const varArgs = Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/wrangler/bin/wrangler.js"),
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--show-interactive-dev-session",
      "false",
      ...varArgs,
    ],
    { cwd: root, env: { ...process.env, CI: "1" }, stdio: ["ignore", "pipe", "pipe"] },
  )
  let out = ""
  child.stdout.on("data", (c) => {
    out += String(c)
  })
  child.stderr.on("data", (c) => {
    out += String(c)
  })
  return {
    get output() {
      return out
    },
    async ready() {
      for (let i = 0; i < 100; i++) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/health`)
          if (res.ok) return
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 150))
      }
      throw new Error(`wrangler not ready\n${out}`)
    },
    async stop() {
      if (child.exitCode !== null) return
      child.kill("SIGTERM")
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ])
      if (child.exitCode === null) child.kill("SIGKILL")
    },
  }
}

/**
 * Node fetch cannot set Host; use http like curl -H.
 * @param {number} port
 * @param {string} hostHeader
 * @param {string} [reqPath]
 */
function requestWithHost(port, hostHeader, reqPath = "/") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: reqPath,
        method: "GET",
        headers: { Host: hostHeader },
      },
      (res) => {
        let body = ""
        res.on("data", (c) => {
          body += String(c)
        })
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body,
            headers: res.headers,
          }),
        )
      },
    )
    req.on("error", reject)
    req.end()
  })
}

test("workerd canonical renderer + theme: Alpha/Beta isolation and error paths", async (t) => {
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

  const alpha = await requestWithHost(port, TENANT_ALPHA.host)
  assert.equal(alpha.status, 200)
  assert.match(alpha.body, /data-renderer="canonical"/)
  assert.doesNotMatch(alpha.body, /data-legacy-fallback|Using explicit legacy/)
  assert.match(alpha.body, /Alpha Consulting/)
  assert.match(alpha.body, /alpha@example\.test/)
  assert.match(alpha.body, /--site-color-primary:#112233/)
  assert.match(alpha.body, /data-primary="#112233"/)
  assert.doesNotMatch(alpha.body, /Beta Studio/)
  assert.doesNotMatch(alpha.body, /beta@example\.test/)
  assert.doesNotMatch(alpha.body, /#aa5500/i)
  // Payload runtime placeholder must not leak into HTML (distinct from LeadForm
  // build-time PUBLIC_* bake — tracked as POC Issue, out of Slice 4 scope).
  assert.doesNotMatch(alpha.body, new RegExp(PLACEHOLDER))
  assert.doesNotMatch(alpha.body, /SUPABASE_SERVICE_ROLE|service_role/i)

  const beta = await requestWithHost(port, TENANT_BETA.host)
  assert.equal(beta.status, 200)
  assert.match(beta.body, /data-renderer="canonical"/)
  assert.doesNotMatch(beta.body, /data-legacy-fallback/)
  assert.match(beta.body, /Beta Studio/)
  assert.match(beta.body, /beta@example\.test/)
  assert.match(beta.body, /--site-color-primary:#aa5500/)
  assert.match(beta.body, /data-primary="#aa5500"/)
  assert.doesNotMatch(beta.body, /Alpha Consulting/)
  assert.doesNotMatch(beta.body, /alpha@example\.test/)
  assert.doesNotMatch(beta.body, /#112233/)
  assert.doesNotMatch(beta.body, new RegExp(PLACEHOLDER))

  // Consecutive requests must not share tenant state.
  for (const host of [
    TENANT_ALPHA.host,
    TENANT_BETA.host,
    TENANT_ALPHA.host,
    TENANT_BETA.host,
  ]) {
    const res = await requestWithHost(port, host)
    assert.equal(res.status, 200)
    if (host === TENANT_ALPHA.host) {
      assert.match(res.body, /Alpha Consulting/)
      assert.doesNotMatch(res.body, /Beta Studio/)
    } else {
      assert.match(res.body, /Beta Studio/)
      assert.doesNotMatch(res.body, /Alpha Consulting/)
    }
  }

  const unknown = await requestWithHost(port, HOST_UNKNOWN)
  assert.equal(unknown.status, 404)
  assert.doesNotMatch(unknown.body, /Alpha Consulting|Beta Studio/)
  assert.match(unknown.body, /Site unavailable|Status: 404/)

  const noPlan = await requestWithHost(port, "no-plan.justwebsites.com.br")
  assert.equal(noPlan.status, 502)
  assert.match(noPlan.body, /canonical_plan_missing/)
  assert.doesNotMatch(noPlan.body, /data-renderer="legacy"/)
  assert.doesNotMatch(noPlan.body, /Alpha Consulting|Beta Studio/)

  const nosource = await requestWithHost(port, "nosource.justwebsites.com.br")
  assert.equal(nosource.status, 200)
  assert.match(nosource.body, /data-renderer="legacy"/)
  assert.match(nosource.body, /data-legacy-runtime="nosource_or_shop_legacy_runtime"/)
  assert.match(nosource.body, /NoSource Legacy Hero/)
  assert.doesNotMatch(nosource.body, /Alpha Consulting|Beta Studio/)

  // Kill-switch: ?renderer=legacy must not divert F1 away from canonical.
  const forceLegacy = await requestWithHost(
    port,
    TENANT_ALPHA.host,
    "/?renderer=legacy",
  )
  assert.equal(forceLegacy.status, 502)
  assert.match(forceLegacy.body, /legacy_forbidden_for_canonical_plan/)
  assert.doesNotMatch(forceLegacy.body, /data-renderer="legacy"/)

  const malformed = await requestWithHost(port, HOST_MALFORMED)
  assert.equal(malformed.status, 503)
  assert.doesNotMatch(malformed.body, /at Object\.|TypeError|SyntaxError|stack/i)
  assert.doesNotMatch(malformed.body, /Alpha Consulting|Beta Studio/)
  assert.match(malformed.body, /Site unavailable|canonical_authority_unavailable|Invalid payload/)

  const badBrand = await requestWithHost(port, "bad-branding.justwebsites.com.br")
  assert.equal(badBrand.status, 200)
  assert.match(badBrand.body, /Bad Branding Co/)
  assert.match(badBrand.body, /data-renderer="canonical"/)
  // Invalid colors → safe defaults (not raw evil strings).
  assert.match(badBrand.body, /--site-color-primary:#2563eb/)
  // Reject CSS-injection branding payloads (not bare `URL(` in client scripts).
  assert.doesNotMatch(badBrand.body, /url\s*\(\s*javascript:/i)
  assert.doesNotMatch(badBrand.body, /--site-color-primary:red/)
  assert.doesNotMatch(badBrand.body, /5511999900001|Alpha Consulting/)

  // Basic Static Assets: CSS referenced by HTML returns 200.
  const cssMatch = alpha.body.match(/\/_astro\/[^"'()\s]+\.css/)
  assert.ok(cssMatch, "expected /_astro/*.css reference in HTML")
  const cssPath = cssMatch[0]
  const cssRes = await fetch(`http://127.0.0.1:${port}${cssPath}`)
  assert.equal(cssRes.status, 200)
  assert.doesNotMatch(cssPath, /dist\/server|entry\.mjs/)

  assert.ok(mock.calls.some((c) => c.host === TENANT_ALPHA.host))
  assert.ok(mock.calls.some((c) => c.host === TENANT_BETA.host))
  assert.ok(
    !mock.calls.some(
      (c) =>
        c.host === TENANT_ALPHA.host && String(c.host).includes("beta"),
    ),
  )
  assert.doesNotMatch(wrangler.output, /ehondnpqztvybvgsjnxe\.supabase\.co/)
  assert.doesNotMatch(wrangler.output, /nodejs_compat/)

  for (const call of mock.calls) {
    assert.equal(call.hasAuth, true)
  }

  const clientDir = path.join(root, "dist/_astro")
  try {
    for (const name of await fs.readdir(clientDir)) {
      if (!/\.(js|css|mjs)$/.test(name)) continue
      const text = await fs.readFile(path.join(clientDir, name), "utf8")
      assert.ok(!text.includes(PLACEHOLDER))
    }
  } catch {
    /* optional */
  }
})
