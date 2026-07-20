/**
 * F1 Presentation Profiles — Public Layer mirror (no Hub imports).
 * Keep in sync with just-auth-nexus/.../f1PresentationProfile.ts
 */

export const F1_PRESENTATION_PROFILES = [
  "f1.presentation.engine_v1",
  "f1.presentation.classic_v1",
]

/**
 * @typedef {"f1.presentation.engine_v1" | "f1.presentation.classic_v1"} F1PresentationProfile
 * @typedef {"light" | "dark"} FooterSurface
 * @typedef {"primary" | "muted"} FooterSocialIconEmphasis
 * @typedef {"engine-preserving" | "mono-adaptive"} FooterLogoStrategy
 */

export const DEFAULT_F1_PRESENTATION_PROFILE = "f1.presentation.engine_v1"

/**
 * @param {unknown} value
 * @returns {value is F1PresentationProfile}
 */
export function isF1PresentationProfile(value) {
  return typeof value === "string" && F1_PRESENTATION_PROFILES.includes(value)
}

/**
 * @param {string | null | undefined} raw
 * @returns {F1PresentationProfile}
 */
export function resolveF1PresentationProfile(raw) {
  if (raw == null) return DEFAULT_F1_PRESENTATION_PROFILE
  const trimmed = String(raw).trim()
  if (isF1PresentationProfile(trimmed)) return trimmed
  return DEFAULT_F1_PRESENTATION_PROFILE
}

/**
 * @param {F1PresentationProfile} profile
 */
export function resolveF1PresentationChrome(profile) {
  if (profile === "f1.presentation.classic_v1") {
    return {
      profile,
      trustOverlapsHero: false,
      benefitsAsFeatureCards: true,
      benefitsLayout: "classic-feature-cards",
      servicesLayout: "classic-split",
      servicesAsCardGrid: false,
      processIndexIcons: true,
      processBadgeEmphasis: "primary",
      attendancePillIconEmphasis: "primary",
      justSignatureBand: false,
      headerPillChrome: false,
      headerLogoSource: "brand",
      footerSurface: "light",
      footerSocialIconEmphasis: "primary",
      footerLogoStrategy: "mono-adaptive",
    }
  }
  return {
    profile: "f1.presentation.engine_v1",
    trustOverlapsHero: true,
    benefitsAsFeatureCards: true,
    benefitsLayout: "engine-features",
    servicesLayout: "engine-list",
    servicesAsCardGrid: false,
    processIndexIcons: true,
    processBadgeEmphasis: "accent",
    attendancePillIconEmphasis: "accent",
    justSignatureBand: true,
    headerPillChrome: true,
    headerLogoSource: "horizontal",
    footerSurface: "light",
    footerSocialIconEmphasis: "muted",
    footerLogoStrategy: "engine-preserving",
  }
}

/**
 * @param {string | null | undefined} value
 */
function trimUrl(value) {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Resolve header logo from branding — profile selects asset priority, not tenant.
 * @param {{
 *   logoUrl?: string | null
 *   logoHorizontalUrl?: string | null
 *   logoWhiteUrl?: string | null
 * } | null | undefined} branding
 * @param {ReturnType<typeof resolveF1PresentationChrome>} chrome
 */
export function resolveHeaderLogoUrl(branding, chrome) {
  const brand = trimUrl(branding?.logoUrl)
  const horizontal = trimUrl(branding?.logoHorizontalUrl)
  if (chrome.headerLogoSource === "brand") {
    return brand || horizontal || ""
  }
  return horizontal || brand || ""
}

/**
 * Footer logo — independent from header; mono-adaptive for classic_v1.
 * @param {{
 *   logoUrl?: string | null
 *   logoHorizontalUrl?: string | null
 *   logoWhiteUrl?: string | null
 * } | null | undefined} branding
 * @param {ReturnType<typeof resolveF1PresentationChrome>} chrome
 */
export function resolveFooterLogoUrl(branding, chrome) {
  const brand = trimUrl(branding?.logoUrl)
  const horizontal = trimUrl(branding?.logoHorizontalUrl)
  const white = trimUrl(branding?.logoWhiteUrl)

  if (chrome.footerLogoStrategy === "engine-preserving") {
    return horizontal || brand || ""
  }

  const surface = chrome.footerSurface === "dark" ? "dark" : "light"
  if (surface === "dark") {
    return white || horizontal || brand || ""
  }
  return horizontal || brand || ""
}
