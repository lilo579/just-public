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
  assert.doesNotMatch(active, /\/zones\/[^/]+\/dns_records\/[^/"'\s]+/)
  assert.match(active, /preflight/)
  assert.match(active, /status/)
  assert.match(active, /cutover COMPLETE|read-only/i)
})
