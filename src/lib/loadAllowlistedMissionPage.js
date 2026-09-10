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

export { missionRoutesFromPayload }

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

  return {
    ok: true,
    host,
    path,
    kind,
    route: resolved.route,
    payload,
    seo: {
      title: typeof seoMeta.title === "string" ? seoMeta.title : "",
      description: typeof seoMeta.description === "string" ? seoMeta.description : "",
      robots: noindex ? "noindex,nofollow" : "index,follow",
      canonicalUrl,
    },
    noindex,
  }
}
