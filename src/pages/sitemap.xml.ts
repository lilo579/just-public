import type { APIRoute } from "astro"
import { isLeadIntakeSafeMode, resolveDeployEnv } from "../lib/runtimeEnv.js"
import { resolvePackagedInstitutionalSite } from "../lib/resolvePackagedInstitutionalSite.js"
import { chooseHomepageRenderer } from "../lib/publicHomepageHelpers.js"
import { resolvePublicPresentationBinding } from "../lib/publicPresentationBinding.js"
import { createPublicSupabaseClient } from "../lib/publicSupabase.js"
import {
  CanonicalAuthorityError,
  canonicalAuthorityErrorResponse,
  requirePublicCanonical,
} from "../lib/canonicalAuthority.js"
import {
  buildCanonicalRedirectResponse,
  planCanonicalRedirect,
} from "../lib/canonicalRedirect.js"
import {
  getPublicRequestContext,
  publicAuthorityFailureResponse,
  resolvePublicRequestContext,
} from "../lib/publicRequestContext.js"
import {
  isPublicationIndexingEnforced,
  publicationCacheControl,
  publicationFromPayload,
  shouldNoindexFromPublication,
} from "../lib/publicationContract.js"
import {
  EMPTY_SITEMAP_XML,
  buildSitemapXml,
  collectPublicSitemapPaths,
  loadF3CatalogProductRows,
} from "../lib/publicSitemap.js"

export const prerender = false

export const GET: APIRoute = async ({ request, locals, url }) => {
  const deployEnv = resolveDeployEnv(locals)
  if (isLeadIntakeSafeMode(deployEnv)) {
    return new Response(EMPTY_SITEMAP_XML, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    })
  }

  const ctx =
    getPublicRequestContext(locals) ||
    (await resolvePublicRequestContext(request, url, locals as Record<string, unknown>))

  if (ctx.result === "unavailable") {
    return publicAuthorityFailureResponse(
      ctx.errorCode || "canonical_authority_unavailable",
      503,
    )
  }

  if (!ctx.requestHost || ctx.requestHost === "localhost" || ctx.requestHost === "127.0.0.1") {
    return new Response("Sitemap unavailable (host)", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    })
  }

  let canonical
  try {
    canonical = requirePublicCanonical(ctx.canonical, { deployEnv, noindex: false })
  } catch (err) {
    if (err instanceof CanonicalAuthorityError) {
      return canonicalAuthorityErrorResponse(err)
    }
    throw err
  }

  if (!canonical) {
    return canonicalAuthorityErrorResponse(
      new CanonicalAuthorityError(
        "missing_primary_domain",
        "Public sitemap missing canonical authority",
        422,
      ),
    )
  }

  const redirect = planCanonicalRedirect({
    method: "GET",
    pathname: "/sitemap.xml",
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
  if (
    shouldNoindexFromPublication({
      enforce,
      publication: publicationFromPayload(ctx.payload),
      canonicalHost: canonical.host,
    })
  ) {
    return new Response(EMPTY_SITEMAP_XML, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": publicationCacheControl(true),
        "X-Robots-Tag": "noindex",
      },
    })
  }

  const packaged = resolvePackagedInstitutionalSite(canonical.host)
  let family = "f1"
  /** @type {unknown[]} */
  let productRows = []
  // Publication gate above is fail-closed: unapproved hosts never reach this RPC.
  if (!packaged && ctx.payload) {
    const choice = chooseHomepageRenderer(ctx.payload)
    family = resolvePublicPresentationBinding(ctx.payload, choice).family || "f1"
    if (family === "f3") {
      productRows = await loadF3CatalogProductRows({
        supabase: createPublicSupabaseClient(locals),
        host: canonical.host,
        tenantId: ctx.tenantId,
      })
    }
  }

  const paths = collectPublicSitemapPaths({
    packaged,
    family,
    productRows,
    tenantId: ctx.tenantId,
  })
  const xml = buildSitemapXml(canonical, paths)

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": publicationCacheControl(enforce),
    },
  })
}
