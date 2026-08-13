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

test("Marcelo pilot promotion verifies post_flip apex-final state and cannot promote", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/seo001-promote-marcelo-pilot.yml"),
    "utf8",
  )
  const active = activeLines(workflow)
  assert.match(active, /seo001-post-deploy-verify\.mjs/)
  assert.match(active, /--mode post_flip/)
  assert.match(active, /Marcelo pilot completed; promotion retired/)
  assert.doesNotMatch(active, /versions\s+deploy/)
  assert.doesNotMatch(active, /wrangler\s+deploy\b/)
  assert.doesNotMatch(active, /versions\s+upload/)
  assert.doesNotMatch(active, /CLOUDFLARE_API_TOKEN/)
  assert.doesNotMatch(active, /version_id/)
  assert.doesNotMatch(active, /location: https:\/\/www\.marceloborer\.com\.br/)
  assert.doesNotMatch(active, /Transitional production/)
})
