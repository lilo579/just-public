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

test("GO-003 Marcelo workflow is read-only audit", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/go003-marcelo-cutover.yml"),
    "utf8",
  )
  const active = activeLines(workflow)
  assert.doesNotMatch(active, /\bmutate\b/)
  assert.doesNotMatch(active, /\b-X\s*(POST|PUT|PATCH|DELETE)\b/i)
  assert.doesNotMatch(active, /method\s*[:=]\s*['"]?(POST|PUT|PATCH|DELETE)['"]?/i)
  assert.doesNotMatch(active, /workers\/domains\/records/)
  assert.doesNotMatch(active, /dns_records\/[a-zA-Z0-9_-]+/)
  assert.match(active, /preflight/)
  assert.match(active, /status/)
  assert.match(active, /cutover COMPLETE|read-only/i)
  assert.match(active, /\bGET\b/)
})

test("Marcelo pilot promotion is retired — verify only", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/seo001-promote-marcelo-pilot.yml"),
    "utf8",
  )
  const active = activeLines(workflow)
  assert.match(active, /seo001-post-deploy-verify\.mjs/)
  assert.match(active, /--mode post_flip/)
  assert.match(active, /Marcelo pilot completed; promotion retired|promotion retired/i)
  assert.doesNotMatch(active, /versions\s+deploy/)
  assert.doesNotMatch(active, /wrangler\s+deploy\b/)
  assert.doesNotMatch(active, /versions\s+upload/)
  assert.doesNotMatch(active, /version_id/)
  assert.doesNotMatch(active, /CLOUDFLARE_API_TOKEN/)
  assert.doesNotMatch(active, /deployments\s+list/)
  assert.doesNotMatch(active, /location: https:\/\/www\.marceloborer\.com\.br/)
  assert.doesNotMatch(active, /Transitional production/)
})

test("seo001 promote tenant workflow uses allowlist, version gate, npm ci", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/seo001-promote-tenant.yml"),
    "utf8",
  )
  const active = activeLines(workflow)
  assert.match(active, /approved-tenants\.json/)
  assert.match(active, /seo001-promotion-policy\.mjs/)
  assert.match(active, /assertVersionBelongsToWorker/)
  assert.match(active, /versions list --name just-public-production/)
  assert.match(active, /npm ci/)
  assert.match(active, /\.\/node_modules\/\.bin\/wrangler/)
  assert.doesNotMatch(active, /\bnpx\s+wrangler\b/)
  assert.match(active, /node --input-type=module/)
  assert.match(active, /authority_mode/)
  assert.match(active, /pre_flip/)
  assert.match(active, /post_flip/)
  assert.match(active, /seo001-post-deploy-verify\.mjs/)
  assert.match(active, /environment: seo001-production-promotion/)
  assert.match(active, /concurrency:\s*\n\s+group: seo001-production-promotion/)
  assert.match(active, /Worker version WAS promoted|do NOT interpret this as a failed deploy/)
  assert.doesNotMatch(active, /dns_records|workers\/domains\/records/)
  // version gate must appear before versions deploy
  const gateIdx = active.search(/assertVersionBelongsToWorker/)
  const deployIdx = active.search(/versions\s+deploy/)
  assert.ok(gateIdx >= 0 && deployIdx > gateIdx, "version gate must precede promote")
})
