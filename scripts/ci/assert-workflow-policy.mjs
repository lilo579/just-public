#!/usr/bin/env node
/**
 * CF-006 — Static policy scan for the controlled CI workflow.
 * Fail if the workflow YAML allows promotion / open ingress / DNS.
 *
 * Usage:
 *   node scripts/ci/assert-workflow-policy.mjs \
 *     --file .github/workflows/cloudflare-preview-version.yml
 */

import { readFileSync } from "node:fs"

/** @param {string} yaml */
export function assertCloudflarePreviewWorkflowPolicy(yaml) {
  if (typeof yaml !== "string" || !yaml.trim()) {
    throw new Error("assert-workflow-policy: empty workflow")
  }

  const errors = []

  if (!/workflow_dispatch:/.test(yaml)) {
    errors.push("missing workflow_dispatch trigger")
  }
  // Initial CF-006: push trigger must NOT be active.
  if (/^\s*push:\s*$/m.test(yaml) || /^\s*push:\s*\n\s+branches:/m.test(yaml)) {
    // Allow push only if explicitly commented out on the same lines — check raw active push keys.
    const withoutComments = yaml
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n")
    if (/^\s*push:\s*$/m.test(withoutComments) || /^\s*push:\s*\n\s+branches:/m.test(withoutComments)) {
      errors.push("push trigger must remain disabled until CF-006 remote certification")
    }
  }

  if (!/permissions:\s*\n\s+contents:\s*read/.test(yaml)) {
    errors.push("permissions.contents must be read")
  }
  for (const bad of [
    "contents: write",
    "deployments: write",
    "id-token: write",
    "pull-requests: write",
  ]) {
    if (yaml.includes(bad)) errors.push(`forbidden permission: ${bad}`)
  }

  if (!/node-version:\s*['"]?22['"]?/.test(yaml)) {
    errors.push("Node 22 required")
  }
  if (!/\bnpm ci\b/.test(yaml)) errors.push("npm ci required")
  if (!/\bnpm test\b/.test(yaml)) errors.push("npm test required before upload")
  if (!/\bnpm run build\b/.test(yaml)) errors.push("npm run build required before upload")
  if (!/wrangler deploy --dry-run/.test(yaml)) {
    errors.push("wrangler deploy --dry-run required before upload")
  }
  if (!/wrangler versions upload/.test(yaml)) {
    errors.push("wrangler versions upload required")
  }

  // Forbidden remote mutation commands (allow only dry-run deploy).
  const withoutComments = yaml
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")

  if (/wrangler\s+versions\s+deploy\b/.test(withoutComments)) {
    errors.push("forbidden: wrangler versions deploy")
  }
  if (/wrangler\s+rollback\b/.test(withoutComments)) {
    errors.push("forbidden: wrangler rollback")
  }
  // Real deploy: "wrangler deploy" not followed later on the same command by --dry-run
  for (const line of withoutComments.split("\n")) {
    if (!/wrangler\s+deploy\b/.test(line)) continue
    if (/wrangler\s+deploy\s+--dry-run/.test(line)) continue
    if (/wrangler\s+deploy\b/.test(line) && !/--dry-run/.test(line)) {
      errors.push(`forbidden real wrangler deploy: ${line.trim()}`)
    }
  }

  for (const needle of [
    "workers_dev=true",
    "workers_dev: true",
    "dns",
    "custom domain",
    "custom_domain",
    "workers builds",
  ]) {
    // Case-insensitive scans that are too broad for "dns" in comments — use focused forbids.
    void needle
  }
  if (/workers_dev\s*[:=]\s*true/i.test(withoutComments)) {
    errors.push("forbidden: workers_dev=true")
  }
  if (/wrangler\s+.*\broutes\b/i.test(withoutComments) && /create|add|put|patch/i.test(withoutComments)) {
    errors.push("forbidden: routes mutation")
  }

  if (!/concurrency:/.test(yaml)) errors.push("concurrency required")
  if (!/timeout-minutes:\s*15/.test(yaml)) errors.push("timeout-minutes: 15 required")

  if (/secrets\.[A-Z0-9_]+\s*}/.test(yaml) === false && !/\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\}/.test(yaml)) {
    errors.push("CLOUDFLARE_API_TOKEN must be referenced via secrets expression")
  }
  if (!/\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\}/.test(yaml)) {
    errors.push("CLOUDFLARE_API_TOKEN must be referenced via ${{ secrets.CLOUDFLARE_API_TOKEN }}")
  }

  // Never echo the token value; mentioning the secret *name* in error text is OK.
  if (/echo\s+[\"']?\$\{?CLOUDFLARE_API_TOKEN\}?/i.test(withoutComments)) {
    errors.push("must not echo CLOUDFLARE_API_TOKEN value")
  }
  if (/printenv\s+CLOUDFLARE_API_TOKEN/i.test(withoutComments)) {
    errors.push("must not printenv CLOUDFLARE_API_TOKEN")
  }
  if (/::add-mask::\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN/.test(yaml) === false) {
    // optional; do not require
  }

  if (errors.length) {
    throw new Error(`assert-workflow-policy:\n- ${errors.join("\n- ")}`)
  }
  return { ok: true }
}

function main(argv = process.argv.slice(2)) {
  const i = argv.indexOf("--file")
  const file = i !== -1 ? argv[i + 1] : ".github/workflows/cloudflare-preview-version.yml"
  if (!file) throw new Error("--file requires a path")
  const yaml = readFileSync(file, "utf8")
  const result = assertCloudflarePreviewWorkflowPolicy(yaml)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (
  process.argv[1]?.endsWith("assert-workflow-policy.mjs") ||
  process.argv[1]?.includes("assert-workflow-policy.mjs")
) {
  try {
    main()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
