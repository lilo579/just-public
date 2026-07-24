/**
 * Resolve the tenant brand favicon for /favicon.ico|svg Worker routes.
 * Browsers often ignore <link rel="icon"> and still request /favicon.ico —
 * that path must never serve the Astro scaffold.
 */

import {
  fetchPublicSitePayload,
  HostResolutionError,
  resolveRequestHost,
} from "./publicHomepage"
import { resolveBrandFaviconUrl } from "./publicPageSeo.js"
import {
  isPocFixtureMode,
  resolveSitePayloadUrl,
  resolveSupabaseAnonKey,
} from "./runtimeEnv.js"
import { resolvePocFixturePayload } from "../poc/publicSiteFixtures.js"

/**
 * @param {unknown} homepage
 * @param {string} host
 * @param {{ preferIco?: boolean }} [opts]
 * @returns {string}
 */
function faviconFromHomepage(homepage, host, opts = {}) {
  const source =
    homepage && typeof homepage === "object"
      ? /** @type {{ source?: { meta?: { branding?: Record<string, unknown>, seo?: Record<string, unknown> }, contact?: unknown }, footer?: { logoUrl?: string | null } }} */ (
          homepage
        ).source
      : null
  const branding = source?.meta?.branding ?? null
  const seo = source?.meta?.seo ?? null
  const footerLogo =
    homepage && typeof homepage === "object"
      ? /** @type {{ footer?: { logoUrl?: string | null } }} */ (homepage).footer
          ?.logoUrl
      : null

  const logoUrl = asTrimmed(branding?.logoUrl) || asTrimmed(footerLogo)
  const logoHorizontalUrl = asTrimmed(branding?.logoHorizontalUrl)
  const ogImage =
    asTrimmed(seo?.ogImage) || logoHorizontalUrl || logoUrl || ""

  return resolveBrandFaviconUrl({
    host,
    favicon: seo?.favicon,
    ogImage,
    logoHorizontalUrl,
    logoUrl,
    preferIco: opts.preferIco === true,
  })
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * @param {Request} request
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} locals
 * @returns {Promise<string>}
 */
export async function resolveRequestFaviconUrl(request, locals) {
  const url = new URL(request.url)
  const preferIco = url.pathname.toLowerCase().endsWith(".ico")
  let host
  try {
    host = resolveRequestHost(request, url.searchParams)
  } catch (err) {
    if (err instanceof HostResolutionError) return ""
    throw err
  }

  if (isPocFixtureMode(locals)) {
    const fixture = resolvePocFixturePayload(host)
    return fixture ? faviconFromHomepage(fixture, host, { preferIco }) : ""
  }

  const payloadUrl = resolveSitePayloadUrl(locals)
  const anonKey = resolveSupabaseAnonKey(locals) ?? ""
  if (!payloadUrl) return ""

  const fetched = await fetchPublicSitePayload({ kind: "host", host }, "public", {
    payloadUrl,
    anonKey,
  })
  if (!fetched.ok) return ""
  return faviconFromHomepage(fetched.homepage, host, { preferIco })
}
