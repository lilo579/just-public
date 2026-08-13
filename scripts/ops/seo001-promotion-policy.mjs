/**
 * ADR-SEO-001 — allowlisted production promotion policy (no remote mutations).
 */

import { readFileSync } from "node:fs"
import path from "node:path"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Hostname: lowercase letters, digits, dots, hyphens; no protocol/path/port/query/newline. */
const HOST_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/

/**
 * @typedef {{ primary: string, alias: string, enabled: boolean }} ApprovedTenant
 * @typedef {Record<string, ApprovedTenant>} ApprovedTenantsFile
 */

/**
 * @param {string} host
 * @param {string} label
 */
export function assertStrictHostname(host, label = "host") {
  const value = String(host ?? "")
  if (value !== value.toLowerCase()) {
    throw new Error(`seo001-promotion: ${label} must be lowercase`)
  }
  if (/[\s/:?#\\]/.test(value) || value.includes("\n") || value.includes("\r")) {
    throw new Error(`seo001-promotion: ${label} must not contain whitespace, protocol, path, port, or query`)
  }
  if (!HOST_RE.test(value)) {
    throw new Error(`seo001-promotion: ${label} must be a strict hostname`)
  }
  return value
}

/**
 * @param {unknown} raw
 * @returns {ApprovedTenantsFile}
 */
export function parseApprovedTenants(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("seo001-promotion: approved-tenants must be a JSON object")
  }
  /** @type {ApprovedTenantsFile} */
  const out = {}
  for (const [slug, value] of Object.entries(raw)) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`seo001-promotion: invalid slug key "${slug}"`)
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`seo001-promotion: invalid entry for "${slug}"`)
    }
    const entry = /** @type {Record<string, unknown>} */ (value)
    for (const key of ["primary", "alias"]) {
      if (typeof entry[key] !== "string") {
        throw new Error(`seo001-promotion: ${slug}.${key} must be a host string`)
      }
      assertStrictHostname(String(entry[key]), `${slug}.${key}`)
    }
    if (typeof entry.enabled !== "boolean") {
      throw new Error(`seo001-promotion: ${slug}.enabled must be boolean`)
    }
    out[slug] = {
      primary: String(entry.primary).trim().toLowerCase(),
      alias: String(entry.alias).trim().toLowerCase(),
      enabled: entry.enabled,
    }
  }
  return out
}

/**
 * @param {string} filePath
 */
export function loadApprovedTenantsFromFile(filePath) {
  const text = readFileSync(filePath, "utf8")
  return parseApprovedTenants(JSON.parse(text))
}

/**
 * @param {string} slug
 * @param {string} confirm
 */
export function assertPromotionConfirm(slug, confirm) {
  const expected = `PROMOTE_${slug.toUpperCase().replace(/-/g, "_")}`
  const got = String(confirm || "").trim()
  if (got !== expected) {
    throw new Error(
      `seo001-promotion: confirmation must be exactly "${expected}" (got "${got}")`,
    )
  }
}

/**
 * @param {string} versionId
 */
export function assertVersionId(versionId) {
  const id = String(versionId || "").trim().toLowerCase()
  if (!UUID_RE.test(id)) {
    throw new Error("seo001-promotion: version_id must be a UUID")
  }
  return id
}

/**
 * @param {"pre_flip" | "post_flip"} mode
 */
export function assertAuthorityMode(mode) {
  if (mode !== "pre_flip" && mode !== "post_flip") {
    throw new Error('seo001-promotion: authority_mode must be "pre_flip" or "post_flip"')
  }
  return mode
}

/**
 * Resolve checker hosts from allowlist — never from free-form operator host strings.
 *
 * @param {ApprovedTenant} tenant
 * @param {"pre_flip" | "post_flip"} mode
 */
export function resolveCheckerHosts(tenant, mode) {
  assertAuthorityMode(mode)
  if (mode === "post_flip") {
    return {
      primaryHost: tenant.primary,
      wwwAliasHost: tenant.alias,
      mode,
      description:
        "post_flip: DB apex primary expected — checker validates apex canonical and www→apex redirects",
    }
  }
  return {
    primaryHost: tenant.primary,
    wwwAliasHost: tenant.alias,
    mode,
    description:
      "pre_flip: DB www primary expected — checker validates www canonical and apex→www redirects",
  }
}

/**
 * @param {ApprovedTenantsFile} allowlist
 * @param {string} slug
 */
export function resolveAllowlistedTenant(allowlist, slug) {
  const key = String(slug || "").trim().toLowerCase()
  const tenant = allowlist[key]
  if (!tenant) {
    throw new Error(`seo001-promotion: tenant_slug "${slug}" is not in the allowlist`)
  }
  if (!tenant.enabled) {
    throw new Error(
      `seo001-promotion: tenant "${slug}" is disabled — enable via reviewed PR before promotion`,
    )
  }
  return { slug: key, tenant }
}

/**
 * Assert version_id belongs to just-public-production.
 * Accepts wrangler versions list JSON (array or {versions|result}).
 *
 * @param {string} versionId
 * @param {unknown} versionsPayload
 * @param {string} [workerName]
 */
export function assertVersionBelongsToWorker(
  versionId,
  versionsPayload,
  workerName = "just-public-production",
) {
  const id = assertVersionId(versionId)
  /** @type {unknown[]} */
  let rows = []
  if (Array.isArray(versionsPayload)) {
    rows = versionsPayload
  } else if (versionsPayload && typeof versionsPayload === "object") {
    const obj = /** @type {Record<string, unknown>} */ (versionsPayload)
    if (Array.isArray(obj.versions)) rows = obj.versions
    else if (Array.isArray(obj.result)) rows = obj.result
  }
  if (!rows.length) {
    throw new Error(
      `seo001-promotion: no versions listed for Worker ${workerName} — refuse promotion`,
    )
  }
  const match = rows.some((row) => {
    if (!row || typeof row !== "object") return false
    const r = /** @type {Record<string, unknown>} */ (row)
    const candidates = [r.id, r.version_id, r.versionId]
    return candidates.some((c) => String(c || "").toLowerCase() === id)
  })
  if (!match) {
    throw new Error(
      `seo001-promotion: version_id ${id} is not a known version of Worker ${workerName}`,
    )
  }
  return id
}

/**
 * Default allowlist path relative to Public repo root.
 */
export function defaultApprovedTenantsPath(rootDir = process.cwd()) {
  return path.join(rootDir, "ops/seo001/approved-tenants.json")
}
