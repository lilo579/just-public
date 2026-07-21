/**
 * Public Worker presentation binding — does not select Family.
 * Canonical path uses painted plan presentation from the payload.
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
  if (choice.mode === "canonical" && choice.plan?.presentation) {
    return {
      profile: choice.plan.presentation.profile,
      chrome: choice.plan.presentation.chrome,
    };
  }

  const profile = resolveF1PresentationProfile(
    homepage?.source?.meta?.presentationProfile ?? DEFAULT_F1_PRESENTATION_PROFILE,
  );
  return {
    profile,
    chrome: resolveF1PresentationChrome(profile),
  };
}
