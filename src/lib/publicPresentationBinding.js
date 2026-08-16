/**
 * Public Worker presentation binding — does not select Family.
 * Cinematic editorial follows resolveCinematicEditorialPolicy (v1 vs legacy).
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
import { resolveCinematicEditorialPolicy } from "./resolveCinematicEditorialPolicy.js";

function structuralPlanChrome(planChrome) {
  if (!planChrome || typeof planChrome !== "object") return {};
  const { cinematicEditorial: _dropped, ...flags } = planChrome;
  return flags;
}

function withEditorialPolicy(profile, planChrome, meta) {
  const resolved = resolveF1PresentationChrome(profile);
  const policy = resolveCinematicEditorialPolicy(meta, planChrome);
  if (policy.mode === "legacy-temporary") {
    return {
      ...resolved,
      ...planChrome,
      cinematicEditorial: policy.cinematicEditorial ?? null,
    };
  }
  return {
    ...resolved,
    ...structuralPlanChrome(planChrome),
    cinematicEditorial: policy.cinematicEditorial,
  };
}

/**
 * @param {import("../contracts/homepage").ResolvedHomepage} homepage
 * @param {{ mode: "canonical"; plan: import("@just/site-engine-authority").SerializableHomepageRenderPlan } | { mode: "legacy" | "error"; plan?: undefined }} choice
 */
export function resolvePublicPresentationBinding(homepage, choice) {
  const meta = homepage?.source?.meta ?? null;
  const fromSource = meta?.presentationProfile;
  const planChrome =
    choice.mode === "canonical" ? choice.plan?.presentation?.chrome : null;
  const planProfile =
    choice.mode === "canonical" ? choice.plan?.presentation?.profile : null;

  if (planChrome && planProfile) {
    if (isF3PresentationProfile(planProfile)) {
      const profile = resolveF3PresentationProfile(planProfile);
      return {
        profile,
        chrome: { ...resolveF3PresentationChrome(profile), ...planChrome },
        family: "f3",
      };
    }
    const profile = resolveF1PresentationProfile(planProfile);
    return {
      profile,
      chrome: withEditorialPolicy(profile, planChrome, meta),
      family: "f1",
    };
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
    if (isF1PresentationProfile(fromSource)) {
      const profile = resolveF1PresentationProfile(fromSource);
      return {
        profile,
        chrome: withEditorialPolicy(profile, null, meta),
        family: "f1",
      };
    }
  }

  const profile = resolveF1PresentationProfile(DEFAULT_F1_PRESENTATION_PROFILE);
  return {
    profile,
    chrome: withEditorialPolicy(profile, null, meta),
    family: "f1",
  };
}
