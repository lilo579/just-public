/**
 * Public Site Modes — resolve operational gate from Hub HomepageSource meta.
 * Never branch on tenantId / host.
 */

import {
  DEFAULT_SITE_MODE,
  isInterstitialSiteMode,
  parseSiteModeConfig,
  resolveSiteMode,
} from "@just/site-engine-authority"

/**
 * @param {unknown} homepage
 * @returns {{
 *   mode: import("@just/site-engine-authority").SiteMode,
 *   config: import("@just/site-engine-authority").SiteModeConfig,
 *   interstitial: boolean,
 * }}
 */
export function resolvePublicSiteMode(homepage) {
  const meta =
    homepage &&
    typeof homepage === "object" &&
    homepage.source &&
    typeof homepage.source === "object" &&
    homepage.source.meta &&
    typeof homepage.source.meta === "object"
      ? homepage.source.meta
      : null

  const mode = resolveSiteMode(meta?.siteMode)
  const fromMeta =
    meta?.siteModeConfig && typeof meta.siteModeConfig === "object"
      ? parseSiteModeConfig(meta.siteModeConfig)
      : {}
  const config = parseSiteModeConfig(fromMeta)

  return {
    mode,
    config,
    interstitial: isInterstitialSiteMode(mode),
  }
}

export { DEFAULT_SITE_MODE, isInterstitialSiteMode, resolveSiteMode, parseSiteModeConfig }
