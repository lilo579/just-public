import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("staging bootstrap is pinned to isolated Worker and cannot mutate routing", async () => {
  const workflow = await fs.readFile(
    path.join(root, ".github/workflows/seo001-staging-bootstrap.yml"),
    "utf8",
  )
  const active = workflow
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")

  assert.match(active, /wrangler versions deploy --env staging/)
  assert.match(active, /--percentage 100/)
  assert.match(active, /just-public-staging/)
  assert.match(active, /deployments list --name just-public-production/)
  assert.doesNotMatch(active, /\bdns_records\b|workers\/domains\/records|triggers deploy/i)
  assert.doesNotMatch(active, /wrangler versions deploy --env production/)
})
