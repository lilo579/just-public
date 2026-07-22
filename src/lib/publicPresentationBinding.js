/**
 * Public Worker presentation binding — does not select Family.
 * Prefer HomepageSource meta.presentationProfile so Hub authority package
 * updates apply without requiring an Edge Function redeploy for chrome flags.
 */
import {
  DEFAULT_F1_PRESENTATION_PROFILE,
  resolveF1PresentationChrome,
  resolveF1PresentationProfile,
} from "@just/site-engine-authority";

/**
 * @param {import("../contracts/homepage").ResolvedHomepage} homepage
 * @param {{ mode: "canonical"; plan: import("@just/site-engine-authority").SerializableHomepageRenderPlan } | { mode: "legacy" | "error"; plan?: undefined }} choice
 */
export function resolvePublicPresentationBinding(homepage, choice) {
  const fromSource = homepage?.source?.meta?.presentationProfile;
  if (fromSource != null && String(fromSource).trim().length > 0) {
    const profile = resolveF1PresentationProfile(fromSource);
    return {
      profile,
      chrome: resolveF1PresentationChrome(profile),
    };
  }

  if (choice.mode === "canonical" && choice.plan?.presentation?.profile) {
    const profile = resolveF1PresentationProfile(choice.plan.presentation.profile);
    return {
      profile,
      chrome:
        choice.plan.presentation.chrome ?? resolveF1PresentationChrome(profile),
    };
  }

  const profile = resolveF1PresentationProfile(DEFAULT_F1_PRESENTATION_PROFILE);
  return {
    profile,
    chrome: resolveF1PresentationChrome(profile),
  };
}
