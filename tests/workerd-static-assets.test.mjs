import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { TENANT_ALPHA, TENANT_BETA } from "./fixtures/poc-canonical-payloads.mjs"
import { freePort, startCanonicalPayloadMock } from "./helpers/poc-payload-mock.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const workerEntry = path.join(root, "dist/_worker.js/index.js")
const PLACEHOLDER = "poc-slice5-anon-placeholder-not-real"
const LEADS_HOST = "ehondnpqztvybvgsjnxe.supabase.co"

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
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          const buf = Buffer.concat(chunks)
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: buf.toString("utf8"),
            size: buf.length,
          })
        })
      },
    )
    req.on("error", reject)
    req.end()
  })
}

/**
 * Asset fetch without custom Host (Static Assets binding).
 * @param {number} port
 * @param {string} assetPath
 */
function fetchAsset(port, assetPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: assetPath,
        method: "GET",
      },
      (res) => {
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          const buf = Buffer.concat(chunks)
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: buf.toString("utf8"),
            size: buf.length,
          })
        })
      },
    )
    req.on("error", reject)
    req.end()
  })
}

/** @param {string} html */
function extractAssetUrls(html) {
  /** @type {Set<string>} */
  const urls = new Set()
  for (const m of html.matchAll(
    /(?:href|src)=["']([^"']+)["']/gi,
  )) {
    const u = m[1]
    if (!u.startsWith("/") || u.startsWith("//")) continue
    if (u.startsWith("/?")) continue
    urls.add(u.split("?")[0])
  }
  for (const m of html.matchAll(/url\((['"]?)(\/[^)'"]+)\1\)/gi)) {
    urls.add(m[2].split("?")[0])
  }
  return [...urls]
}

test("build inventory: public Static Assets vs Worker internals", async (t) => {
  try {
    await fs.access(path.join(root, "dist"))
  } catch {
    t.skip("dist/ missing — run npm run build first")
    return
  }

  const routes = JSON.parse(await fs.readFile(path.join(root, "dist/_routes.json"), "utf8"))
  assert.ok(Array.isArray(routes.exclude))
  assert.ok(routes.exclude.includes("/_astro/*"))
  // Favicons are Worker routes (tenant redirect) — must NOT be static-asset excludes.
  assert.ok(!routes.exclude.includes("/favicon.ico"))
  assert.ok(!routes.exclude.includes("/favicon.svg"))

  const wrangler = await fs.readFile(path.join(root, "wrangler.jsonc"), "utf8")
  assert.match(wrangler, /"directory":\s*".\/dist"/)
  assert.match(wrangler, /"binding":\s*"ASSETS"/)
  assert.match(wrangler, /"main":\s*".\/dist\/_worker\.js\/index\.js"/)
  assert.doesNotMatch(wrangler, /nodejs_compat/)
  assert.doesNotMatch(wrangler, /kv_namespaces|not_found_handling|"spa"/i)
  assert.doesNotMatch(wrangler, /cache.?control|html.?cache/i)

  const assetsIgnore = await fs.readFile(path.join(root, "dist/.assetsignore"), "utf8")
  assert.match(assetsIgnore, /_worker\.js/)

  const astroFiles = await fs.readdir(path.join(root, "dist/_astro"))
  assert.ok(astroFiles.some((f) => f.endsWith(".css")))
  assert.ok(!astroFiles.some((f) => /\.(m?js)$/.test(f)), "no per-chunk JS under _astro in current build")
  await fs.access(path.join(root, "dist/_astro")).catch(() => {
    throw new Error("expected dist/_astro")
  })
  // Astro scaffold favicons must not ship as Static Assets.
  await assert.rejects(fs.access(path.join(root, "dist/favicon.ico")))
  await assert.rejects(fs.access(path.join(root, "dist/favicon.svg")))
  await fs.access(workerEntry)

  for (const name of astroFiles) {
    const text = await fs.readFile(path.join(root, "dist/_astro", name), "utf8")
    assert.doesNotMatch(text, /Alpha Consulting|Beta Studio/)
    assert.doesNotMatch(text, /#112233|#aa5500/i)
    assert.doesNotMatch(text, /alpha@example\.test|beta@example\.test/)
    assert.doesNotMatch(text, /SUPABASE_SERVICE_ROLE|service_role/i)
    assert.doesNotMatch(text, /tenant_alpha|tenant_beta|00000000-0000-4000/)
  }
})

test("workerd Static Assets: MIME, isolation, 404, traversal, no payload/leads I/O", async (t) => {
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

  const alphaHtml = await requestWithHost(port, TENANT_ALPHA.host)
  const betaHtml = await requestWithHost(port, TENANT_BETA.host)
  assert.equal(alphaHtml.status, 200)
  assert.equal(betaHtml.status, 200)
  assert.match(alphaHtml.body, /--site-color-primary:#112233/)
  assert.match(betaHtml.body, /--site-color-primary:#aa5500/)
  assert.match(alphaHtml.body, /data-site-theme/)
  assert.match(betaHtml.body, /data-site-theme/)

  const alphaAssets = extractAssetUrls(alphaHtml.body)
  const betaAssets = extractAssetUrls(betaHtml.body)
  assert.deepEqual(
    [...alphaAssets].sort(),
    [...betaAssets].sort(),
    "Alpha and Beta must reference the same shared asset URL set",
  )

  for (const url of alphaAssets) {
    assert.doesNotMatch(url, /tenant_|alpha\.|beta\.|justwebsites|example\.test/i)
    assert.doesNotMatch(url, /4321|entry\.mjs|dist\/server/)
    assert.ok(
      url.startsWith("/_astro/") ||
        url.startsWith("/favicon") ||
        url === "/" ||
        url.startsWith("/#"),
      `unexpected asset URL shape: ${url}`,
    )
  }

  const cssUrls = alphaAssets.filter((u) => u.endsWith(".css"))
  const jsUrls = alphaAssets.filter((u) => /\.(m?js)$/.test(u))
  assert.ok(cssUrls.length >= 1, "expected at least one stylesheet in HTML")

  const inventory = []
  for (const url of [...cssUrls, ...jsUrls]) {
    const res = await fetchAsset(port, url)
    const ct = String(res.headers["content-type"] ?? "")
    inventory.push({
      url,
      status: res.status,
      mime: ct,
      size: res.size,
      cache: res.headers["cache-control"] ?? null,
      etag: res.headers.etag ?? null,
    })

    assert.equal(res.status, 200, `${url} should be 200`)
    assert.ok(res.size > 0, `${url} should be non-empty`)

    if (url.endsWith(".css")) {
      assert.match(ct, /text\/css/i)
      assert.doesNotMatch(res.body, /Alpha Consulting|Beta Studio/)
      assert.doesNotMatch(res.body, /#112233|#aa5500/i)
      assert.doesNotMatch(res.body, /SUPABASE_SERVICE_ROLE|service_role/i)
      assert.doesNotMatch(res.body, new RegExp(PLACEHOLDER))
      // Shared CSS should contain stylesheet content (selectors/properties).
      assert.match(res.body, /[{;]|--|\.|#/)
    }
    if (/\.(m?js)$/.test(url)) {
      assert.match(ct, /javascript|ecmascript/i)
      assert.doesNotMatch(res.body, /SUPABASE_SERVICE_ROLE|service_role/i)
      assert.doesNotMatch(res.body, /Alpha Consulting|Beta Studio/)
    }

    assert.doesNotMatch(url, /localhost:|127\.0\.0\.1:4321/)
  }

  // Favicons are Worker redirects to tenant brand assets (no Astro scaffold in dist).
  for (const url of ["/favicon.ico", "/favicon.svg"]) {
    const res = await requestWithHost(port, TENANT_ALPHA.host, url)
    assert.ok(
      res.status === 302 || res.status === 404,
      `${url} should be tenant redirect or 404 when no brand asset (got ${res.status})`,
    )
    if (res.status === 302) {
      const location = String(res.headers.location ?? "")
      assert.ok(location.startsWith("http"), `${url} Location must be absolute brand URL`)
      // Reject only root Astro scaffold — packaged /branding/*/favicon.* is valid.
      assert.doesNotMatch(location, /:\/\/[^/]+\/favicon\.(ico|svg)(\?|$)/)
    }
  }

  // Headers snapshot for report (first CSS).
  assert.ok(inventory.some((i) => i.url.endsWith(".css") && i.status === 200))

  const afterHtmlCalls = mock.calls.length

  const missing = await fetchAsset(port, "/_astro/does-not-exist.js")
  assert.equal(missing.status, 404)
  // Controlled 404 page (Astro) is OK; must not be tenant homepage / SSR payload content.
  // Controlled 404 (Astro) — EN scaffold or pt-BR institutional/generic copy.
  assert.match(missing.body, /404|Not [Ff]ound|não encontrada/i)
  assert.doesNotMatch(missing.body, /data-just-institutional/)
  assert.doesNotMatch(missing.body, /Alpha Consulting|Beta Studio|data-renderer="canonical"/)
  assert.doesNotMatch(missing.body, /alpha@example\.test|beta@example\.test/)
  assert.doesNotMatch(missing.body, /--site-color-primary:#112233|--site-color-primary:#aa5500/)
  assert.equal(mock.calls.length, afterHtmlCalls, "missing asset must not call payload mock")

  // Path traversal / direct Worker paths must not expose entrypoint sources.
  // With public/.assetsignore (`_worker.js`), Static Assets must not serve them.
  for (const probe of ["/_astro/../_worker.js/index.js", "/_worker.js/index.js"]) {
    const leak = await fetchAsset(port, probe)
    assert.notEqual(leak.status, 200, `${probe} must not be a public Static Asset`)
    assert.doesNotMatch(
      leak.body,
      /createExports|serverEntrypointModule|@astrojs\/cloudflare/,
    )
    assert.doesNotMatch(leak.body, /Alpha Consulting|Beta Studio/)
  }

  // Health still Worker route (JSON), homepage still SSR.
  const health = await fetchAsset(port, "/health")
  assert.equal(health.status, 200)
  assert.match(health.headers["content-type"] ?? "", /application\/json/)

  assert.equal(mock.calls.length, afterHtmlCalls)
  assert.doesNotMatch(wrangler.output, new RegExp(`${LEADS_HOST}/functions/v1/leads`))
  assert.doesNotMatch(wrangler.output, /nodejs_compat/)
  // No automatic outbound leads during asset/HTML SSR beyond page render;
  // HTML may reference leads URL (LeadForm build-time) but assets fetch must not call it.
  assert.ok(
    !mock.calls.some((c) => String(c.pathname).includes("leads")),
    "payload mock must not receive leads traffic",
  )

  // Theme vars live on HTML (inline style / data-site-theme), not per-tenant CSS files.
  assert.ok(!alphaAssets.some((u) => /alpha|beta|tenant/i.test(u)))
  assert.match(alphaHtml.body, /style="[^"]*--site-color-primary:#112233/)
  assert.match(betaHtml.body, /style="[^"]*--site-color-primary:#aa5500/)

  // Slice 6.5 / DR-001: DEPLOY_ENV=staging → no prod leads URL; WhatsApp-only (no LeadForm).
  assert.doesNotMatch(alphaHtml.body, /service_role|SUPABASE_SERVICE_ROLE/i)
  assert.doesNotMatch(betaHtml.body, /service_role|SUPABASE_SERVICE_ROLE/i)
  assert.doesNotMatch(alphaHtml.body, new RegExp(`${LEADS_HOST}/functions/v1/leads`))
  assert.doesNotMatch(alphaHtml.body, /data-lead-form/)
  assert.match(alphaHtml.body, /data-tracked-cta="true"/)
  assert.match(alphaHtml.body, /whatsapp-float|header-whatsapp-cta/)
  assert.doesNotMatch(alphaHtml.body, /eyJ[a-zA-Z0-9_-]+\.eyJ[^"]*role\\?":\\?"service_role/)

  // Favicons are Worker redirects (not Static Assets), so inventory is CSS/JS only.
  // Current Astro/CF builds often ship 1–2 CSS chunks and zero `/_astro` JS.
  assert.ok(
    inventory.length >= 1,
    `expected >=1 CSS/JS static assets in inventory, got ${inventory.length}`,
  )
  assert.equal(inventory.length, cssUrls.length + jsUrls.length)
  assert.ok(jsUrls.length === 0 || jsUrls.every((u) => u.startsWith("/_astro/")))
})
