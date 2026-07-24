/**
 * Public Worker presentation binding — does not select Family.
 * Prefer HomepageSource meta.presentationProfile so Hub authority package
 * updates apply without requiring an Edge Function redeploy for chrome flags.
 * Prefer painted plan chrome when present (includes cinematic editorial overrides).
 */
import {
  DEFAULT_F1_PRESENTATION_PROFILE,
  isF1PresentationProfile,
  isF3PresentationProfile,
  resolveF1PresentationChrome,
  resolveF1PresentationProfile,
  resolveF3PresentationChrome,
  resolveF3PresentationProfile,
} from "@just/site-engine-authority";

/**
 * @param {import("../contracts/homepage").ResolvedHomepage} homepage
 * @param {{ mode: "canonical"; plan: import("@just/site-engine-authority").SerializableHomepageRenderPlan } | { mode: "legacy" | "error"; plan?: undefined }} choice
 */
export function resolvePublicPresentationBinding(homepage, choice) {
  const fromSource = homepage?.source?.meta?.presentationProfile;
  const metaOverride = homepage?.source?.meta?.cinematicEditorial ?? null;
  const planChrome =
    choice.mode === "canonical" ? choice.plan?.presentation?.chrome : null;
  const planProfile =
    choice.mode === "canonical" ? choice.plan?.presentation?.profile : null;

  if (planChrome && planProfile) {
    if (isF3PresentationProfile(planProfile)) {
      const profile = resolveF3PresentationProfile(planProfile);
      // Merge so newer chrome flags (headerOverHero, pill off, …) always apply
      // even when a painted plan ships a partial/stale F3 chrome object.
      return {
        profile,
        chrome: { ...resolveF3PresentationChrome(profile), ...planChrome },
        family: "f3",
      };
    }
    const profile = resolveF1PresentationProfile(planProfile);
    // If meta carries a newer editorial override than a stale Edge plan, re-merge.
    if (metaOverride && profile === "f1.presentation.cinematic_v1") {
      return {
        profile,
        chrome: resolveF1PresentationChrome(profile, {
          cinematicEditorialOverride: metaOverride,
        }),
        family: "f1",
      };
    }
    return { profile, chrome: planChrome, family: "f1" };
  }

  if (fromSource != null && String(fromSource).trim().length > 0) {
    if (isF3PresentationProfile(fromSource)) {
      const profile = resolveF3PresentationProfile(fromSource);
      return {
        profile,
        chrome: resolveF3PresentationChrome(profile),
        family: "f3",
      };
    }
    if (isF1PresentationProfile(fromSource) || true) {
      const profile = resolveF1PresentationProfile(fromSource);
      return {
        profile,
        chrome: resolveF1PresentationChrome(profile, {
          cinematicEditorialOverride: metaOverride,
        }),
        family: "f1",
      };
    }
  }

  const profile = resolveF1PresentationProfile(DEFAULT_F1_PRESENTATION_PROFILE);
  return {
    profile,
    chrome: resolveF1PresentationChrome(profile, {
      cinematicEditorialOverride: metaOverride,
    }),
    family: "f1",
  };
}
