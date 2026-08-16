import type { APIRoute } from "astro"
import { isLeadIntakeSafeMode, resolveDeployEnv } from "../lib/runtimeEnv.js"
import {
  CanonicalAuthorityError,
  requirePublicCanonical,
} from "../lib/canonicalAuthority.js"
import {
  buildCanonicalRedirectResponse,
  planCanonicalRedirect,
} from "../lib/canonicalRedirect.js"
import {
  getPublicRequestContext,
  resolvePublicRequestContext,
} from "../lib/publicRequestContext.js"
import {
  isPublicationIndexingEnforced,
  publicationCacheControl,
  publicationFromPayload,
  shouldNoindexFromPublication,
} from "../lib/publicationContract.js"

export const prerender = false

export const GET: APIRoute = async ({ request, locals, url }) => {
  const deployEnv = resolveDeployEnv(locals)
  const safe = isLeadIntakeSafeMode(deployEnv)

  if (safe) {
    return new Response(["User-agent: *", "Disallow: /", ""].join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    })
  }

  const ctx =
    getPublicRequestContext(locals) ||
    (await resolvePublicRequestContext(request, url, locals as Record<string, unknown>))

  if (ctx.result === "unavailable" || ctx.result === "missing_primary") {
    return new Response(["User-agent: *", "Disallow: /", ""].join("\n"), {
      status: ctx.result === "missing_primary" ? 422 : 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    })
  }

  let canonical
  try {
    canonical = requirePublicCanonical(ctx.canonical, { deployEnv, noindex: false })
  } catch (err) {
    if (err instanceof CanonicalAuthorityError) {
      return new Response(["User-agent: *", "Disallow: /", ""].join("\n"), {
        status: 422,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      })
    }
    throw err
  }

  if (!canonical) {
    return new Response(["User-agent: *", "Disallow: /", ""].join("\n"), {
      status: 422,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    })
  }

  const redirect = planCanonicalRedirect({
    method: "GET",
    pathname: "/robots.txt",
    searchParams: url.searchParams,
    requestHost: ctx.requestHost,
    canonical,
    deployEnv,
    routeKind: "public_page",
  })
  if (redirect) {
    return buildCanonicalRedirectResponse({
      ...redirect,
      tenantId: ctx.tenantId,
    })
  }

  const enforce = isPublicationIndexingEnforced(locals)
  const publicationNoindex = shouldNoindexFromPublication({
    enforce,
    publication: publicationFromPayload(ctx.payload),
    siteMode: ctx.payload && typeof ctx.payload === "object"
      ? /** @type {Record<string, unknown>} */ (ctx.payload).siteMode
      : undefined,
    exposureAllowed:
      ctx.payload && typeof ctx.payload === "object"
        ? /** @type {Record<string, unknown>} */ (ctx.payload).exposure
        : undefined,
  })

  if (publicationNoindex) {
    return new Response(["User-agent: *", "Disallow: /", ""].join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": publicationCacheControl(true),
        "X-Robots-Tag": "noindex, nofollow",
      },
    })
  }

  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "",
    `Sitemap: ${canonical.origin}/sitemap.xml`,
    "",
  ].join("\n")

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": publicationCacheControl(enforce),
    },
  })
}
