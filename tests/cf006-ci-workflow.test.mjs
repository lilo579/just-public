import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { parseWranglerVersionsUploadOutput } from "../scripts/ci/parse-cloudflare-version-output.mjs"
import {
  assertActiveDeploymentUnchanged,
  resolveActiveDeployment,
} from "../scripts/ci/assert-no-deployment-change.mjs"
import { assertCloudflarePreviewWorkflowPolicy } from "../scripts/ci/assert-workflow-policy.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const workflowPath = join(
  root,
  ".github/workflows/cloudflare-preview-version.yml",
)

test("CF-006 workflow file exists", () => {
  assert.equal(existsSync(workflowPath), true)
})

test("CF-006 workflow policy: manual-only, permissions, gates, no promote", () => {
  const yaml = readFileSync(workflowPath, "utf8")
  assert.doesNotThrow(() => assertCloudflarePreviewWorkflowPolicy(yaml))

  assert.match(yaml, /workflow_dispatch:/)
  assert.match(yaml, /contents:\s*read/)
  assert.match(yaml, /node-version:\s*"22"/)
  assert.match(yaml, /\bnpm ci\b/)
  assert.match(yaml, /\bnpm test\b/)
  assert.match(yaml, /\bnpm run build\b/)
  assert.match(yaml, /wrangler deploy --dry-run/)
  assert.match(yaml, /wrangler versions upload/)
  assert.match(yaml, /concurrency:/)
  assert.match(yaml, /timeout-minutes:\s*15/)
  assert.match(yaml, /\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\}/)
  assert.doesNotMatch(yaml, /wrangler versions deploy/)
  assert.doesNotMatch(yaml, /wrangler rollback/)
  assert.doesNotMatch(yaml, /echo\s+[\"']?\$\{?CLOUDFLARE_API_TOKEN\}?/)
  assert.doesNotMatch(yaml, /printenv\s+CLOUDFLARE_API_TOKEN/)

  const active = yaml
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")
  const idxBuild = active.search(/\bnpm run build\b/)
  const idxTest = active.search(/\bnpm test\b/)
  const idxDry = active.search(/wrangler deploy --dry-run/)
  const idxUpload = active.search(/wrangler versions upload/)
  assert.ok(idxBuild < idxTest, "build before test")
  assert.ok(idxTest < idxDry, "test before dry-run")
  assert.ok(idxDry < idxUpload, "dry-run before versions upload")
})

test("CF-006 workflow policy rejects test-before-build order", () => {
  const badOrder = `
on:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: x
  cancel-in-progress: true
jobs:
  j:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npx wrangler deploy --dry-run
      - run: npx wrangler versions upload
      - env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: true
`
  assert.throws(
    () => assertCloudflarePreviewWorkflowPolicy(badOrder),
    /build must appear before npm test/,
  )
})

test("CF-006 parseWranglerVersionsUploadOutput: standard wrangler 4.x labels", () => {
  const sample = `
Total Upload: 1164.31 KiB / gzip: 240.73 KiB
Worker Version ID: 166faa56-eb39-4f6d-9458-f8232e927546
Version Preview URL: https://166faa56-just-public-poc.lilo579.workers.dev
`
  const out = parseWranglerVersionsUploadOutput(sample)
  assert.equal(out.version_id, "166faa56-eb39-4f6d-9458-f8232e927546")
  assert.equal(
    out.preview_url,
    "https://166faa56-just-public-poc.lilo579.workers.dev",
  )
})

test("CF-006 parseWranglerVersionsUploadOutput: alternate Version ID / Preview URL labels", () => {
  const sample = `
Uploaded just-public-poc version aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
Preview URL: https://aaaaaaaa-just-public-poc.lilo579.workers.dev
`
  const out = parseWranglerVersionsUploadOutput(sample)
  assert.equal(out.version_id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
  assert.equal(
    out.preview_url,
    "https://aaaaaaaa-just-public-poc.lilo579.workers.dev",
  )
})

test("CF-006 parseWranglerVersionsUploadOutput: fail closed on missing fields", () => {
  assert.throws(() => parseWranglerVersionsUploadOutput("no ids"), /Version ID/)
  assert.throws(
    () =>
      parseWranglerVersionsUploadOutput(
        "Worker Version ID: 166faa56-eb39-4f6d-9458-f8232e927546",
      ),
    /Preview URL/,
  )
})

test("CF-006 assertActiveDeploymentUnchanged: latest deployment must match expected @100%", () => {
  const list = [
    {
      id: "acd84566-094b-4a29-8215-5de883c51b19",
      versions: [
        {
          version_id: "3047d28b-9830-4a10-8104-6d783f57ef4f",
          percentage: 100,
        },
      ],
    },
    {
      id: "a0368c3e-e1bb-4bb9-9212-775203df64e6",
      versions: [
        {
          version_id: "3047d28b-9830-4a10-8104-6d783f57ef4f",
          percentage: 100,
        },
      ],
    },
  ]
  const active = assertActiveDeploymentUnchanged(
    list,
    "3047d28b-9830-4a10-8104-6d783f57ef4f",
  )
  assert.equal(active.id, "a0368c3e-e1bb-4bb9-9212-775203df64e6")
  assert.equal(resolveActiveDeployment(list).percentage, 100)
})

test("CF-006 assertActiveDeploymentUnchanged: fails when CF-004 is active", () => {
  const list = [
    {
      id: "25979fb5-eea4-493c-96a7-ec20829d4c23",
      versions: [
        {
          version_id: "166faa56-eb39-4f6d-9458-f8232e927546",
          percentage: 100,
        },
      ],
    },
  ]
  assert.throws(
    () =>
      assertActiveDeploymentUnchanged(
        list,
        "3047d28b-9830-4a10-8104-6d783f57ef4f",
      ),
    /active version/,
  )
})

test("CF-006 workflow policy rejects promote-capable YAML", () => {
  const bad = `
on:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: x
  cancel-in-progress: true
jobs:
  j:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npx wrangler deploy --dry-run
      - run: npx wrangler versions upload
      - run: npx wrangler versions deploy 166faa56@100%
      - run: echo \${{ secrets.CLOUDFLARE_API_TOKEN }}
`
  // Missing node 22 among other things — force with a closer bad sample
  const closer = `
on:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: x
  cancel-in-progress: true
jobs:
  j:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npx wrangler deploy --dry-run
      - run: npx wrangler versions upload
      - run: npx wrangler versions deploy foo@100%
      - env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: true
`
  assert.throws(
    () => assertCloudflarePreviewWorkflowPolicy(closer),
    /versions deploy/,
  )
})

test("CF-006 metadata artifact schema is secret-free (fixture)", () => {
  const meta = {
    commit_sha: "7932a67",
    worker: "just-public-poc",
    version_id: "166faa56-eb39-4f6d-9458-f8232e927546",
    preview_url: "https://166faa56-just-public-poc.lilo579.workers.dev",
    timestamp: "2026-07-15T00:00:00.000Z",
  }
  const json = JSON.stringify(meta)
  assert.doesNotMatch(json, /api.?token/i)
  assert.doesNotMatch(json, /service_role/i)
  assert.doesNotMatch(json, /CLOUDFLARE_API_TOKEN/)
  assert.equal(Object.keys(meta).sort().join(","), "commit_sha,preview_url,timestamp,version_id,worker")
})
