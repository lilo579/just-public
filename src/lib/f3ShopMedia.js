/**
 * Canonical Worker-owned media paths for F3 shop tenants.
 * Prefer relative /presentation/... URLs — never hotlink production SPA origins.
 */

export const F3_3D_JEWISH_MEDIA_ROOT = "/presentation/f3_3d_jewish"

/**
 * @param {string | null | undefined} host
 * @returns {string}
 */
export function resolveF3ShopMediaRoot(host) {
  const h = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
  if (h === "3djewish.com.br" || h === "www.3djewish.com.br") {
    return F3_3D_JEWISH_MEDIA_ROOT
  }
  return ""
}

/**
 * Rewrite legacy SPA-relative or production-hotlinked shop media to Worker paths.
 * Leaves Hub Supabase / absolute non-SPA URLs unchanged.
 *
 * @param {string | null | undefined} raw
 * @param {string | null | undefined} host
 * @returns {string | null}
 */
export function resolveOwnedShopMediaUrl(raw, host) {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!value) return null

  const root = resolveF3ShopMediaRoot(host)
  if (!root) {
    // Non-3D F3 tenants: keep absolute URLs; relativize only if already absolute http.
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
      return value
    }
    return `/${value}`
  }

  // Already Worker-owned.
  if (value.startsWith(root + "/") || value === root) return value
  if (value.startsWith("/branding/3d-jewish/")) return value

  // Hub / JUST storage — keep.
  if (
    value.includes("supabase.co/storage/") ||
    value.includes("/site-assets/") ||
    value.includes("/product-images/")
  ) {
    return value
  }

  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const url = new URL(value)
      const hostName = url.hostname.toLowerCase()
      const isSpaOrigin =
        hostName === "3djewish.com.br" ||
        hostName === "www.3djewish.com.br" ||
        hostName.endsWith(".lovable.app") ||
        hostName.endsWith(".lovableproject.com")
      if (!isSpaOrigin) return value
      return mapSpaPathToOwned(url.pathname, root)
    }
  } catch {
    // fall through
  }

  if (value.startsWith("/")) return mapSpaPathToOwned(value, root)
  return mapSpaPathToOwned(`/${value}`, root)
}

/**
 * @param {string} pathname
 * @param {string} root
 */
function mapSpaPathToOwned(pathname, root) {
  const path = pathname.split("?")[0] || "/"
  if (path === "/hero.jpg" || path.endsWith("/hero.jpg")) return `${root}/hero.jpg`
  if (path.startsWith("/categories/")) return `${root}${path}`
  if (path.startsWith("/lines/")) return `${root}${path}`
  if (path.startsWith("/editorial/")) return `${root}${path}`
  if (path.startsWith("/about/")) return `${root}${path}`
  // Unknown SPA path — still namespace under owned root to avoid production hotlink.
  return `${root}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Canonical hero hierarchy for F3 shop home:
 * 1. HomepageSource catalog.hero.imageUrl (CMS) when present
 * 2. Editorial hero/hero_banner when JUST-owned
 * 3. Worker default /presentation/.../hero.jpg
 *
 * @param {{
 *   host: string
 *   catalogHeroUrl?: string | null
 *   editorialHeroUrl?: string | null
 * }} input
 */
export function resolveCanonicalShopHeroUrl(input) {
  const root = resolveF3ShopMediaRoot(input.host) || F3_3D_JEWISH_MEDIA_ROOT
  const fallback = `${root}/hero.jpg`
  const catalog = resolveOwnedShopMediaUrl(input.catalogHeroUrl, input.host)
  if (catalog) return catalog
  const editorial = resolveOwnedShopMediaUrl(input.editorialHeroUrl, input.host)
  if (editorial) return editorial
  return fallback
}
