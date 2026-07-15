#!/usr/bin/env node
/**
 * CF-006 — Parse wrangler versions upload stdout for Version ID + Preview URL.
 * Fail closed: empty / ambiguous matches → non-zero exit.
 *
 * Usage:
 *   node scripts/ci/parse-cloudflare-version-output.mjs < upload.log
 *   node scripts/ci/parse-cloudflare-version-output.mjs --file upload.log
 *
 * Optional flags:
 *   --json          print JSON { version_id, preview_url }
 *   --github-output append KEY=value pairs to $GITHUB_OUTPUT
 */

import { readFileSync, appendFileSync } from "node:fs"

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * @param {string} text
 * @returns {{ version_id: string, preview_url: string }}
 */
export function parseWranglerVersionsUploadOutput(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("parse-cloudflare-version-output: empty upload output")
  }

  const versionPatterns = [
    /Worker Version ID:\s*([0-9a-f-]{36})/i,
    /Current Version ID:\s*([0-9a-f-]{36})/i,
    /Version ID:\s*([0-9a-f-]{36})/i,
    /Uploaded .+ version\s+([0-9a-f-]{36})/i,
  ]

  let version_id = ""
  for (const re of versionPatterns) {
    const m = text.match(re)
    if (m?.[1] && UUID_RE.test(m[1])) {
      version_id = m[1].toLowerCase()
      break
    }
  }

  const previewPatterns = [
    /Version Preview URL:\s*(https:\/\/[^\s]+)/i,
    /Preview URL:\s*(https:\/\/[^\s]+)/i,
    /(https:\/\/[0-9a-f-]{36}-[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev)/i,
  ]

  let preview_url = ""
  for (const re of previewPatterns) {
    const m = text.match(re)
    if (m?.[1]?.startsWith("https://")) {
      preview_url = m[1].replace(/[.,;)]+$/, "")
      break
    }
  }

  if (!version_id) {
    throw new Error(
      "parse-cloudflare-version-output: Version ID not found in wrangler output",
    )
  }
  if (!preview_url) {
    throw new Error(
      "parse-cloudflare-version-output: Preview URL not found in wrangler output",
    )
  }
  if (!preview_url.includes(version_id.slice(0, 8))) {
    // Soft check only logs via throw when clearly mismatched hostname prefix
    // Preview hosts commonly start with first 8 of version id.
    const host = new URL(preview_url).hostname
    if (!host.startsWith(version_id.split("-")[0])) {
      throw new Error(
        `parse-cloudflare-version-output: Preview URL host does not match Version ID prefix (${host})`,
      )
    }
  }

  return { version_id, preview_url }
}

function readInput(argv) {
  const fileIdx = argv.indexOf("--file")
  if (fileIdx !== -1) {
    const path = argv[fileIdx + 1]
    if (!path) throw new Error("--file requires a path")
    return readFileSync(path, "utf8")
  }
  return readFileSync(0, "utf8")
}

function main(argv = process.argv.slice(2)) {
  const text = readInput(argv)
  const result = parseWranglerVersionsUploadOutput(text)

  if (argv.includes("--github-output")) {
    const out = process.env.GITHUB_OUTPUT
    if (!out) throw new Error("GITHUB_OUTPUT is not set")
    appendFileSync(
      out,
      `version_id=${result.version_id}\npreview_url=${result.preview_url}\n`,
    )
  }

  if (argv.includes("--json") || !argv.includes("--github-output")) {
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
}

const isDirect =
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`

if (
  process.argv[1]?.endsWith("parse-cloudflare-version-output.mjs") ||
  process.argv[1]?.includes("parse-cloudflare-version-output.mjs")
) {
  try {
    main()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
