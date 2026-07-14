import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import http from "node:http"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-slice3-anon-placeholder-not-real"

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (!addr || typeof addr === "string") {
        server.close()
        reject(new Error("no port"))
        return
      }
      const { port } = addr
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

function startMock() {
  /** @type {{ pathname: string, host: string | null, mode: string | null, hasAuth: boolean }[]} */
  const calls = []
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1")
    calls.push({
      pathname: u.pathname,
      host: u.searchParams.get("host"),
      mode: u.searchParams.get("mode"),
      hasAuth: Boolean(req.headers.authorization),
    })
    res.writeHead(200, { "content-type": "application/json" })
    // Minimal body — host identity only; renderer not under test.
    res.end(
      JSON.stringify({
        serializablePlan: { recipeId: "mock", nodes: [] },
        blocks: [],
      }),
    )
  })
  return {
    calls,
    async listen() {
      const port = await freePort()
      await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve))
      return { port, baseUrl: `http://127.0.0.1:${port}/mock-public-site-payload` }
    },
    async close() {
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    },
  }
}

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

test("workerd host resolution: alpha/beta isolation, normalization, invalids skip fetch", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const mock = startMock()
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

  /**
   * Node fetch/undici ignores a custom Host header; use raw HTTP like curl -H Host.
   * @param {string} hostHeader
   * @param {string} [reqPath]
   */
  function hit(hostHeader, reqPath = "/") {
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
          res.resume()
          res.on("end", () => resolve({ status: res.statusCode ?? 0 }))
        },
      )
      req.on("error", reject)
      req.end()
    })
  }

  mock.calls.length = 0
  await hit("alpha.justwebsites.com.br")
  await hit("beta.justwebsites.com.br")
  await hit("tenant.com.br")
  await hit("www.tenant.com.br")
  await hit("ALPHA.JUSTWEBSITES.COM.BR")
  await hit("alpha.justwebsites.com.br:8793")
  await hit("alpha.justwebsites.com.br.")
  // ?host= uses request URL; Node fetch is fine here (no custom Host needed).
  await fetch(`http://127.0.0.1:${port}/?host=alpha.justwebsites.com.br`)
  const hosts = mock.calls.map((c) => c.host)
  assert.ok(hosts.includes("alpha.justwebsites.com.br"))
  assert.ok(hosts.includes("beta.justwebsites.com.br"))
  assert.ok(hosts.includes("tenant.com.br"))
  assert.ok(hosts.includes("www.tenant.com.br"))

  const alphaCalls = mock.calls.filter((c) => c.host === "alpha.justwebsites.com.br")
  const betaCalls = mock.calls.filter((c) => c.host === "beta.justwebsites.com.br")
  assert.ok(alphaCalls.length >= 1)
  assert.ok(betaCalls.length >= 1)
  for (const c of alphaCalls) {
    assert.notEqual(c.host, "beta.justwebsites.com.br")
  }
  for (const c of betaCalls) {
    assert.notEqual(c.host, "alpha.justwebsites.com.br")
  }
  assert.ok(
    mock.calls.some((c) => c.host === "tenant.com.br") &&
      mock.calls.some((c) => c.host === "www.tenant.com.br"),
  )
  assert.ok(
    !hosts.some((h) => h && h.includes(":")),
    "ports must be stripped before payload",
  )
  assert.ok(!hosts.includes("alpha.justwebsites.com.br."))
  assert.ok(!hosts.includes("ALPHA.JUSTWEBSITES.COM.BR"))

  for (const c of mock.calls) {
    assert.equal(c.mode, "public")
    assert.equal(c.hasAuth, true)
  }

  const beforeInvalid = mock.calls.length
  const invalidPaths = [
    "/?host=",
    `/?host=${encodeURIComponent("https://alpha.justwebsites.com.br")}`,
    `/?host=${encodeURIComponent("alpha.justwebsites.com.br/path")}`,
    `/?host=${encodeURIComponent("alpha host")}`,
  ]
  for (const p of invalidPaths) {
    const res = await hit("127.0.0.1:"+port, p)
    assert.equal(res.status, 400)
  }
  assert.equal(mock.calls.length, beforeInvalid, "invalid hosts must not fetch mock")

  // Empty runtime payload URL → 503 before fetch (overrides local .env via --var).
  await wrangler.stop()
  const portMissing = await freePort()
  const wranglerMissing = startWrangler(portMissing, {
    DEPLOY_ENV: "staging",
    SUPABASE_ANON_KEY: PLACEHOLDER,
    PUBLIC_SITE_PAYLOAD_URL: "",
  })
  t.after(async () => {
    await wranglerMissing.stop()
  })
  await wranglerMissing.ready()
  const beforeMissing = mock.calls.length
  const missing = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: portMissing,
        path: "/",
        headers: { Host: "alpha.justwebsites.com.br" },
      },
      (res) => {
        let body = ""
        res.on("data", (c) => {
          body += String(c)
        })
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }))
      },
    )
    req.on("error", reject)
    req.end()
  })
  assert.equal(missing.status, 503)
  assert.match(missing.body, /PUBLIC_SITE_PAYLOAD_URL missing/)
  assert.equal(mock.calls.length, beforeMissing)
  await wranglerMissing.stop()

  assert.doesNotMatch(wrangler.output, /ehondnpqztvybvgsjnxe\.supabase\.co/)
  assert.doesNotMatch(wrangler.output, /nodejs_compat/)

  // Placeholder must not appear in client assets.
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
