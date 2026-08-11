import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { smokeSeo001Staging } from "../scripts/ci/smoke-seo001-staging.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("staging rehearsal workflow cannot promote traffic or mutate routing", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/seo001-staging-rehearsal-version.yml"),
    "utf8",
  )
  const active = workflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")

  assert.match(active, /workflow_dispatch:/)
  assert.match(active, /wrangler versions upload --env staging/)
  assert.match(active, /wrangler deploy --dry-run --env staging/)
  assert.doesNotMatch(active, /wrangler\s+versions\s+deploy\b/)
  assert.doesNotMatch(active, /wrangler\s+deploy\b(?!\s+--dry-run)/)
  assert.doesNotMatch(active, /\bdns_records\b|workers\/domains|custom domain/i)
})

test("safe-mode explicit host simulation bypasses physical preview authority", async () => {
  const middleware = await fs.readFile(path.join(root, "src/middleware.ts"), "utf8")
  assert.match(
    middleware,
    /safeMode\s*&&\s*context\.url\.searchParams\.has\("host"\)/,
  )
  assert.match(
    middleware,
    /!safeMode\s*\|\|\s*\(!loopback\s*&&\s*!explicitSafeHostSimulation\)/,
  )
})

test("Marcelo DNS preflight fails closed on Cloudflare API errors", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/go003-marcelo-cutover.yml"),
    "utf8",
  )
  assert.match(workflow, /DNS snapshot/)
  assert.match(workflow, /if not d\.get\('success'\):\s*\n\s*raise SystemExit\(4\)/)
})

test("staging smoke accepts linked tenant content only when noindex and lead-safe", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname === "/health") {
      return new Response('{"status":"ok"}', { status: 200 })
    }
    const host = url.searchParams.get("host")
    if (host === "unknown-seo001.example.test") {
      return new Response("missing", { status: 404 })
    }
    if (host === "https://invalid.example") {
      return new Response("invalid", { status: 400 })
    }
    return new Response(`<html><body>Marcelo ${host}</body></html>`, {
      status: 200,
      headers: { "x-robots-tag": "noindex, nofollow" },
    })
  }

  try {
    await assert.doesNotReject(() => smokeSeo001Staging("https://staging.test"))
  } finally {
    globalThis.fetch = original
  }
})
