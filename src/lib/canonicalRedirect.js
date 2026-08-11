/**
 * ADR-SEO-001 Phase 4 — one-hop public canonical redirects.
 *
 * Authority comes only from the payload/RPC contract. Never invent apex/www.
 * Preview/staging skip host redirects so ?host= local simulation keeps working.
 */

import {
  asPublicCanonicalContract,
  fetchPublicCanonicalFromRpc,
  CanonicalAuthorityError,
} from "./canonicalAuthority.js"
import { createPublicSupabaseClient } from "./publicSupabase.js"
import {
  buildPublicSitePayloadUrl,
  normalizeRequestHostname,
} from "./publicHomepageHelpers.js"
import {
  isLeadIntakeSafeMode,
  resolveDeployEnv,
  resolveSitePayloadUrl,
  resolveSupabaseAnonKey,
} from "./runtimeEnv.js"
import {
  classifyPublicRoute,
  normalizePathname,
  routeAllowsCanonicalRedirect,
  STATIC_PUBLIC_PATHS,
} from "./publicRouteKind.js"

/** Internal controls stripped from public redirect Location query. */
export const INTERNAL_REDIRECT_QUERY_PARAMS = Object.freeze([
  "host",
  "debug",
  "renderer",
  "poc",
  "fixture",
  "preview",
  "astro",
  "v",
])

/**
 * Attribution params preserved on redirects (never on canonical/sitemap URLs).
 * Unknown non-internal params are preserved by default.
 */
export const PUBLIC_TRACKING_QUERY_PARAMS = Object.freeze([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "msclkid",
  "ttclid",
])

/** Pilot-safe redirect cache — short browser TTL, no immutable, no s-maxage. */
export const CANONICAL_REDIRECT_CACHE_CONTROL = "public, max-age=60"

/**
 * @param {string | null | undefined} rawHost
 * @returns {string}
 */
export function resolvePhysicalRequestHost(rawHost) {
  const normalized = normalizeRequestHostname(rawHost ?? "")
  return normalized.ok ? normalized.host : ""
}

/**
 * Physical visitor host for redirect decisions.
 * Never uses `?host=` (preview simulation). Never trusts X-Forwarded-Host.
 * When the URL hostname is a listen address, fall back to the Host header.
 *
 * @param {Request} request
 * @param {URL} [url]
 * @returns {string}
 */
export function resolvePhysicalRequestHostFromRequest(request, url = new URL(request.url)) {
  const fromUrl = resolvePhysicalRequestHost(url.hostname)
  if (
    fromUrl &&
    fromUrl !== "localhost" &&
    fromUrl !== "127.0.0.1" &&
    fromUrl !== "0.0.0.0"
  ) {
    return fromUrl
  }
  const headerHost = request.headers.get("host") ?? ""
  return resolvePhysicalRequestHost(headerHost.split(":")[0] ?? "")
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {URLSearchParams}
 */
export function filterPublicRedirectQuery(searchParams) {
  const out = new URLSearchParams()
  const internal = new Set(INTERNAL_REDIRECT_QUERY_PARAMS.map((k) => k.toLowerCase()))
  for (const [key, value] of searchParams.entries()) {
    if (internal.has(String(key).toLowerCase())) continue
    out.append(key, value)
  }
  return out
}

/**
 * Normalize public path for SEO redirects (one logical target).
 * Dynamic slugs are not lowercased.
 *
 * @param {string} pathname
 * @returns {{ pathname: string, reasons: string[] }}
 */
export function normalizePublicSeoPath(pathname) {
  /** @type {string[]} */
  const reasons = []
  let path = normalizePathname(pathname)

  if (path === "/homepage" || path === "/homepage/") {
    reasons.push("homepage")
    path = "/"
  }

  // Trailing slash on internals → strip (homepage stays "/").
  if (path.length > 1 && path.endsWith("/")) {
    reasons.push("trailing_slash")
    path = path.replace(/\/+$/, "") || "/"
  }

  // Case normalization only for known static routes (and their slash variants already stripped).
  const lower = path.toLowerCase()
  if (path !== lower) {
    const staticHit = STATIC_PUBLIC_PATHS.some((p) => p === lower)
    const isDynamic =
      lower.startsWith("/p/") || lower.startsWith("/produto/")
    if (staticHit && !isDynamic) {
      reasons.push("static_case")
      path = lower
    }
  }

  return { pathname: path, reasons }
}

/**
 * Plan a single 301 target. Returns null when no redirect is needed.
 *
 * @param {{
 *   method: string
 *   pathname: string
 *   searchParams: URLSearchParams
 *   requestHost: string
 *   canonical: import('./canonicalAuthority.js').PublicCanonicalContract | null | undefined
 *   deployEnv?: string
 *   routeKind?: import('./publicRouteKind.js').PublicRouteKind
 * }} input
 * @returns {null | {
 *   status: 301
 *   location: string
 *   reasons: string[]
 *   fromHost: string
 *   toHost: string
 *   pathname: string
 * }}
 */
export function planCanonicalRedirect(input) {
  const method = String(input.method || "GET").toUpperCase()
  if (method !== "GET" && method !== "HEAD") return null

  const deployEnv = input.deployEnv
  if (isLeadIntakeSafeMode(deployEnv)) return null

  const routeKind =
    input.routeKind || classifyPublicRoute(input.pathname)
  if (!routeAllowsCanonicalRedirect(routeKind)) return null

  const requestHost = resolvePhysicalRequestHost(input.requestHost)
  if (!requestHost) return null

  // Local listen hosts never participate in public alias redirects.
  if (
    requestHost === "localhost" ||
    requestHost === "127.0.0.1" ||
    requestHost === "0.0.0.0"
  ) {
    return null
  }

  const canonical = asPublicCanonicalContract(input.canonical)
  if (!canonical) return null

  const pathNorm = normalizePublicSeoPath(input.pathname)
  /** @type {string[]} */
  const reasons = [...pathNorm.reasons]

  const hostMismatch = requestHost !== canonical.host
  if (hostMismatch) reasons.push("alias")

  const filteredQuery = filterPublicRedirectQuery(input.searchParams)
  const originalQuery = input.searchParams.toString()
  const nextQuery = filteredQuery.toString()
  const queryChanged = originalQuery !== nextQuery

  if (!hostMismatch && pathNorm.reasons.length === 0 && !queryChanged) {
    return null
  }

  const targetPath = pathNorm.pathname === "/" ? "/" : pathNorm.pathname
  const location = `${canonical.origin.replace(/\/$/, "")}${
    targetPath === "/" ? "/" : targetPath
  }${nextQuery ? `?${nextQuery}` : ""}`

  // Loop guard — never emit Location identical to the current public URL.
  try {
    const locUrl = new URL(location)
    if (
      locUrl.hostname.toLowerCase() === requestHost &&
      normalizePathname(locUrl.pathname) === normalizePathname(input.pathname) &&
      locUrl.searchParams.toString() === originalQuery
    ) {
      return null
    }
  } catch {
    return null
  }

  return {
    status: 301,
    location,
    reasons: reasons.length
      ? reasons
      : queryChanged
        ? ["internal_query"]
        : ["alias"],
    fromHost: requestHost,
    toHost: canonical.host,
    pathname: pathNorm.pathname,
  }
}

/**
 * @param {{
 *   location: string
 *   reasons: string[]
 *   fromHost: string
 *   toHost: string
 *   pathname: string
 *   tenantId?: string | null
 * }} plan
 * @returns {Response}
 */
export function buildCanonicalRedirectResponse(plan) {
  logCanonicalRedirect(plan)
  return new Response(null, {
    status: 301,
    headers: {
      Location: plan.location,
      "Cache-Control": CANONICAL_REDIRECT_CACHE_CONTROL,
      "X-Robots-Tag": "noindex",
    },
  })
}

/**
 * Structured redirect observability — no query string, no PII.
 * @param {{
 *   fromHost: string
 *   toHost: string
 *   pathname: string
 *   reasons: string[]
 *   tenantId?: string | null
 * }} event
 */
export function logCanonicalRedirect(event) {
  const payload = {
    event: "canonical_redirect",
    fromHost: event.fromHost,
    toHost: event.toHost,
    pathname: event.pathname,
    reason: (event.reasons || []).join("+") || "alias",
    tenantId: event.tenantId || undefined,
  }
  console.info(JSON.stringify(payload))
}

/**
 * Resolve canonical authority once for middleware / discovery routes.
 * Prefer public-site-payload.canonical (Edge contract already resolved).
 * Fall back to `public_host_canonical_authority` RPC via the Phase 3 helper when
 * the payload URL is unavailable. Never invent from request host.
 *
 * @param {{ runtime?: { env?: Record<string, unknown> }, publicCanonical?: unknown, publicCanonicalTenantId?: string } | undefined} locals
 * @param {string} host
 * @returns {Promise<{
 *   canonical: ReturnType<typeof asPublicCanonicalContract>
 *   tenantId: string | null
 *   source: 'locals' | 'rpc' | 'payload' | 'none'
 * }>}
 */
export async function resolveRequestCanonicalAuthority(locals, host) {
  const existing = asPublicCanonicalContract(locals?.publicCanonical)
  if (existing && existing.requestHost === host) {
    return {
      canonical: existing,
      tenantId:
        typeof locals?.publicCanonicalTenantId === "string"
          ? locals.publicCanonicalTenantId
          : null,
      source: "locals",
    }
  }

  const payloadUrl = resolveSitePayloadUrl(locals)
  const anonKey = resolveSupabaseAnonKey(locals) ?? ""
  if (payloadUrl) {
    try {
      const url = buildPublicSitePayloadUrl({ kind: "host", host }, "public", payloadUrl)
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      })
      if (res.ok) {
        const homepage = await res.json()
        const canonical = asPublicCanonicalContract(homepage?.canonical)
        const tenantId =
          typeof homepage?.tenantId === "string" ? homepage.tenantId : null
        return { canonical, tenantId, source: canonical ? "payload" : "none" }
      }
    } catch {
      /* controlled miss — try RPC */
    }
  }

  const supabase = createPublicSupabaseClient(locals)
  if (supabase) {
    try {
      const fromRpc = await fetchPublicCanonicalFromRpc(supabase, host)
      if (fromRpc) {
        return { canonical: fromRpc, tenantId: null, source: "rpc" }
      }
    } catch (err) {
      if (!(err instanceof CanonicalAuthorityError)) throw err
    }
  }

  return { canonical: null, tenantId: null, source: "none" }
}

/**
 * Store validated authority on Astro.locals for downstream reuse (same request).
 * @param {Record<string, unknown>} locals
 * @param {{ canonical: unknown, tenantId?: string | null }} auth
 */
export function attachCanonicalToLocals(locals, auth) {
  const canonical = asPublicCanonicalContract(auth.canonical)
  if (!canonical) return
  locals.publicCanonical = canonical
  if (auth.tenantId) locals.publicCanonicalTenantId = auth.tenantId
}

/**
 * @param {import('astro').APIContext['locals']} locals
 * @returns {string | undefined}
 */
export function deployEnvFromLocals(locals) {
  return resolveDeployEnv(locals)
}
