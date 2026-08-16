/**
 * Shared loader for JUST legal / 404 chrome (host-packaged).
 */
import {
  fetchPublicSitePayload,
  HostResolutionError,
  resolveRequestHost,
} from "./publicHomepage"
import {
  isLeadIntakeSafeMode,
  isPocFixtureMode,
  resolveDeployEnv,
  resolveSitePayloadUrl,
  resolveSupabaseAnonKey,
} from "./runtimeEnv.js"
import {
  isPublicationIndexingEnforced,
  publicationFromPayload,
  shouldNoindexFromPublication,
} from "./publicationContract.js"
import { resolvePocFixturePayload } from "../poc/publicSiteFixtures.js"
import {
  mergeComingSoonConfig,
  resolvePackagedInstitutionalSite,
} from "./resolvePackagedInstitutionalSite.js"
import { resolvePublicSiteMode } from "./resolvePublicSiteMode.js"
import { themeTokensFromBranding } from "./themeFromBranding"
import { resolveBrandFaviconUrl, toAbsolutePublicUrl } from "./publicPageSeo.js"
import {
  asPublicCanonicalContract,
  toAbsoluteCanonicalUrl,
} from "./canonicalAuthority.js"

/**
 * @param {Request} request
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} locals
 */
export async function loadJustInstitutionalChrome(request, locals) {
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

  const packaged = resolvePackagedInstitutionalSite(host)
  if (!packaged) {
    return { ok: false, status: 404, reason: "not_just_institutional_host" }
  }

  /** @type {any} */
  let homepage = null
  if (
    locals?.publicSitePayloadHost === host &&
    locals?.publicSitePayload &&
    typeof locals.publicSitePayload === "object"
  ) {
    homepage = locals.publicSitePayload
  } else if (isPocFixtureMode(locals)) {
    homepage = resolvePocFixturePayload(host)
    if (homepage && locals) {
      locals.publicSitePayload = homepage
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
        homepage = fetched.homepage
        if (locals) {
          locals.publicSitePayload = homepage
          locals.publicSitePayloadHost = host
        }
      }
    }
  }

  const siteModeResolved = homepage
    ? resolvePublicSiteMode(homepage)
    : { mode: "COMING_SOON", config: {}, interstitial: true }

  const branding =
    homepage?.source?.meta?.branding &&
    typeof homepage.source.meta.branding === "object"
      ? {
          ...packaged.themeBranding,
          ...homepage.source.meta.branding,
          typography:
            homepage.source.meta.branding.typography ||
            packaged.themeBranding.typography,
          logoHorizontalUrl:
            homepage.source.meta.branding.logoHorizontalUrl ||
            packaged.themeBranding.logoHorizontalUrl,
          logoUrl:
            homepage.source.meta.branding.logoUrl ||
            packaged.themeBranding.logoUrl,
        }
      : packaged.themeBranding

  const deployEnv = resolveDeployEnv(locals)
  const noindex =
    isLeadIntakeSafeMode(deployEnv) ||
    siteModeResolved.mode === "MAINTENANCE" ||
    shouldNoindexFromPublication({
      enforce: isPublicationIndexingEnforced(locals),
      publication: publicationFromPayload(homepage),
      siteMode: siteModeResolved.mode,
    })
  const canonical =
    asPublicCanonicalContract(locals?.publicCanonical) ||
    asPublicCanonicalContract(homepage?.canonical)
  const seoBase = packaged.comingSoonSeo
  const faviconUrl = resolveBrandFaviconUrl({
    host,
    favicon: `/branding/${packaged.slug}/favicon.svg`,
  })
  const ogImage = canonical
    ? toAbsoluteCanonicalUrl(
        canonical.origin,
        `/branding/${packaged.slug}/og-image.jpg`,
      )
    : toAbsolutePublicUrl(host, `/branding/${packaged.slug}/og-image.jpg`)

  return {
    ok: true,
    host,
    packaged,
    homepage,
    canonical,
    deployEnv,
    siteMode: siteModeResolved.mode,
    siteModeConfig: mergeComingSoonConfig(
      siteModeResolved.config,
      packaged.comingSoonConfig,
    ),
    branding,
    tokens: themeTokensFromBranding(branding),
    noindex,
    seo: {
      title: seoBase.title,
      description: seoBase.description,
      faviconUrl,
      ogImage,
      robots: noindex ? "noindex, nofollow" : seoBase.robots,
    },
  }
}
