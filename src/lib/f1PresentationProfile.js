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
      benefitsAsFeatureCards: false,
      servicesAsCardGrid: true,
      processIndexIcons: false,
      justSignatureBand: false,
      headerPillChrome: false,
    }
  }
  return {
    profile: "f1.presentation.engine_v1",
    trustOverlapsHero: true,
    benefitsAsFeatureCards: true,
    servicesAsCardGrid: false,
    processIndexIcons: true,
    justSignatureBand: true,
    headerPillChrome: true,
  }
}
