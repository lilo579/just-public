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
/** Active POC runtime (Cloudflare Workers) after `astro build`. */
const cloudflareWorkerEntry = path.join(root, "dist/_worker.js/index.js")
/** Node contingency entry — not produced by `@astrojs/cloudflare` builds. */
const nodeStandaloneEntry = path.join(root, "dist/server/entry.mjs")

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

async function walk(dir, out = []) {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) await walk(full, out)
    else out.push(full)
  }
  return out
}

/** Collect non-empty secret-like values from local env files without logging them. */
async function loadLocalSecretValues() {
  const candidates = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
    ".dev.vars",
  ]
  const values = []
  for (const name of candidates) {
    let text
    try {
      text = await fs.readFile(path.join(root, name), "utf8")
    } catch {
      continue
    }
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let raw = trimmed.slice(eq + 1).trim()
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        raw = raw.slice(1, -1)
      }
      if (raw.length < 8) continue
      // Do not treat public/client bind vars as secrets (anon JWT bake is env-model Slice 2).
      if (/^(HOST|PORT|NODE_ENV|PUBLIC_DEPLOY_ENV)$/i.test(key)) continue
      if (/^PUBLIC_/i.test(key) || /ANON/i.test(key)) continue
      values.push({ source: name, key })
      // Store value separately so assertion messages never embed it.
      Object.defineProperty(values[values.length - 1], "value", {
        value: raw,
        enumerable: false,
      })
    }
  }
  return values
}

function decodeJwtPayloadJson(token) {
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4))
    return JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8"))
  } catch {
    return null
  }
}

/** True when a JWT-like token carries role service_role (secret), not anon/authenticated alone. */
function isServiceRoleJwt(token) {
  const payload = decodeJwtPayloadJson(token)
  if (!payload || typeof payload !== "object") return false
  return payload.role === "service_role"
}

/**
 * Assignment / config injection of a real SUPABASE_SERVICE_ROLE_KEY value.
 * Mentions in comments, JSDoc, or bare identifier names alone do not match.
 */
function hasServiceRoleKeyInjection(text) {
  const patterns = [
    /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*["'`][^"'`\s]+["'`]/,
    /\bSUPABASE_SERVICE_ROLE_KEY\s*:\s*["'`][^"'`\s]+["'`]/,
    /["'`]SUPABASE_SERVICE_ROLE_KEY["'`]\s*:\s*["'`][^"'`\s]+["'`]/,
  ]
  return patterns.some((re) => re.test(text))
}

test("health contract shape is stable (fixture — no network)", () => {
  const body = {
    status: "ok",
    service: "just-public",
    canonicalContractVersion: "seo001-v1",
    features: {
      canonicalRedirects: true,
      requestScopedAuthority: true,
      sharedAuthorityCache: false,
    },
  }
  assert.equal(body.status, "ok")
  assert.equal(body.service, "just-public")
  assert.equal(body.canonicalContractVersion, "seo001-v1")
  assert.equal(body.features.sharedAuthorityCache, false)
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

test("resolveRequestHost prefers URL.hostname and ignores X-Forwarded-Host", () => {
  const req = new Request("https://tenant-a.example.com/", {
    headers: {
      host: "other.example.com",
      "x-forwarded-host": "evil.example.com",
    },
  })
  assert.equal(resolveRequestHost(req, new URLSearchParams()), "tenant-a.example.com")
})

test("Cloudflare Worker artifact and assets directory exist after build", async (t) => {
  const distDir = path.join(root, "dist")
  try {
    await fs.access(distDir)
  } catch {
    t.skip("dist/ missing — run npm run build first")
    return
  }

  await fs.access(cloudflareWorkerEntry)
  const workerStat = await fs.stat(cloudflareWorkerEntry)
  assert.ok(workerStat.isFile(), "dist/_worker.js/index.js must be a file")

  // Assets live alongside the Worker under dist/ (Wrangler assets.directory).
  const distEntries = await fs.readdir(distDir)
  assert.ok(
    distEntries.includes("_astro"),
    "expected Static Assets under dist/ (_astro)",
  )
  assert.ok(
    !distEntries.includes("favicon.ico") && !distEntries.includes("favicon.svg"),
    "Astro scaffold favicons must not ship as Static Assets",
  )
  assert.ok(
    !(await fs
      .access(nodeStandaloneEntry)
      .then(() => true)
      .catch(() => false)),
    "Cloudflare build must not emit Node contingency entry dist/server/entry.mjs",
  )
})

test("dist has no embedded local secrets or service_role JWT/config injection", async (t) => {
  const distDir = path.join(root, "dist")
  try {
    await fs.access(distDir)
  } catch {
    t.skip("dist/ missing — run npm run build first")
    return
  }

  const files = await walk(distDir)
  assert.ok(!files.some((f) => path.basename(f) === ".env"))
  assert.ok(!files.some((f) => path.basename(f).startsWith(".env.")))
  assert.ok(!files.some((f) => path.basename(f) === ".dev.vars"))

  const localSecrets = await loadLocalSecretValues()
  const jwtRe = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g

  /** @type {string[]} */
  const findings = []

  for (const file of files) {
    if (!/\.(mjs|js|css|html|map|json)$/.test(file)) continue
    const text = await fs.readFile(file, "utf8")
    const rel = path.relative(root, file)

    for (const secret of localSecrets) {
      if (text.includes(secret.value)) {
        // Report key + source file name only — never the secret value.
        findings.push(`${rel}: embedded value from ${secret.source} (${secret.key})`)
      }
    }

    if (hasServiceRoleKeyInjection(text)) {
      findings.push(`${rel}: SUPABASE_SERVICE_ROLE_KEY string assignment/config injection`)
    }

    const tokens = text.match(jwtRe) ?? []
    for (const token of tokens) {
      if (isServiceRoleJwt(token)) {
        findings.push(`${rel}: JWT with role service_role`)
        break
      }
    }
  }

  assert.equal(
    findings.length,
    0,
    findings.length
      ? `secret risk findings (${findings.length}): ${findings.join("; ")}`
      : undefined,
  )
})

test("Node contingency standalone /health (skipped when Cloudflare is active build)", async (t) => {
  try {
    await fs.access(nodeStandaloneEntry)
  } catch {
    t.skip(
      "Node contingency: dist/server/entry.mjs not produced by active @astrojs/cloudflare build",
    )
    return
  }

  // Only runs if a Node standalone layout is present (legacy contingency rebuild).
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [path.join(root, "scripts/run-standalone.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "0.0.0.0",
      PORT: String(port),
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
