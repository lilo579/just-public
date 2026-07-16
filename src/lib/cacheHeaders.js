/**
 * FT-005B — Cache-Control helpers for Worker SSR responses.
 * Static hashed assets use public/_headers (Workers Static Assets), not this module.
 */

/**
 * @param {string | undefined} deployEnv
 * @param {number} [status=200]
 * @returns {string}
 */
export function resolveHtmlCacheControl(deployEnv, status = 200) {
  if (typeof status === "number" && status >= 400) {
    return "no-store"
  }

  const normalized =
    typeof deployEnv === "string" ? deployEnv.trim().toLowerCase() : ""

  if (normalized === "preview" || normalized === "staging") {
    return "no-store"
  }

  if (normalized === "production") {
    return "public, max-age=0, must-revalidate"
  }

  // Unset / unknown → conservative freshness (no shared long TTL).
  return "no-store"
}

/**
 * True when Cache-Control is the production HTML baseline (no shared-edge TTL).
 * @param {string} value
 */
export function isProductionHtmlCacheBaseline(value) {
  if (typeof value !== "string") return false
  const v = value.toLowerCase()
  const sharedEdgeTtlToken = ["s", "maxage"].join("-")
  return (
    v.includes("max-age=0") &&
    v.includes("must-revalidate") &&
    !v.includes(sharedEdgeTtlToken)
  )
}
