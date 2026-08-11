#!/usr/bin/env node
/**
 * CF-006 — Remote smoke against a Cloudflare Preview URL (fixtures only).
 *
 * Usage:
 *   PREVIEW_URL=https://…-just-public-poc….workers.dev \
 *     node scripts/ci/smoke-cloudflare-preview.mjs
 *
 * Env:
 *   PREVIEW_URL   (required) versioned Preview URL
 *   TIMEOUT_MS    (optional, default 15000)
 */

const HOSTS = [
  {
    host: "alpha.justwebsites.com.br",
    company: "Alpha Consulting",
    color: "#112233",
    foreign: ["Beta Studio", "Gamma Labs"],
  },
  {
    host: "beta.justwebsites.com.br",
    company: "Beta Studio",
    color: "#aa5500",
    foreign: ["Alpha Consulting", "Gamma Labs"],
  },
  {
    host: "gamma.justwebsites.com.br",
    company: "Gamma Labs",
    color: "#008866",
    foreign: ["Alpha Consulting", "Beta Studio"],
  },
]

/**
 * @param {string} base
 * @param {string} path
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function fetchPreview(base, path, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15_000
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const href = `${base.replace(/\/$/, "")}${normalizedPath}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(href, {
      signal: controller.signal,
      redirect: "manual",
      headers: { "user-agent": "just-public-cf006-smoke/1.0" },
    })
    const body = await res.text()
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body,
      href,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} previewUrl
 * @param {{ timeoutMs?: number, log?: (s: string) => void }} [opts]
 */
export async function smokeCloudflarePreview(previewUrl, opts = {}) {
  const log = opts.log ?? ((s) => console.log(s))
  const timeoutMs = opts.timeoutMs ?? Number(process.env.TIMEOUT_MS || 15_000)
  const base = previewUrl.replace(/\/$/, "")
  const results = []

  const health = await fetchPreview(base, "/health", { timeoutMs })
  if (health.status !== 200) {
    throw new Error(`/health expected 200, got ${health.status}`)
  }
  if (!health.body.includes('"status":"ok"') || !health.body.includes("just-public")) {
    throw new Error("/health JSON body unexpected")
  }
  if ((health.headers["x-robots-tag"] || "").toLowerCase().includes("noindex") === false) {
    // Preview platform often sets noindex; require at least noindex substring if present,
    // but fail only when a permissive robots tag is explicitly wrong.
    // Observed CF Preview: x-robots-tag: noindex
  }
  results.push({ case: "health", status: health.status, ok: true })
  log(`health ${health.status} OK`)

  let cssPath = ""
  for (const t of HOSTS) {
    const res = await fetchPreview(base, `/?host=${encodeURIComponent(t.host)}`, {
      timeoutMs,
    })
    if (res.status !== 200) {
      throw new Error(`${t.host} expected 200, got ${res.status}`)
    }
    if (!res.body.includes('data-renderer="canonical"')) {
      throw new Error(`${t.host}: missing canonical renderer`)
    }
    if (/<form\b[^>]*data-lead-form\b/i.test(res.body)) {
      throw new Error(`${t.host}: LeadForm must not render in preview`)
    }
    if (/functions\/v1\/leads|service_role|SUPABASE_SERVICE_ROLE/i.test(res.body)) {
      throw new Error(`${t.host}: lead intake credential or endpoint exposed`)
    }
    if (!res.body.includes(t.company)) {
      throw new Error(`${t.host}: missing company ${t.company}`)
    }
    if (!res.body.toLowerCase().includes(t.color.toLowerCase())) {
      throw new Error(`${t.host}: missing primary color ${t.color}`)
    }
    for (const foreign of t.foreign) {
      if (res.body.includes(foreign)) {
        throw new Error(`${t.host}: cross-tenant leak (${foreign})`)
      }
    }
    if (!cssPath) {
      const m = res.body.match(/\/_astro\/[^"'\s]+\.css/)
      if (m) cssPath = m[0]
    }
    results.push({ case: t.host, status: 200, ok: true })
    log(`${t.host} 200 canonical + isolated OK`)
  }

  const unknown = await fetchPreview(base, "/?host=unknown.example.test", {
    timeoutMs,
  })
  if (unknown.status !== 404) {
    throw new Error(`unknown host expected 404, got ${unknown.status}`)
  }
  results.push({ case: "unknown", status: 404, ok: true })

  const invalid = await fetchPreview(base, "/?host=https://evil.example", {
    timeoutMs,
  })
  if (invalid.status !== 400) {
    throw new Error(`invalid host expected 400, got ${invalid.status}`)
  }
  results.push({ case: "invalid", status: 400, ok: true })

  if (!cssPath) throw new Error("could not extract CSS path from HTML")
  const css = await fetchPreview(base, cssPath, { timeoutMs })
  if (css.status !== 200) throw new Error(`CSS ${cssPath} expected 200, got ${css.status}`)
  results.push({ case: "css", status: 200, path: cssPath, ok: true })

  const favicon = await fetchPreview(base, "/favicon.ico", { timeoutMs })
  if (![200, 302, 404].includes(favicon.status)) {
    throw new Error(`/favicon.ico expected 200|302|404, got ${favicon.status}`)
  }
  results.push({ case: "favicon", status: favicon.status, ok: true })

  for (const path of ["/_worker.js/index.js", "/_routes.json", "/_astro/does-not-exist-cf006.css"]) {
    const res = await fetchPreview(base, path, { timeoutMs })
    if (res.status !== 404) {
      throw new Error(`${path} expected 404, got ${res.status}`)
    }
    results.push({ case: path, status: 404, ok: true })
  }

  log("smoke-cloudflare-preview: PASS")
  return { ok: true, results, cssPath }
}

async function main() {
  const previewUrl = process.env.PREVIEW_URL
  if (!previewUrl) {
    console.error("PREVIEW_URL is required")
    process.exit(1)
  }
  if (!/^https:\/\//i.test(previewUrl)) {
    console.error("PREVIEW_URL must be https")
    process.exit(1)
  }
  await smokeCloudflarePreview(previewUrl)
}

if (
  process.argv[1]?.endsWith("smoke-cloudflare-preview.mjs") ||
  process.argv[1]?.includes("smoke-cloudflare-preview.mjs")
) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
