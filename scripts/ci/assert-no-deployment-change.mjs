#!/usr/bin/env node
/**
 * CF-006 — Assert active Deployment still points at expected Version @ 100%.
 *
 * Usage:
 *   EXPECTED_VERSION_ID=3047d28b-… \
 *     node scripts/ci/assert-no-deployment-change.mjs < deployments.json
 *
 * Or:
 *   node scripts/ci/assert-no-deployment-change.mjs --file deployments.json \
 *     --expected 3047d28b-9830-4a10-8104-6d783f57ef4f
 *
 * Does not print tokens. Fail closed on empty / unexpected shape.
 */

import { readFileSync } from "node:fs"

/**
 * Cloudflare `wrangler deployments list --json` returns an array of deployments
 * in chronological order; the last entry is the current active deployment.
 *
 * @param {unknown} raw
 * @returns {{ id: string, version_id: string, percentage: number }}
 */
export function resolveActiveDeployment(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("assert-no-deployment-change: deployments list empty")
  }
  const active = raw[raw.length - 1]
  if (!active || typeof active !== "object") {
    throw new Error("assert-no-deployment-change: active deployment missing")
  }
  const versions = /** @type {{ versions?: unknown }} */ (active).versions
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error("assert-no-deployment-change: active deployment has no versions")
  }
  if (versions.length !== 1) {
    throw new Error(
      `assert-no-deployment-change: expected single version @100%, got ${versions.length} splits`,
    )
  }
  const v = /** @type {{ version_id?: string, percentage?: number }} */ (versions[0])
  if (typeof v.version_id !== "string" || !v.version_id) {
    throw new Error("assert-no-deployment-change: version_id missing")
  }
  if (Number(v.percentage) !== 100) {
    throw new Error(
      `assert-no-deployment-change: expected 100%, got ${String(v.percentage)}`,
    )
  }
  return {
    id: String(/** @type {{ id?: string }} */ (active).id || ""),
    version_id: v.version_id.toLowerCase(),
    percentage: 100,
  }
}

/**
 * @param {unknown} raw
 * @param {string} expectedVersionId
 */
export function assertActiveDeploymentUnchanged(raw, expectedVersionId) {
  const expected = expectedVersionId.trim().toLowerCase()
  if (!expected) {
    throw new Error("assert-no-deployment-change: EXPECTED_VERSION_ID required")
  }
  const active = resolveActiveDeployment(raw)
  if (active.version_id !== expected) {
    throw new Error(
      `assert-no-deployment-change: active version ${active.version_id} !== expected ${expected} (deployment ${active.id})`,
    )
  }
  return active
}

function readJson(argv) {
  const fileIdx = argv.indexOf("--file")
  if (fileIdx !== -1) {
    const path = argv[fileIdx + 1]
    if (!path) throw new Error("--file requires a path")
    return JSON.parse(readFileSync(path, "utf8"))
  }
  return JSON.parse(readFileSync(0, "utf8"))
}

function expectedFromArgv(argv) {
  const i = argv.indexOf("--expected")
  if (i !== -1) return argv[i + 1] || ""
  return process.env.EXPECTED_VERSION_ID || ""
}

function main(argv = process.argv.slice(2)) {
  const raw = readJson(argv)
  const expected = expectedFromArgv(argv)
  const active = assertActiveDeploymentUnchanged(raw, expected)
  process.stdout.write(
    JSON.stringify({
      ok: true,
      deployment_id: active.id,
      version_id: active.version_id,
      percentage: active.percentage,
    }) + "\n",
  )
}

if (
  process.argv[1]?.endsWith("assert-no-deployment-change.mjs") ||
  process.argv[1]?.includes("assert-no-deployment-change.mjs")
) {
  try {
    main()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
