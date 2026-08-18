import { defineMiddleware } from "astro:middleware"
import { isLeadIntakeSafeMode, resolveDeployEnv } from "./lib/runtimeEnv.js"
import { resolveHtmlCacheControl } from "./lib/cacheHeaders.js"
import {
  isPublicationIndexingEnforced,
  publicationFromPayload,
  shouldApplyPublicationIndexingHeaders,
  shouldNoindexFromPublication,
} from "./lib/publicationContract.js"
import { classifyPublicRoute } from "./lib/publicRouteKind.js"
import {
  buildCanonicalRedirectResponse,
  planCanonicalRedirect,
  resolvePhysicalRequestHostFromRequest,
  resolvePublicRequestProtocol,
} from "./lib/canonicalRedirect.js"
import {
  buildServerTimingHeader,
  getPublicRequestContext,
  logCanonicalResolutionOnce,
  publicAuthorityGateResponse,
  resolvePublicRequestContext,
  shouldEmitServerTiming,
} from "./lib/publicRequestContext.js"

/**
 * Preview/staging indexing guard + ADR-SEO-001 Phase 4–6 request context.
 *
 * Phase 6: resolve payload/canonical once per request into Astro.locals;
 * fail closed for production public pages; no shared edge cache of authority.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const deployEnv = resolveDeployEnv(context.locals)
  const pathname = context.url.pathname
  const routeKind = classifyPublicRoute(pathname)
  const method = context.request.method.toUpperCase()
  const locals = /** @type {Record<string, unknown>} */ (context.locals)
  const safeMode = isLeadIntakeSafeMode(deployEnv)
  const physicalHost = resolvePhysicalRequestHostFromRequest(
    context.request,
    context.url,
  )
  const loopback =
    !physicalHost ||
    physicalHost === "localhost" ||
    physicalHost === "127.0.0.1"
  const explicitSafeHostSimulation =
    safeMode && context.url.searchParams.has("host")

  // Production always resolves authority for public pages.
  // Preview/staging lets the page own explicit ?host= simulation, including
  // versioned Cloudflare preview URLs whose physical host is not a tenant.
  // Invalid ?host= still fails at the page without a spurious payload fetch.
  const shouldResolveAuthority =
    (method === "GET" || method === "HEAD") &&
    routeKind === "public_page" &&
    (!safeMode || (!loopback && !explicitSafeHostSimulation))

  if (shouldResolveAuthority) {
    const ctx = await resolvePublicRequestContext(
      context.request,
      context.url,
      locals,
    )

    // Production public surfaces: no silent fail-open without authority.
    if (!safeMode) {
      const gated = publicAuthorityGateResponse(ctx, pathname)
      if (gated) {
        if (shouldEmitServerTiming(deployEnv, locals)) {
          gated.headers.set("Server-Timing", buildServerTimingHeader(ctx))
        }
        return gated
      }

      if (ctx.canonical) {
        const plan = planCanonicalRedirect({
          method,
          pathname,
          searchParams: context.url.searchParams,
          requestHost: ctx.requestHost,
          requestProtocol: resolvePublicRequestProtocol(context.request),
          canonical: ctx.canonical,
          deployEnv,
          routeKind,
        })
        if (plan) {
          logCanonicalResolutionOnce(ctx, { pathname, status: 301 })
          const redirect = buildCanonicalRedirectResponse({
            ...plan,
            tenantId: ctx.tenantId,
          })
          if (shouldEmitServerTiming(deployEnv, locals)) {
            redirect.headers.set("Server-Timing", buildServerTimingHeader(ctx))
          }
          return redirect
        }
      }
    }

    logCanonicalResolutionOnce(ctx, { pathname })
  }

  const response = await next()

  const normalizedDeploy = deployEnv?.trim().toLowerCase()
  if (normalizedDeploy === "preview" || normalizedDeploy === "staging") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }

  if (pathname === "/health" || pathname.startsWith("/health/")) {
    response.headers.set("Cache-Control", "no-store")
    return response
  }

  if (response.status === 301 || response.status === 302) {
    return response
  }

  const ctx = getPublicRequestContext(locals)
  const applyPublicationGate = shouldApplyPublicationIndexingHeaders(routeKind, ctx)
  if (applyPublicationGate) {
    const publicationNoindex = shouldNoindexFromPublication({
      enforce: isPublicationIndexingEnforced(locals),
      publication: publicationFromPayload(ctx?.payload),
      canonicalHost: ctx?.canonical?.host,
    })
    if (publicationNoindex) {
      response.headers.set("Cache-Control", "no-store")
      if (!response.headers.has("X-Robots-Tag")) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow")
      }
    } else {
      response.headers.set(
        "Cache-Control",
        resolveHtmlCacheControl(deployEnv, response.status),
      )
    }
  } else if (routeKind === "public_page") {
    response.headers.set(
      "Cache-Control",
      resolveHtmlCacheControl(deployEnv, response.status),
    )
  }

  if (ctx && shouldEmitServerTiming(deployEnv, locals)) {
    const existing = response.headers.get("Server-Timing")
    const timing = buildServerTimingHeader(ctx)
    response.headers.set(
      "Server-Timing",
      existing ? `${existing}, ${timing}` : timing,
    )
  }

  return response
})
