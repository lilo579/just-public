import type { APIRoute } from "astro"
import { isLeadIntakeSafeMode, resolveDeployEnv } from "../lib/runtimeEnv.js"
import { resolveRequestHost, HostResolutionError } from "../lib/publicHomepage"

export const prerender = false

export const GET: APIRoute = async ({ request, locals }) => {
  const deployEnv = resolveDeployEnv(locals)
  if (isLeadIntakeSafeMode(deployEnv)) {
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    })
  }

  let host = "localhost"
  try {
    host = resolveRequestHost(request, new URL(request.url).searchParams)
  } catch (err) {
    if (!(err instanceof HostResolutionError)) {
      /* keep */
    }
  }

  const loc = `https://${host}/`
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
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
