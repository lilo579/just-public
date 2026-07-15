import { spawn } from "node:child_process"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

/**
 * @param {number} port
 * @param {Record<string, string>} vars
 */
export function startWrangler(port, vars) {
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
export function requestWithHost(port, hostHeader, reqPath = "/") {
  return new Promise((resolve, reject) => {
    const started = Date.now()
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
            headers: res.headers,
            body,
            ms: Date.now() - started,
          }),
        )
      },
    )
    req.on("error", reject)
    req.end()
  })
}

/** @param {string} html */
export function extractAssetUrls(html) {
  /** @type {Set<string>} */
  const urls = new Set()
  for (const m of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const u = m[1]
    if (!u.startsWith("/") || u.startsWith("//")) continue
    if (u.startsWith("/?")) continue
    urls.add(u.split("?")[0])
  }
  return [...urls].sort()
}

/**
 * @param {import("../fixtures/poc-canonical-payloads.mjs").TENANT_ALPHA | object} tenant
 * @param {{ status: number, body: string }} res
 */
export function assertTenantHtml(tenant, res, assert) {
  assert.equal(res.status, 200)
  assert.match(res.body, /data-renderer="canonical"/)
  assert.doesNotMatch(res.body, /data-renderer="legacy"|data-legacy-fallback/)
  assert.match(res.body, new RegExp(escapeRe(tenant.companyName)))
  assert.match(res.body, new RegExp(escapeRe(tenant.email)))
  assert.match(res.body, new RegExp(escapeRe(tenant.phone)))
  assert.match(
    res.body,
    new RegExp(`--site-color-primary:${escapeRe(tenant.primaryColor)}`, "i"),
  )
  assert.match(
    res.body,
    new RegExp(`--site-color-secondary:${escapeRe(tenant.secondaryColor)}`, "i"),
  )
}

/**
 * Ensure HTML for `tenant` contains none of the other tenants' fingerprints.
 * @param {object} tenant
 * @param {object[]} others
 * @param {{ body: string }} res
 */
export function assertNoCrossTenant(tenant, others, res, assert) {
  for (const other of others) {
    if (other.key === tenant.key) continue
    assert.doesNotMatch(res.body, new RegExp(escapeRe(other.companyName)))
    assert.doesNotMatch(res.body, new RegExp(escapeRe(other.email)))
    assert.doesNotMatch(res.body, new RegExp(escapeRe(other.phone)))
    assert.doesNotMatch(
      res.body,
      new RegExp(`--site-color-primary:${escapeRe(other.primaryColor)}`, "i"),
    )
    assert.doesNotMatch(res.body, new RegExp(escapeRe(other.tenantId)))
    assert.doesNotMatch(res.body, new RegExp(escapeRe(other.slug)))
  }
}

/** @param {string} s */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export { root }
