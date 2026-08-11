/**
 * ADR-SEO-001 Phase 6 — request-scoped public context (payload + canonical).
 *
 * Single orchestration point for middleware / pages / loaders.
 * Dedupes in-flight work via Astro.locals only — never module-global cache.
 */

import {
  asPublicCanonicalContract,
  CanonicalAuthorityError,
  canonicalAuthorityErrorResponse,
  fetchPublicCanonicalFromRpc,
} from "./canonicalAuthority.js"
import { createPublicSupabaseClient } from "./publicSupabase.js"
import {
  buildPublicSitePayloadUrl,
} from "./publicHomepageHelpers.js"
import {
  isLeadIntakeSafeMode,
  isPocFixtureMode,
  resolveDeployEnv,
  resolveSitePayloadUrl,
  resolveSupabaseAnonKey,
} from "./runtimeEnv.js"
import { resolvePocFixturePayload } from "../poc/publicSiteFixtures.js"
import { classifyPublicRoute } from "./publicRouteKind.js"
import {
  resolvePhysicalRequestHostFromRequest,
} from "./canonicalRedirect.js"

/** Contract version exposed by /health (non-sensitive). */
export const PUBLIC_CANONICAL_CONTRACT_VERSION = "seo001-v1"

/**
 * @typedef {'payload' | 'rpc' | 'locals' | 'fixture' | 'none'} CanonicalResolutionSource
 * @typedef {'ok' | 'missing_primary' | 'host_not_resolved' | 'unavailable' | 'skipped'} CanonicalResolutionResult
 *
 * @typedef {{
 *   requestHost: string
 *   deployEnv: string | undefined
 *   safeMode: boolean
 *   routeKind: import('./publicRouteKind.js').PublicRouteKind
 *   canonical: import('./canonicalAuthority.js').PublicCanonicalContract | null
 *   payload: object | null
 *   tenantId: string | null
 *   resolutionSource: CanonicalResolutionSource
 *   result: CanonicalResolutionResult
 *   errorCode: string | null
 *   timings: { hostMs: number, payloadMs: number, canonicalMs: number, totalMs: number }
 *   counters: { payloadFetches: number, rpcCalls: number, hostResolves: number, canonicalParses: number }
 *   loggedResolution: boolean
 * }} PublicRequestContext
 */

/**
 * @param {Record<string, unknown>} locals
 * @returns {PublicRequestContext | null}
 */
export function getPublicRequestContext(locals) {
  const ctx = locals?.publicRequestContext
  return ctx && typeof ctx === "object" ? /** @type {PublicRequestContext} */ (ctx) : null
}

/**
 * Structured log — no query, cookies, auth, or content body.
 * @param {string} event
 * @param {Record<string, unknown>} fields
 */
export function logPublicSeoEvent(event, fields) {
  console.info(
    JSON.stringify({
      event,
      ...fields,
    }),
  )
}

/**
 * @param {PublicRequestContext} ctx
 * @param {{ pathname?: string, status?: number }} [extra]
 */
export function logCanonicalResolutionOnce(ctx, extra = {}) {
  if (ctx.loggedResolution) return
  ctx.loggedResolution = true
  logPublicSeoEvent("canonical_resolution", {
    requestHost: ctx.requestHost,
    canonicalHost: ctx.canonical?.host || undefined,
    pathname: extra.pathname,
    routeKind: ctx.routeKind,
    resolutionSource: ctx.resolutionSource,
    result: ctx.result,
    status: extra.status,
    durationMs: ctx.timings.totalMs,
    deployEnv: ctx.deployEnv || undefined,
    tenantId: ctx.tenantId || undefined,
    payloadFetches: ctx.counters.payloadFetches,
    rpcCalls: ctx.counters.rpcCalls,
  })
  if (ctx.result === "ok" && ctx.resolutionSource === "locals") {
    logPublicSeoEvent("canonical_context_reused", {
      requestHost: ctx.requestHost,
      pathname: extra.pathname,
    })
  }
  if (ctx.result !== "ok" && ctx.result !== "skipped") {
    logPublicSeoEvent("canonical_resolution_failed", {
      requestHost: ctx.requestHost,
      pathname: extra.pathname,
      result: ctx.result,
      errorCode: ctx.errorCode || undefined,
      status: extra.status,
    })
  }
}

/**
 * @param {PublicRequestContext} ctx
 * @returns {string}
 */
export function buildServerTimingHeader(ctx) {
  const parts = [
    `canonical;dur=${Math.max(0, Math.round(ctx.timings.canonicalMs))}`,
    `payload;dur=${Math.max(0, Math.round(ctx.timings.payloadMs))}`,
    `host;dur=${Math.max(0, Math.round(ctx.timings.hostMs))}`,
  ]
  return parts.join(", ")
}

/**
 * @param {string | undefined} deployEnv
 * @param {Record<string, unknown> | undefined} locals
 */
export function shouldEmitServerTiming(deployEnv, locals) {
  if (isLeadIntakeSafeMode(deployEnv)) return true
  const flag =
    typeof locals?.runtime === "object" &&
    locals.runtime &&
    typeof /** @type {{ env?: Record<string, unknown> }} */ (locals.runtime).env ===
      "object"
      ? /** @type {{ env?: Record<string, string> }} */ (locals.runtime).env
          ?.PUBLIC_SERVER_TIMING
      : undefined
  return String(flag || "").trim().toLowerCase() === "true"
}

/**
 * Controlled failure responses for public SEO surfaces.
 * @param {string} code
 * @param {number} status
 */
export function publicAuthorityFailureResponse(code, status) {
  const err = new CanonicalAuthorityError(code, `Site unavailable (${code})`, status)
  return canonicalAuthorityErrorResponse(err)
}

/**
 * Fetch payload once; store on locals for reuse.
 * @param {Record<string, unknown>} locals
 * @param {string} host
 * @param {{ counters: PublicRequestContext['counters'], timings: PublicRequestContext['timings'] }} meter
 */
async function loadPayloadOnce(locals, host, meter) {
  if (
    locals.publicSitePayload &&
    typeof locals.publicSitePayload === "object" &&
    locals.publicSitePayloadHost === host
  ) {
    logPublicSeoEvent("public_payload_reused", { requestHost: host })
    return {
      ok: true,
      homepage: /** @type {object} */ (locals.publicSitePayload),
      status: 200,
      reused: true,
    }
  }

  if (locals.publicSitePayloadPromise && locals.publicSitePayloadHost === host) {
    const reused = await /** @type {Promise<any>} */ (locals.publicSitePayloadPromise)
    logPublicSeoEvent("public_payload_reused", { requestHost: host, via: "promise" })
    return reused
  }

  const started = Date.now()
  const run = (async () => {
    meter.counters.payloadFetches += 1
    if (isPocFixtureMode(locals)) {
      const fixture = resolvePocFixturePayload(host)
      if (!fixture) {
        return { ok: false, homepage: null, status: 404, reused: false }
      }
      locals.publicSitePayload = fixture
      locals.publicSitePayloadHost = host
      return { ok: true, homepage: fixture, status: 200, reused: false }
    }

    const payloadUrl = resolveSitePayloadUrl(locals)
    const anonKey = resolveSupabaseAnonKey(locals) ?? ""
    if (!payloadUrl) {
      return { ok: false, homepage: null, status: 503, reused: false, code: "payload_url_missing" }
    }

    try {
      const url = buildPublicSitePayloadUrl({ kind: "host", host }, "public", payloadUrl)
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      })
      if (!res.ok) {
        return {
          ok: false,
          homepage: null,
          status: res.status,
          reused: false,
          code: res.status === 404 ? "host_not_resolved" : "payload_unavailable",
        }
      }
      const homepage = await res.json()
      locals.publicSitePayload = homepage
      locals.publicSitePayloadHost = host
      return { ok: true, homepage, status: 200, reused: false }
    } catch {
      return {
        ok: false,
        homepage: null,
        status: 503,
        reused: false,
        code: "canonical_authority_unavailable",
      }
    }
  })()

  locals.publicSitePayloadPromise = run
  locals.publicSitePayloadHost = host
  try {
    const result = await run
    meter.timings.payloadMs += Date.now() - started
    return result
  } finally {
    if (locals.publicSitePayloadPromise === run) {
      delete locals.publicSitePayloadPromise
    }
  }
}

/**
 * Resolve (or reuse) the full public request context.
 *
 * @param {Request} request
 * @param {URL} url
 * @param {Record<string, unknown>} locals
 * @param {{
 *   preferRpc?: boolean
 *   force?: boolean
 * }} [options]
 * @returns {Promise<PublicRequestContext>}
 */
export async function resolvePublicRequestContext(request, url, locals, options = {}) {
  const deployEnv = resolveDeployEnv(locals)
  const safeMode = isLeadIntakeSafeMode(deployEnv)
  const routeKind = classifyPublicRoute(url.pathname)

  const hostStarted = Date.now()
  const requestHost = resolvePhysicalRequestHostFromRequest(request, url)
  const hostMs = Date.now() - hostStarted

  const existing = getPublicRequestContext(locals)
  if (
    !options.force &&
    existing &&
    existing.requestHost === requestHost &&
    existing.routeKind === routeKind
  ) {
    existing.counters.hostResolves += 1
    logPublicSeoEvent("canonical_context_reused", {
      requestHost,
      pathname: url.pathname,
      resolutionSource: "locals",
    })
    return existing
  }

  if (!options.force && locals.publicRequestContextPromise) {
    return /** @type {Promise<PublicRequestContext>} */ (locals.publicRequestContextPromise)
  }

  const totalStarted = Date.now()
  /** @type {PublicRequestContext['counters']} */
  const counters = {
    payloadFetches: 0,
    rpcCalls: 0,
    hostResolves: 1,
    canonicalParses: 0,
  }
  /** @type {PublicRequestContext['timings']} */
  const timings = {
    hostMs,
    payloadMs: 0,
    canonicalMs: 0,
    totalMs: 0,
  }

  const build = async () => {
    /** @type {PublicRequestContext} */
    const ctx = {
      requestHost,
      deployEnv,
      safeMode,
      routeKind,
      canonical: null,
      payload: null,
      tenantId: null,
      resolutionSource: "none",
      result: "skipped",
      errorCode: null,
      timings,
      counters,
      loggedResolution: false,
    }

    if (!requestHost) {
      ctx.result = "host_not_resolved"
      ctx.errorCode = "invalid_host"
      timings.totalMs = Date.now() - totalStarted
      locals.publicRequestContext = ctx
      return ctx
    }

    // Assets / health: no authority work.
    if (routeKind === "asset" || routeKind === "operational") {
      ctx.result = "skipped"
      timings.totalMs = Date.now() - totalStarted
      locals.publicRequestContext = ctx
      return ctx
    }

    const canonStarted = Date.now()

    // Prefer locals canonical already attached (same host).
    const priorCanonical = asPublicCanonicalContract(locals.publicCanonical)
    if (priorCanonical && priorCanonical.requestHost === requestHost) {
      counters.canonicalParses += 1
      ctx.canonical = priorCanonical
      ctx.tenantId =
        typeof locals.publicCanonicalTenantId === "string"
          ? locals.publicCanonicalTenantId
          : null
      ctx.payload =
        locals.publicSitePayloadHost === requestHost && locals.publicSitePayload
          ? /** @type {object} */ (locals.publicSitePayload)
          : null
      ctx.resolutionSource = "locals"
      ctx.result = "ok"
      timings.canonicalMs += Date.now() - canonStarted
      timings.totalMs = Date.now() - totalStarted
      locals.publicRequestContext = ctx
      return ctx
    }

    if (options.preferRpc) {
      const supabase = createPublicSupabaseClient(locals)
      if (supabase) {
        try {
          counters.rpcCalls += 1
          const fromRpc = await fetchPublicCanonicalFromRpc(supabase, requestHost)
          counters.canonicalParses += 1
          if (fromRpc) {
            ctx.canonical = fromRpc
            ctx.resolutionSource = "rpc"
            ctx.result = "ok"
            locals.publicCanonical = fromRpc
            timings.canonicalMs += Date.now() - canonStarted
            timings.totalMs = Date.now() - totalStarted
            locals.publicRequestContext = ctx
            return ctx
          }
          ctx.result = "missing_primary"
          ctx.errorCode = "missing_primary_domain"
        } catch (err) {
          if (err instanceof CanonicalAuthorityError && err.code === "canonical_rpc_failed") {
            ctx.result = "unavailable"
            ctx.errorCode = "canonical_authority_unavailable"
          } else if (err instanceof CanonicalAuthorityError) {
            ctx.result = "unavailable"
            ctx.errorCode = err.code
          } else {
            ctx.result = "unavailable"
            ctx.errorCode = "canonical_authority_unavailable"
          }
        }
      }
    }

    const loaded = await loadPayloadOnce(locals, requestHost, { counters, timings })
    if (loaded.ok && loaded.homepage) {
      ctx.payload = loaded.homepage
      ctx.tenantId =
        typeof /** @type {{ tenantId?: string }} */ (loaded.homepage).tenantId === "string"
          ? /** @type {{ tenantId: string }} */ (loaded.homepage).tenantId
          : null
      counters.canonicalParses += 1
      const canonical = asPublicCanonicalContract(
        /** @type {{ canonical?: unknown }} */ (loaded.homepage).canonical,
      )
      if (canonical) {
        ctx.canonical = canonical
        ctx.resolutionSource = loaded.reused ? "locals" : "payload"
        // If reused payload but first parse, source stays payload semantics for authority.
        if (loaded.reused) ctx.resolutionSource = "locals"
        else ctx.resolutionSource = "payload"
        ctx.result = "ok"
        locals.publicCanonical = canonical
        if (ctx.tenantId) locals.publicCanonicalTenantId = ctx.tenantId
      } else if (safeMode) {
        ctx.result = "skipped"
        ctx.resolutionSource = "payload"
      } else {
        ctx.result = "missing_primary"
        ctx.errorCode = "missing_primary_domain"
        ctx.resolutionSource = "payload"
      }
    } else if (loaded.status === 404) {
      ctx.result = "host_not_resolved"
      ctx.errorCode = "host_not_resolved"
    } else if (safeMode) {
      ctx.result = "skipped"
    } else {
      ctx.result = "unavailable"
      ctx.errorCode = loaded.code || "canonical_authority_unavailable"
    }

    timings.canonicalMs += Date.now() - canonStarted
    timings.totalMs = Date.now() - totalStarted
    locals.publicRequestContext = ctx
    return ctx
  }

  const promise = build()
  locals.publicRequestContextPromise = promise
  try {
    return await promise
  } finally {
    if (locals.publicRequestContextPromise === promise) {
      delete locals.publicRequestContextPromise
    }
  }
}

/**
 * Middleware helper: fail closed for production public HTML/discovery when authority missing.
 * @param {PublicRequestContext} ctx
 * @param {string} pathname
 * @returns {Response | null}
 */
export function publicAuthorityGateResponse(ctx, pathname) {
  if (ctx.safeMode) return null
  if (ctx.routeKind !== "public_page") return null
  if (ctx.result === "ok" || ctx.result === "skipped") return null

  if (ctx.result === "missing_primary") {
    logCanonicalResolutionOnce(ctx, { pathname, status: 422 })
    return publicAuthorityFailureResponse("missing_primary_domain", 422)
  }
  if (ctx.result === "unavailable") {
    logCanonicalResolutionOnce(ctx, { pathname, status: 503 })
    if (ctx.errorCode === "payload_url_missing") {
      return new Response("PUBLIC_SITE_PAYLOAD_URL missing", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      })
    }
    return publicAuthorityFailureResponse(
      ctx.errorCode || "canonical_authority_unavailable",
      503,
    )
  }
  if (ctx.result === "host_not_resolved") {
    // Unknown host: controlled miss without inventing SEO.
    logCanonicalResolutionOnce(ctx, { pathname, status: 404 })
    return new Response("Site unavailable (host_not_resolved)", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    })
  }
  return null
}
