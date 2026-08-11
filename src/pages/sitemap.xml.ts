import type { APIRoute } from "astro"
import { isLeadIntakeSafeMode, resolveDeployEnv } from "../lib/runtimeEnv.js"
import { resolvePackagedInstitutionalSite } from "../lib/resolvePackagedInstitutionalSite.js"
import {
  buildCanonicalUrl,
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

export const prerender = false

export const GET: APIRoute = async ({ request, locals, url }) => {
  const deployEnv = resolveDeployEnv(locals)
  if (isLeadIntakeSafeMode(deployEnv)) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    )
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

  const packaged = resolvePackagedInstitutionalSite(canonical.host)
  const paths = packaged?.sitemapPaths?.length ? packaged.sitemapPaths : ["/"]
  const urls = paths
    .map((path) => {
      const loc = buildCanonicalUrl(canonical, path)
      const priority = path === "/" ? "1.0" : "0.6"
      return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
