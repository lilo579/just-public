/**
 * ADR-SEO-001 Phase 4 — classify request paths for canonical redirects.
 * Redirects apply only to public discovery/HTML surfaces, never assets or ops.
 */

/**
 * @typedef {'public_page' | 'asset' | 'operational' | 'preview' | 'excluded'} PublicRouteKind
 */

const STATIC_ASSET_EXT =
  /\.(?:css|js|mjs|map|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|json|webmanifest|txt|xml|mp4|webm|pdf)$/i

/**
 * Known static public HTML/discovery routes (safe for case normalization).
 * Dynamic segments (e.g. /p/[slug]) are intentionally excluded.
 */
export const STATIC_PUBLIC_PATHS = Object.freeze([
  "/",
  "/sobre",
  "/contato",
  "/catalogo",
  "/c",
  "/privacidade",
  "/termos",
  "/seguranca",
  "/robots.txt",
  "/sitemap.xml",
  "/homepage",
])

/**
 * @param {string} pathname
 * @returns {string}
 */
export function normalizePathname(pathname) {
  if (typeof pathname !== "string" || !pathname) return "/"
  let path = pathname.split("?")[0].split("#")[0] || "/"
  if (!path.startsWith("/")) path = `/${path}`
  path = path.replace(/\/{2,}/g, "/")
  return path || "/"
}

/**
 * @param {string} pathname
 * @returns {PublicRouteKind}
 */
export function classifyPublicRoute(pathname) {
  const path = normalizePathname(pathname)

  if (path === "/health" || path.startsWith("/health/")) {
    return "operational"
  }
  if (path === "/api" || path.startsWith("/api/")) {
    return "operational"
  }
  if (path.startsWith("/_worker") || path.startsWith("/_routes")) {
    return "excluded"
  }
  if (path === "/preview" || path.startsWith("/preview/")) {
    return "preview"
  }

  if (
    path.startsWith("/_astro/") ||
    path.startsWith("/fonts/") ||
    path.startsWith("/branding/") ||
    path.startsWith("/images/") ||
    path === "/favicon.ico" ||
    path === "/favicon.svg" ||
    path.endsWith("/site.webmanifest") ||
    path.endsWith("/manifest.webmanifest")
  ) {
    return "asset"
  }

  // Discovery surfaces are public even though they use .txt / .xml extensions.
  if (path === "/robots.txt" || path === "/sitemap.xml") {
    return "public_page"
  }

  if (STATIC_ASSET_EXT.test(path)) {
    return "asset"
  }

  return "public_page"
}

/**
 * Host alias / path SEO redirects apply to these kinds only.
 * @param {PublicRouteKind} kind
 */
export function routeAllowsCanonicalRedirect(kind) {
  return kind === "public_page"
}
