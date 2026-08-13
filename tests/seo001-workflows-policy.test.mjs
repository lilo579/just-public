import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

function activeLines(yaml) {
  return yaml
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")
}

test("seo001 promote tenant workflow uses allowlist and modes", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/seo001-promote-tenant.yml"),
    "utf8",
  )
  const active = activeLines(workflow)
  assert.match(active, /approved-tenants\.json/)
  assert.match(active, /seo001-promotion-policy\.mjs/)
  assert.match(active, /authority_mode/)
  assert.match(active, /pre_flip/)
  assert.match(active, /post_flip/)
  assert.match(active, /seo001-post-deploy-verify\.mjs/)
  assert.match(active, /environment: seo001-production-promotion/)
  assert.match(active, /concurrency:\s*\n\s+group: seo001-production-promotion/)
  assert.doesNotMatch(active, /dns_records|workers\/domains\/records/)
})
