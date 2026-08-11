import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("production candidate uploads a Version but cannot promote or mutate routing", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/seo001-production-candidate-version.yml"),
    "utf8",
  )
  const active = workflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")

  assert.match(active, /wrangler versions upload --env production/)
  assert.match(active, /wrangler deploy --dry-run --env production/)
  assert.match(active, /deployments list --name just-public-production/)
  assert.doesNotMatch(active, /wrangler\s+versions\s+deploy\b/)
  assert.doesNotMatch(active, /wrangler\s+deploy\b(?!\s+--dry-run)/)
  assert.doesNotMatch(active, /\bdns_records\b|workers\/domains|triggers deploy/i)
})
