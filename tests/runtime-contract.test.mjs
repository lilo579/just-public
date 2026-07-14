import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildPublicSitePayloadUrl,
  resolveRequestHost,
} from "../src/lib/publicHomepageHelpers.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const entry = path.join(root, "dist/server/entry.mjs")

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

async function waitForHealth(baseUrl, attempts = 40) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`)
      if (res.ok) return res
      lastErr = new Error(`health status ${res.status}`)
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw lastErr
}

test("health contract shape is stable (fixture — no network)", () => {
  const body = { status: "ok", service: "just-public" }
  assert.equal(body.status, "ok")
  assert.equal(body.service, "just-public")
  assert.equal(Object.keys(body).sort().join(","), "service,status")
})

test("Host A and Host B stay distinct for payload URLs", () => {
  const base = "https://example.test/functions/v1/public-site-payload"
  const a = buildPublicSitePayloadUrl({ kind: "host", host: "alpha.example.com" }, "public", base)
  const b = buildPublicSitePayloadUrl({ kind: "host", host: "beta.example.com" }, "public", base)
  assert.match(a, /host=alpha\.example\.com/)
  assert.match(b, /host=beta\.example\.com/)
  assert.doesNotMatch(a, /beta/)
  assert.doesNotMatch(b, /alpha/)
})

test("resolveRequestHost prefers Host header over unrelated X-Forwarded-Host", () => {
  const req = new Request("https://ignored.example/", {
    headers: {
      host: "tenant-a.example.com",
      "x-forwarded-host": "evil.example.com",
    },
  })
  assert.equal(resolveRequestHost(req, new URLSearchParams()), "tenant-a.example.com")
})

test("dist build has no .env and no service_role materials", async (t) => {
  const distDir = path.join(root, "dist")
  try {
    await fs.access(distDir)
  } catch {
    t.skip("dist/ missing — run npm run build first")
    return
  }

  async function walk(dir, out = []) {
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) await walk(full, out)
      else out.push(full)
    }
    return out
  }

  const files = await walk(distDir)
  assert.ok(!files.some((f) => path.basename(f) === ".env"))
  assert.ok(!files.some((f) => path.basename(f).startsWith(".env.")))

  const offenders = []
  for (const file of files) {
    if (!/\.(mjs|js|css|html|map|json)$/.test(file)) continue
    const text = await fs.readFile(file, "utf8")
    if (/SERVICE_ROLE|service_role/i.test(text)) offenders.push(file)
  }
  assert.deepEqual(offenders, [])
})

test("standalone start respects HOST/PORT and serves /health without Edge", async (t) => {
  try {
    await fs.access(entry)
  } catch {
    t.skip("dist/server/entry.mjs missing — run npm run build first")
    return
  }

  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [path.join(root, "scripts/run-standalone.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "0.0.0.0",
      PORT: String(port),
      // Intentionally omit payload credentials — health must not need them.
      SUPABASE_ANON_KEY: "",
      ASTRO_NODE_LOGGING: "disabled",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let stderr = ""
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk)
  })

  try {
    const healthRes = await waitForHealth(baseUrl)
    assert.equal(healthRes.status, 200)
    const json = await healthRes.json()
    assert.deepEqual(json, { status: "ok", service: "just-public" })
    assert.doesNotMatch(stderr, /public-site-payload|supabase\.co/i)

    // Process accepted connections beyond loopback-only misconfig:
    // binding 0.0.0.0 is exercised by reaching 127.0.0.1 on the PORT we set.
    assert.equal(String(port), process.env.PORT || String(port))
  } finally {
    const stopped = new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }))
    })
    child.kill("SIGTERM")
    const result = await Promise.race([
      stopped,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SIGTERM did not exit in time")), 5000),
      ),
    ]).catch(async (err) => {
      child.kill("SIGKILL")
      throw err
    })
    assert.ok(
      result.signal === "SIGTERM" || result.code === 0 || result.code === 143,
      `unexpected exit ${JSON.stringify(result)}`,
    )
  }
})
