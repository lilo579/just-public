/**
 * Packaged institutional site packs (static brand + frozen content).
 * Host → pack map mirrors favicon packaging — not Site Mode branching.
 */

import {
  JUST_BRAND_PACK_SLUG,
  JUST_HOSTS,
  justComingSoonModeConfig,
  justComingSoonSeo,
  justFooter,
  justLegalPages,
  justNotFound,
  justThemeBranding,
} from "./justInstitutionalFreeze.js"

const PACKAGED_INSTITUTIONAL_BY_HOST = Object.freeze(
  Object.fromEntries(JUST_HOSTS.map((host) => [host, JUST_BRAND_PACK_SLUG])),
)

/** Legal paths that stay reachable under COMING_SOON (M1). */
export const INTERSTITIAL_LEGAL_PATHS = Object.freeze([
  "/privacidade",
  "/termos",
  "/seguranca",
])

/**
 * @param {string} host
 */
function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
}

/**
 * @param {string} host
 * @returns {string}
 */
export function resolvePackagedInstitutionalSlug(host) {
  return PACKAGED_INSTITUTIONAL_BY_HOST[normalizeHost(host)] || ""
}

/**
 * @param {string} pathname
 */
export function isInterstitialLegalPath(pathname) {
  const path = String(pathname || "").split("?")[0] || ""
  return INTERSTITIAL_LEGAL_PATHS.includes(path)
}

/**
 * @param {string} host
 * @returns {null | {
 *   slug: string
 *   brandPackBase: string
 *   themeBranding: typeof justThemeBranding
 *   comingSoonConfig: typeof justComingSoonModeConfig
 *   comingSoonSeo: typeof justComingSoonSeo
 *   footer: typeof justFooter
 *   legalPages: typeof justLegalPages
 *   notFound: typeof justNotFound
 *   sitemapPaths: string[]
 * }}
 */
export function resolvePackagedInstitutionalSite(host) {
  const slug = resolvePackagedInstitutionalSlug(host)
  if (!slug) return null
  if (slug !== JUST_BRAND_PACK_SLUG) return null

  return {
    slug,
    brandPackBase: `/branding/${slug}`,
    themeBranding: justThemeBranding,
    comingSoonConfig: justComingSoonModeConfig,
    comingSoonSeo: justComingSoonSeo,
    footer: justFooter,
    legalPages: justLegalPages,
    notFound: justNotFound,
    sitemapPaths: ["/", "/privacidade", "/termos", "/seguranca"],
  }
}

/**
 * Merge Hub site.mode.config over packaged Coming Soon defaults (Hub wins when set).
 * @param {Record<string, unknown> | null | undefined} hubConfig
 * @param {typeof justComingSoonModeConfig | null | undefined} packaged
 */
export function mergeComingSoonConfig(hubConfig, packaged) {
  const base = packaged ? { ...packaged } : {}
  const hub = hubConfig && typeof hubConfig === "object" ? hubConfig : {}
  /** @type {Record<string, unknown>} */
  const out = { ...base }
  for (const [key, value] of Object.entries(hub)) {
    if (value == null) continue
    if (typeof value === "string" && !value.trim()) continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }
  return out
}
