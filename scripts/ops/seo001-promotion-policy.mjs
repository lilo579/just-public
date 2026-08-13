/**
 * ADR-SEO-001 — allowlisted production promotion policy (no remote mutations).
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @typedef {{ primary: string, alias: string, enabled: boolean }} ApprovedTenant
 * @typedef {Record<string, ApprovedTenant>} ApprovedTenantsFile
 */

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
      if (typeof entry[key] !== "string" || !String(entry[key]).includes(".")) {
        throw new Error(`seo001-promotion: ${slug}.${key} must be a host string`)
      }
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
 * Default allowlist path relative to Public repo root.
 */
export function defaultApprovedTenantsPath(rootDir = process.cwd()) {
  return path.join(rootDir, "ops/seo001/approved-tenants.json")
}

export const MARCELO_PILOT_POST_FLIP = Object.freeze({
  primaryHost: "marceloborer.com.br",
  wwwAliasHost: "www.marceloborer.com.br",
  mode: "post_flip",
})
