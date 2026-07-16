import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { TENANT_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PLACEHOLDER = "poc-ft005b-anon-placeholder"

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
 * @param {string} reqPath
 * @param {string} [hostHeader]
 */
function request(port, reqPath, hostHeader = TENANT_ALPHA.host) {
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
            cache: res.headers["cache-control"] ?? null,
            body,
          }),
        )
      },
    )
    req.on("error", reject)
    req.end()
  })
}

test("FT-005B workerd: staging HTML no-store; health no-store; hashed CSS immutable; favicon not long-immutable", async (t) => {
  await fs.access(path.join(root, "dist/_worker.js/index.js"))
  const headersFile = await fs.readFile(path.join(root, "dist/_headers"), "utf8")
  assert.match(headersFile, /\/_astro\/\*/)
  assert.match(headersFile, /max-age=31536000,\s*immutable/)

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

  const health = await request(port, "/health")
  assert.equal(health.status, 200)
  assert.equal(health.cache, "no-store")

  const html = await request(port, "/")
  assert.equal(html.status, 200)
  assert.equal(html.cache, "no-store")
  assert.doesNotMatch(String(html.cache), /s-maxage/i)

  const invalid = await request(port, "/?host=bad/host")
  assert.equal(invalid.status, 400)
  assert.equal(invalid.cache, "no-store")

  const cssMatch = html.body.match(/href="(\/_astro\/[^"]+\.css)"/)
  assert.ok(cssMatch, "expected hashed css in HTML")
  const css = await request(port, cssMatch[1])
  assert.equal(css.status, 200)
  assert.match(String(css.cache), /max-age=31536000/i)
  assert.match(String(css.cache), /immutable/i)

  const favicon = await request(port, "/favicon.ico")
  assert.equal(favicon.status, 200)
  assert.doesNotMatch(String(favicon.cache ?? ""), /immutable/i)
  assert.doesNotMatch(String(favicon.cache ?? ""), /31536000/)

  const missingAsset = await request(port, "/_astro/does-not-exist-ft005b.css")
  assert.notEqual(missingAsset.status, 200)
  assert.doesNotMatch(String(missingAsset.cache ?? ""), /immutable/i)
})

test("FT-005B workerd: production HTML must-revalidate without s-maxage", async (t) => {
  await fs.access(path.join(root, "dist/_worker.js/index.js"))
  const mock = startCanonicalPayloadMock()
  const { baseUrl: mockUrl } = await mock.listen()
  const port = await freePort()
  const wrangler = startWrangler(port, {
    DEPLOY_ENV: "production",
    PUBLIC_SITE_PAYLOAD_URL: mockUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER,
  })

  t.after(async () => {
    await wrangler.stop()
    await mock.close()
  })

  await wrangler.ready()

  const html = await request(port, "/")
  assert.equal(html.status, 200)
  assert.equal(html.cache, "public, max-age=0, must-revalidate")
  assert.doesNotMatch(String(html.cache), /s-maxage/i)

  const health = await request(port, "/health")
  assert.equal(health.cache, "no-store")
})
