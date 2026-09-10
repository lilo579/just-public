/**
 * Shared helpers for F4 allowlisted mission child routes (content_page /
 * form_signup_shell). Host-bound via public payload — no tenant id authority
 * from the client.
 */

import { resolvePocFixturePayload } from "../poc/publicSiteFixtures.js"
import {
  isLeadIntakeSafeMode,
  isPocFixtureMode,
  resolveDeployEnv,
  resolveSitePayloadUrl,
  resolveSupabaseAnonKey,
} from "./runtimeEnv.js"
import {
  asPublicCanonicalContract,
  buildCanonicalUrl,
} from "./canonicalAuthority.js"
import { resolveAllowlistedMissionRoute } from "./resolveAllowlistedMissionRoute.js"
import { missionRoutesFromPayload } from "./missionRoutesFromPayload.js"
import {
  fetchPublicSitePayload,
  HostResolutionError,
  resolveRequestHost,
} from "./publicHomepage"
import { chooseHomepageRenderer } from "./publicHomepageHelpers.js"
import { resolvePublicPresentationBinding } from "./publicPresentationBinding.js"
import { themeTokensFromBranding } from "./themeFromBranding.js"
import {
  resolveHeaderLogoUrl,
  resolveHeaderOverHeroLogoUrl,
  resolveFooterLogoUrl,
} from "@just/site-engine-authority"

export { missionRoutesFromPayload }

/**
 * Extract Header/Footer chrome fields from a host-bound mission payload.
 * @param {any} payload
 */
export function missionChromeFromPayload(payload) {
  if (!payload || typeof payload !== "object") return null

  const choice = chooseHomepageRenderer(payload)
  const binding = resolvePublicPresentationBinding(payload, choice)
  const presentationChrome =
    binding?.chrome && typeof binding.chrome === "object" ? binding.chrome : {}
  const branding = payload?.source?.meta?.branding ?? null
  const contact = payload?.source?.contact ?? payload?.footer ?? null
  const companyName =
    contact?.companyName ||
    payload?.footer?.companyName ||
    "Site"

  const whatsappDigits = String(contact?.whatsappNumber || "").replace(/\D/g, "")
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : ""

  const navItems = Array.isArray(presentationChrome.navItems)
    ? presentationChrome.navItems
    : []
  const legalLinks = Array.isArray(presentationChrome.legalLinks)
    ? presentationChrome.legalLinks
    : []
  const headerCtaLabel =
    typeof presentationChrome.headerCtaLabel === "string" &&
    presentationChrome.headerCtaLabel.trim()
      ? presentationChrome.headerCtaLabel.trim()
      : ""
  const headerCtaHref =
    typeof presentationChrome.headerCtaHref === "string" &&
    presentationChrome.headerCtaHref.trim()
      ? presentationChrome.headerCtaHref.trim()
      : ""

  const socialLinks = (
    payload?.source?.meta?.footer?.socialLinks ||
    payload?.footer?.socialLinks ||
    []
  ).filter((link) => typeof link?.url === "string" && link.url.trim())

  return {
    companyName,
    branding,
    contact: {
      companyName,
      email: contact?.email ?? payload?.footer?.email ?? null,
      address: contact?.address ?? payload?.footer?.address ?? null,
      whatsappNumber: contact?.whatsappNumber ?? payload?.footer?.whatsappNumber ?? null,
      whatsappVisible:
        contact?.whatsappVisible === true ||
        payload?.footer?.whatsappVisible === true,
    },
    navItems,
    legalLinks,
    headerCtaLabel,
    headerCtaHref,
    whatsappHref,
    logoUrl: resolveHeaderLogoUrl(branding, presentationChrome) || "",
    logoOverHeroUrl:
      resolveHeaderOverHeroLogoUrl(branding, presentationChrome) || "",
    footerLogoUrl: resolveFooterLogoUrl(branding, presentationChrome) || "",
    footerTagline: payload?.footer?.tagline ?? null,
    footerSurface:
      presentationChrome.footerSurface === "light" ||
      presentationChrome.footerSurface === "dark"
        ? presentationChrome.footerSurface
        : "dark",
    justSignatureBand: presentationChrome.justSignatureBand !== false,
    headerPillChrome: presentationChrome.headerPillChrome !== false,
    socialLinks,
    tokens: themeTokensFromBranding(branding),
    presentationProfile: binding?.profile ?? null,
    family: binding?.family ?? "f4",
  }
}

/**
 * @param {Request} request
 * @param {{ runtime?: { env?: Record<string, unknown> }, publicSitePayload?: unknown, publicSitePayloadHost?: string } | undefined} locals
 * @param {string} path
 * @param {"content_page"|"form_signup_shell"} kind
 */
export async function loadAllowlistedMissionPage(request, locals, path, kind) {
  const requestUrl = new URL(request.url)
  let host
  try {
    host = resolveRequestHost(request, requestUrl.searchParams)
  } catch (err) {
    const reason =
      err instanceof HostResolutionError ||
      (err && typeof err === "object" && "reason" in err)
        ? String(/** @type {{ reason: string }} */ (err).reason)
        : "invalid_host"
    return { ok: false, status: 400, reason }
  }

  /** @type {any} */
  let payload = null
  if (
    locals?.publicSitePayloadHost === host &&
    locals?.publicSitePayload &&
    typeof locals.publicSitePayload === "object"
  ) {
    payload = locals.publicSitePayload
  } else if (isPocFixtureMode(locals)) {
    payload = resolvePocFixturePayload(host)
    if (payload && locals) {
      locals.publicSitePayload = payload
      locals.publicSitePayloadHost = host
    }
  } else {
    const payloadUrl = resolveSitePayloadUrl(locals)
    const anonKey = resolveSupabaseAnonKey(locals) ?? ""
    if (payloadUrl) {
      const fetched = await fetchPublicSitePayload({ kind: "host", host }, "public", {
        payloadUrl,
        anonKey,
      })
      if (fetched.ok) {
        payload = fetched.homepage
        if (locals) {
          locals.publicSitePayload = payload
          locals.publicSitePayloadHost = host
        }
      }
    }
  }

  const routes = missionRoutesFromPayload(payload)
  const resolved = resolveAllowlistedMissionRoute(
    host,
    path,
    kind,
    routes.length > 0 ? routes : undefined,
  )
  if (!resolved) {
    return { ok: false, status: 404, reason: "mission_route_not_allowlisted", host }
  }

  const deployEnv = resolveDeployEnv(locals)
  const noindex = isLeadIntakeSafeMode(deployEnv)
  const seoMeta = payload?.source?.meta?.seo ?? resolved.fixture?.source?.meta?.seo ?? {}
  const canonical = asPublicCanonicalContract(payload?.canonical)
  const canonicalUrl = canonical
    ? buildCanonicalUrl(canonical, path)
    : `https://${host}${path}`

  const chromeSource = payload || resolved.fixture || null
  const chrome = missionChromeFromPayload(chromeSource)

  return {
    ok: true,
    host,
    path,
    kind,
    route: resolved.route,
    payload,
    chrome,
    seo: {
      title: typeof seoMeta.title === "string" ? seoMeta.title : "",
      description: typeof seoMeta.description === "string" ? seoMeta.description : "",
      robots: noindex ? "noindex,nofollow" : "index,follow",
      canonicalUrl,
    },
    noindex,
  }
}
