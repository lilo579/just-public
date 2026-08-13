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

test("Marcelo pilot promotion verifies post_flip apex-final state", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/seo001-promote-marcelo-pilot.yml"),
    "utf8",
  )
  const active = activeLines(workflow)
  assert.match(active, /seo001-post-deploy-verify\.mjs/)
  assert.match(active, /--mode post_flip/)
  assert.match(active, /deployment_succeeded/)
  assert.match(active, /post_deploy_verification/)
  assert.doesNotMatch(active, /location: https:\/\/www\.marceloborer\.com\.br/)
  assert.doesNotMatch(active, /Transitional production/)
  assert.match(active, /LEGACY|pilot cutover complete/i)
})
