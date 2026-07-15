/**
 * CF-004 — workerd validation of dual-gated POC fixtures (no external mock / Supabase).
 */
import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import http from "node:http"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  TENANT_ALPHA,
  TENANT_BETA,
  TENANT_GAMMA,
} from "../src/poc/publicSiteFixtures.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const workerEntry = path.join(root, "dist/_worker.js/index.js")

const TENANTS = [TENANT_ALPHA, TENANT_BETA, TENANT_GAMMA]
const BY_KEY = {
  alpha: TENANT_ALPHA,
  beta: TENANT_BETA,
  gamma: TENANT_GAMMA,
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address()
      if (!addr || typeof addr === "string") {
        s.close()
        reject(new Error("no port"))
        return
      }
      const { port } = addr
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

function startWrangler(port, vars) {
  /** Ensure fixture gate-off tests hit controlled 503, not a local .env payload URL. */
  const merged = {
    PUBLIC_SITE_PAYLOAD_URL: "",
    SUPABASE_ANON_KEY: "",
    ...vars,
  }
  const varArgs = Object.entries(merged).flatMap(([k, v]) => ["--var", `${k}:${v}`])
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
    {
      cwd: root,
      env: {
        ...process.env,
        CI: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
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
      for (let i = 0; i < 120; i++) {
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
 * @param {number} port
 * @param {string} pathAndQuery
 * @param {{ Host?: string }} [headers]
 */
function request(port, pathAndQuery, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathAndQuery,
        method: "GET",
        headers,
      },
      (res) => {
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        })
      },
    )
    req.on("error", reject)
    req.end()
  })
}

function assertTenant(tenant, res) {
  assert.equal(res.status, 200)
  assert.equal(res.body.match(/data-renderer="([^"]+)"/)?.[1], "canonical")
  assert.match(res.body, new RegExp(tenant.companyName))
  assert.match(res.body, new RegExp(tenant.email.replace(".", "\\.")))
  assert.match(res.body, new RegExp(tenant.primaryColor, "i"))
  assert.doesNotMatch(res.body, /data-legacy-fallback/)
  assert.match(res.body, /data-lead-form-safe="true"|lead-form--safe|Envio desativado neste preview/)
  assert.doesNotMatch(res.body, /service_role|SUPABASE_SERVICE_ROLE/i)
  assert.doesNotMatch(res.body, /ehondnpqztvybvgsjnxe\.supabase\.co/)
  for (const other of TENANTS) {
    if (other.key === tenant.key) continue
    assert.doesNotMatch(res.body, new RegExp(other.companyName))
    assert.doesNotMatch(res.body, new RegExp(other.email.replace(".", "\\.")))
  }
}

test("workerd CF-004 fixtures: gates off → controlled missing payload (no fixture)", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const cases = [
    { DEPLOY_ENV: "production", POC_FIXTURE_MODE: "true" },
    { DEPLOY_ENV: "preview", POC_FIXTURE_MODE: "false" },
    { DEPLOY_ENV: "staging", POC_FIXTURE_MODE: "true" },
    // Override wrangler.jsonc preview binding with empty → treat as absent deploy env.
    { DEPLOY_ENV: "", POC_FIXTURE_MODE: "true" },
  ]

  for (const vars of cases) {
    const port = await freePort()
    const wrangler = startWrangler(port, vars)
    try {
      await wrangler.ready()
      const res = await request(port, `/?host=${TENANT_ALPHA.host}`)
      assert.equal(res.status, 503, JSON.stringify(vars))
      assert.match(res.body, /PUBLIC_SITE_PAYLOAD_URL missing/)
      assert.doesNotMatch(res.body, /Alpha Consulting/)
      assert.doesNotMatch(wrangler.output, /ehondnpqztvybvgsjnxe\.supabase\.co/)
    } finally {
      await wrangler.stop()
    }
  }
})

test("workerd CF-004 fixtures: preview+true → A/B/G isolation, sequence, concurrency", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "preview",
    POC_FIXTURE_MODE: "true",
  })
  t.after(async () => {
    await wrangler.stop()
  })
  await wrangler.ready()

  for (const tenant of TENANTS) {
    const res = await request(port, `/?host=${tenant.host}`)
    assertTenant(tenant, res)
    assert.equal(res.headers["x-robots-tag"], "noindex, nofollow")
  }

  const seq = ["alpha", "beta", "gamma", "alpha"]
  for (const key of seq) {
    const res = await request(port, `/?host=${BY_KEY[key].host}`)
    assertTenant(BY_KEY[key], res)
  }

  const concurrent = await Promise.all(
    ["alpha", "beta", "gamma"].map((key) =>
      request(port, `/?host=${BY_KEY[key].host}`).then((res) => ({ key, res })),
    ),
  )
  for (const { key, res } of concurrent) {
    assertTenant(BY_KEY[key], res)
  }

  const unknown = await request(port, "/?host=unknown.justwebsites.com.br")
  assert.equal(unknown.status, 404)

  const invalid = await request(port, "/?host=https://alpha.justwebsites.com.br")
  assert.equal(invalid.status, 400)

  const cssList = await fs.readdir(path.join(root, "dist/_astro"))
  const css = cssList.find((n) => n.endsWith(".css"))
  assert.ok(css)
  const asset = await request(port, `/_astro/${css}`)
  assert.equal(asset.status, 200)
  assert.match(asset.headers["content-type"] ?? "", /css/)
  assert.doesNotMatch(asset.body, /Alpha Consulting|Beta Studio|Gamma Labs/)

  const workerJs = await request(port, "/_worker.js/index.js")
  assert.equal(workerJs.status, 404)

  assert.doesNotMatch(wrangler.output, /nodejs_compat/)
  assert.doesNotMatch(wrangler.output, /ehondnpqztvybvgsjnxe\.supabase\.co/)
})
