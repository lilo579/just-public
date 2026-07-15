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
const PLACEHOLDER_SECRET = "poc-slice2-secret-placeholder-do-not-ship"

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

async function waitForHealth(port, attempts = 100) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) return res
      lastErr = new Error(`status ${res.status}`)
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw lastErr
}

function startMockPayloadServer() {
  /** @type {{ method: string, url: string }[]} */
  const requests = []
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method ?? "GET", url: req.url ?? "/" })
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ mock: true }))
  })
  return {
    requests,
    async listen() {
      const port = await freePort()
      await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve))
      return { port, baseUrl: `http://127.0.0.1:${port}` }
    },
    async close() {
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    },
  }
}

/**
 * @param {{ port: number, vars?: Record<string, string> }} opts
 */
function startWrangler({ port, vars = {} }) {
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
    {
      cwd: root,
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (c) => {
    stdout += String(c)
  })
  child.stderr.on("data", (c) => {
    stderr += String(c)
  })

  return {
    child,
    get output() {
      return `${stdout}\n${stderr}`
    },
    async ready() {
      await waitForHealth(port)
    },
    async stop() {
      if (child.killed || child.exitCode !== null) return
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
 * @param {{
 *   deployEnv?: string
 *   mockPayloadUrl: string
 *   expectRobots: boolean
 *   mock: ReturnType<typeof startMockPayloadServer>
 * }} opts
 */
async function probeHealth({ deployEnv, mockPayloadUrl, expectRobots, mock }) {
  const port = await freePort()
  /** @type {Record<string, string>} */
  const vars = {
    PUBLIC_SITE_PAYLOAD_URL: mockPayloadUrl,
    SUPABASE_ANON_KEY: PLACEHOLDER_SECRET,
  }
  if (deployEnv !== undefined) vars.DEPLOY_ENV = deployEnv

  const wrangler = startWrangler({ port, vars })
  try {
    await wrangler.ready()
    const before = mock.requests.length
    const res = await fetch(`http://127.0.0.1:${port}/health`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get("content-type") ?? "", /application\/json/)
    assert.deepEqual(await res.json(), { status: "ok", service: "just-public" })
    if (expectRobots) {
      assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow")
    } else {
      assert.equal(res.headers.get("x-robots-tag"), null)
    }
    assert.equal(
      mock.requests.length,
      before,
      "GET /health must not call the local payload mock",
    )
    assert.doesNotMatch(wrangler.output, /ehondnpqztvybvgsjnxe\.supabase\.co/)
    assert.doesNotMatch(wrangler.output, /nodejs_compat/)
    assert.doesNotMatch(
      wrangler.output,
      /Invalid binding `SESSION`|KV namespace.*SESSION/i,
    )
  } finally {
    await wrangler.stop()
  }
}

test("workerd /health proves env runtime, no external I/O, preview/staging robots matrix", async (t) => {
  try {
    await fs.access(workerEntry)
  } catch {
    t.skip("dist/_worker.js/index.js missing — run npm run build first")
    return
  }

  const mock = startMockPayloadServer()
  const { baseUrl } = await mock.listen()
  const mockPayloadUrl = `${baseUrl}/mock-public-site-payload`
  t.after(async () => {
    await mock.close()
  })

  await probeHealth({
    deployEnv: "preview",
    mockPayloadUrl,
    expectRobots: true,
    mock,
  })
  await probeHealth({
    deployEnv: "staging",
    mockPayloadUrl,
    expectRobots: true,
    mock,
  })
  await probeHealth({
    deployEnv: "production",
    mockPayloadUrl,
    expectRobots: false,
    mock,
  })
  // Project wrangler.jsonc binds DEPLOY_ENV=preview for CF-003; probe an unknown
  // override so "no automatic app robots" is covered without relying on unset.
  await probeHealth({
    deployEnv: "qa",
    mockPayloadUrl,
    expectRobots: false,
    mock,
  })

  assert.equal(mock.requests.length, 0, "entire health suite must leave mock untouched")

  const clientAssetsDir = path.join(root, "dist/_astro")
  try {
    await fs.access(clientAssetsDir)
    async function walk(dir, out = []) {
      for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) await walk(full, out)
        else out.push(full)
      }
      return out
    }
    for (const file of await walk(clientAssetsDir)) {
      if (!/\.(js|css|mjs|map)$/.test(file)) continue
      const text = await fs.readFile(file, "utf8")
      assert.ok(!text.includes(PLACEHOLDER_SECRET))
    }
  } catch {
    /* optional client asset dir */
  }
})
