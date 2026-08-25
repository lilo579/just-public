/**
 * Public sitemap path collection for packaged institutional and F3/catalog sites.
 * Non-F3 tenants keep the homepage-only urlset. Fail closed on tenant/product mismatch.
 *
 * Request-scoped only: no module-level product cache, no host-shared Map.
 * Product loc lists come from host RPC rows, never from a tenant snapshot in this file.
 */

import { buildCanonicalUrl } from "./canonicalAuthority.js"

export const EMPTY_SITEMAP_XML =
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'

/** Factory-indexable F3 routes. Query, /c, and operator surfaces are never listed. */
export const F3_CATALOG_STATIC_PATHS = Object.freeze([
  "/",
  "/catalogo",
  "/sobre",
  "/contato",
])

/** Hard cap so a hung catalog RPC cannot stall sitemap generation. */
export const F3_CATALOG_RPC_TIMEOUT_MS = 4000

const BLOCKED_SITEMAP_EXACT = new Set([
  "/admin",
  "/auth",
  "/login",
  "/c",
  "/preview",
  "/api",
])

const BLOCKED_SITEMAP_PREFIXES = [
  "/admin/",
  "/auth/",
  "/login/",
  "/api/",
  "/preview/",
  "/_astro/",
  "/branding/",
  "/produto/",
]

const PRODUCT_SLUG_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/

/**
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function tenantKey(value) {
  return asTrimmed(value).toLowerCase()
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizePublicProductSlug(raw) {
  const slug = asTrimmed(raw)
  if (!slug) return ""
  if (slug.includes("/") || slug.includes("?") || slug.includes("#") || slug.includes(".")) {
    return ""
  }
  if (/\s/.test(slug)) return ""
  if (!PRODUCT_SLUG_RE.test(slug)) return ""
  return slug
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeIndexableSitemapPath(raw) {
  let path = asTrimmed(raw)
  if (!path.startsWith("/")) return ""
  const q = path.indexOf("?")
  if (q >= 0) path = path.slice(0, q)
  const h = path.indexOf("#")
  if (h >= 0) path = path.slice(0, h)
  path = path.replace(/\/{2,}/g, "/")
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "")
  if (!path) return ""
  if (BLOCKED_SITEMAP_EXACT.has(path)) return ""
  if (BLOCKED_SITEMAP_PREFIXES.some((prefix) => path.startsWith(prefix))) return ""
  if (path === "/") return "/"
  return path
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
function uniquePreserve(paths) {
  const seen = new Set()
  /** @type {string[]} */
  const out = []
  for (const raw of paths) {
    const path = normalizeIndexableSitemapPath(raw)
    if (!path || seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

/**
 * @param {string} a
 * @param {string} b
 */
function comparePath(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * @param {{
 *   rows?: unknown
 *   tenantId?: unknown
 * }} input
 * @returns {string[]}
 */
export function collectF3ProductPaths(input) {
  const expectedTenant = tenantKey(input?.tenantId)
  if (!expectedTenant) return []
  const rows = Array.isArray(input?.rows) ? input.rows : []
  /** @type {string[]} */
  const paths = []
  const seen = new Set()

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    const record = /** @type {Record<string, unknown>} */ (row)
    if (tenantKey(record.tenant_id) !== expectedTenant) continue
    const slug = sanitizePublicProductSlug(record.slug)
    if (!slug) continue
    const path = `/p/${slug}`
    if (seen.has(path)) continue
    seen.add(path)
    paths.push(path)
  }

  return paths.sort(comparePath)
}

/**
 * @param {{
 *   packaged?: { sitemapPaths?: string[] } | null
 *   family?: unknown
 *   productRows?: unknown
 *   tenantId?: unknown
 * }} input
 * @returns {string[]}
 */
export function collectPublicSitemapPaths(input) {
  const packagedPaths = input?.packaged?.sitemapPaths
  if (Array.isArray(packagedPaths) && packagedPaths.length > 0) {
    const paths = uniquePreserve(packagedPaths)
    return paths.length > 0 ? paths : ["/"]
  }

  if (input?.family === "f3") {
    const staticPaths = uniquePreserve([...F3_CATALOG_STATIC_PATHS])
    const productPaths = collectF3ProductPaths({
      rows: input.productRows,
      tenantId: input.tenantId,
    })
    const seen = new Set(staticPaths)
    const out = [...staticPaths]
    for (const path of productPaths) {
      if (seen.has(path)) continue
      seen.add(path)
      out.push(path)
    }
    return out
  }

  return ["/"]
}

/**
 * @param {number} ms
 * @param {string} message
 */
function timeoutReject(ms, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms)
  })
}

/**
 * Host-scoped public catalog RPC. Empty on missing identity, client, timeout, or RPC error.
 * Never caches rows across requests or hosts.
 *
 * @param {{
 *   supabase?: { rpc?: Function } | null
 *   host?: unknown
 *   tenantId?: unknown
 *   timeoutMs?: number
 * }} input
 * @returns {Promise<unknown[]>}
 */
export async function loadF3CatalogProductRows(input) {
  const host = asTrimmed(input?.host).toLowerCase()
  const tenantId = tenantKey(input?.tenantId)
  const supabase = input?.supabase
  const timeoutMs =
    typeof input?.timeoutMs === "number" && input.timeoutMs > 0
      ? input.timeoutMs
      : F3_CATALOG_RPC_TIMEOUT_MS
  if (!host || !tenantId || !supabase || typeof supabase.rpc !== "function") {
    return []
  }

  try {
    const result = await Promise.race([
      supabase.rpc("public_get_products_by_host", { p_host: host }),
      timeoutReject(timeoutMs, "f3_catalog_rpc_timeout"),
    ])
    if (!result || typeof result !== "object") return []
    const { data, error } = /** @type {{ data?: unknown, error?: unknown }} */ (result)
    if (error || !Array.isArray(data)) return []
    return data.filter((row) => row && typeof row === "object" && !Array.isArray(row))
  } catch {
    return []
  }
}

/**
 * @param {import("./canonicalAuthority.js").PublicCanonicalContract} canonical
 * @param {string[]} paths
 * @returns {string}
 */
export function buildSitemapXml(canonical, paths) {
  const locs = uniquePreserve(Array.isArray(paths) ? paths : [])
  if (locs.length === 0) return EMPTY_SITEMAP_XML

  const urls = locs
    .map((path) => {
      const loc = escapeXml(buildCanonicalUrl(canonical, path))
      const priority = path === "/" ? "1.0" : "0.6"
      return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}
