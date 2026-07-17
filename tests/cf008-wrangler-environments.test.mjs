import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

function parseJsonc(text) {
  // Strip // line comments outside of JSON strings (URLs may contain https://).
  const stripped = text
    .split("\n")
    .map((line) => {
      let inString = false
      let escaped = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (escaped) {
          escaped = false
          continue
        }
        if (c === "\\" && inString) {
          escaped = true
          continue
        }
        if (c === '"') {
          inString = !inString
          continue
        }
        if (!inString && c === "/" && line[i + 1] === "/") {
          return line.slice(0, i)
        }
      }
      return line
    })
    .join("\n")
  return JSON.parse(stripped)
}

test("CF-008: POC top-level and production env remain distinct and safe", async () => {
  const text = await fs.readFile(path.join(root, "wrangler.jsonc"), "utf8")
  const cfg = parseJsonc(text)

  assert.equal(cfg.name, "just-public-poc")
  assert.equal(cfg.workers_dev, false)
  assert.equal(cfg.preview_urls, true)
  assert.equal(cfg.vars?.DEPLOY_ENV, "preview")
  assert.equal(cfg.vars?.POC_FIXTURE_MODE, "true")
  assert.equal(cfg.assets?.binding, "ASSETS")
  assert.equal(cfg.assets?.directory, "./dist")
  assert.equal(cfg.main, "./dist/_worker.js/index.js")

  assert.ok(!("routes" in cfg) && !("route" in cfg))
  assert.ok(!("domains" in cfg) && !("domain" in cfg))
  assert.doesNotMatch(text, /nodejs_compat/)
  // Top-level POC must not embed production secrets/URLs; production env may set payload URL.
  const topOnly = text.split('"env"')[0] ?? text
  assert.doesNotMatch(topOnly, /PUBLIC_SITE_PAYLOAD_URL|SUPABASE_ANON_KEY|PUBLIC_LEADS_INTAKE_URL/)
  assert.doesNotMatch(text, /PUBLIC_SUPABASE_URL|PUBLIC_SUPABASE_ANON_KEY/)

  const prod = cfg.env?.production
  assert.ok(prod, "env.production required")
  assert.equal(prod.name, "just-public-production")
  assert.equal(prod.workers_dev, false)
  assert.equal(prod.preview_urls, true)
  assert.equal(prod.vars?.DEPLOY_ENV, "production")
  assert.equal(prod.vars?.POC_FIXTURE_MODE, "false")
  assert.match(String(prod.vars?.PUBLIC_SITE_PAYLOAD_URL ?? ""), /public-site-payload/)
  assert.equal(prod.assets?.binding, "ASSETS")
  assert.equal(prod.assets?.directory, "./dist")
  // Custom Domain is remote-only; config must not declare routes/domains.
  assert.ok(!("routes" in prod) && !("route" in prod))
  assert.ok(!("domains" in prod) && !("domain" in prod))
  assert.doesNotMatch(text, /custom_domain|public-staging\.justwebsites\.com\.br/)
  // Exact name override (no automatic just-public-poc-production suffix).
  assert.equal(prod.name, "just-public-production")
  assert.notEqual(prod.name, "just-public-poc-production")
})
test("CF-008: CF-006 preview workflow still targets POC only", async () => {
  const wf = await fs.readFile(
    path.join(root, ".github/workflows/cloudflare-preview-version.yml"),
    "utf8",
  )
  assert.match(wf, /WORKER_NAME:\s*just-public-poc/)
  assert.match(wf, /wrangler deploy --dry-run/)
  assert.match(wf, /DEPLOY_ENV \("preview"\)/)
  assert.match(wf, /POC_FIXTURE_MODE \("true"\)/)
  assert.match(wf, /wrangler versions upload/)
  assert.doesNotMatch(wf, /--env\s+production/)
  assert.doesNotMatch(wf, /just-public-production/)
  // Forbid an actual promote command; comments mentioning "versions deploy" are OK.
  assert.doesNotMatch(wf, /wrangler\s+versions\s+deploy\b/)
  assert.doesNotMatch(wf, /public-staging\.justwebsites\.com\.br/)
})
