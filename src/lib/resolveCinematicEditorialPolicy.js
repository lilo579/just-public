/**
 * Cinematic editorial chrome policy (temporary legacy fallback).
 *
 * Marker absent → Edge legado: keep plan.chrome.cinematicEditorial.
 * Marker v1 → Hub payload is authoritative; ignore plan factory blob.
 * Unknown marker or contradictory mix → fail closed (no editorial chrome).
 *
 * TEMPORARY: legacy branch must be removed after every Edge is on v1.
 * Never branch on host / slug / tenantId.
 */
import {
  CINEMATIC_EDITORIAL_CONTRACT_VERSION,
  parseCinematicEditorial,
} from "@just/site-engine-authority";

export const CINEMATIC_EDITORIAL_CONTRACT_V1 = CINEMATIC_EDITORIAL_CONTRACT_VERSION;

/**
 * @param {unknown} meta
 * @param {unknown} planChrome
 * @returns {{ mode: "legacy-temporary" | "v1" | "fail-closed", cinematicEditorial: unknown }}
 */
export function resolveCinematicEditorialPolicy(meta, planChrome) {
  const versionRaw =
    meta && typeof meta === "object" && "cinematicEditorialContractVersion" in meta
      ? meta.cinematicEditorialContractVersion
      : undefined;
  const planEditorial =
    planChrome && typeof planChrome === "object" && "cinematicEditorial" in planChrome
      ? planChrome.cinematicEditorial
      : null;
  const metaEditorial =
    meta && typeof meta === "object" && "cinematicEditorial" in meta
      ? meta.cinematicEditorial
      : null;

  if (versionRaw == null || versionRaw === "") {
    return {
      mode: "legacy-temporary",
      cinematicEditorial: planEditorial ?? null,
    };
  }

  if (typeof versionRaw !== "string" || versionRaw.trim() !== CINEMATIC_EDITORIAL_CONTRACT_V1) {
    return { mode: "fail-closed", cinematicEditorial: null };
  }

  // v1 never merges with the plan blob — even when both are present.
  return {
    mode: "v1",
    cinematicEditorial: parseCinematicEditorial(metaEditorial),
  };
}
