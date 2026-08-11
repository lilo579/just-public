#!/usr/bin/env node

const CASES = [
  { host: "www.marceloborer.com.br", expected: "Marcelo" },
  { host: "marceloborer.com.br", expected: "Marcelo" },
]

async function fetchCase(base, path) {
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "seo001-staging-smoke/1.0" },
  })
  return {
    status: response.status,
    headers: response.headers,
    body: await response.text(),
  }
}

export async function smokeSeo001Staging(previewUrl) {
  const health = await fetchCase(previewUrl, "/health")
  if (health.status !== 200 || !health.body.includes('"status":"ok"')) {
    throw new Error(`health expected 200/ok, got ${health.status}`)
  }

  for (const entry of CASES) {
    const response = await fetchCase(
      previewUrl,
      `/?host=${encodeURIComponent(entry.host)}`,
    )
    if (response.status !== 200) {
      throw new Error(`${entry.host} expected 200, got ${response.status}`)
    }
    if (!response.body.includes(entry.expected)) {
      throw new Error(`${entry.host} missing expected tenant content`)
    }
    if (!/noindex/i.test(response.headers.get("x-robots-tag") ?? "")) {
      throw new Error(`${entry.host} staging response must be noindex`)
    }
    if (/<form\b[^>]*data-lead-form\b/i.test(response.body)) {
      throw new Error(`${entry.host} must not render LeadForm in staging`)
    }
    if (/functions\/v1\/leads|service_role|SUPABASE_SERVICE_ROLE/i.test(response.body)) {
      throw new Error(`${entry.host} exposed lead intake material`)
    }
    console.log(`${entry.host} 200 tenant content + noindex + lead-safe`)
  }

  const unknown = await fetchCase(
    previewUrl,
    "/?host=unknown-seo001.example.test",
  )
  if (unknown.status !== 404) {
    throw new Error(`unknown host expected 404, got ${unknown.status}`)
  }

  const invalid = await fetchCase(
    previewUrl,
    `/?host=${encodeURIComponent("https://invalid.example")}`,
  )
  if (invalid.status !== 400) {
    throw new Error(`invalid host expected 400, got ${invalid.status}`)
  }

  console.log("smoke-seo001-staging: PASS")
}

if (process.argv[1]?.endsWith("smoke-seo001-staging.mjs")) {
  const previewUrl = process.env.PREVIEW_URL
  if (!previewUrl) {
    console.error("PREVIEW_URL is required")
    process.exit(1)
  }
  smokeSeo001Staging(previewUrl).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
