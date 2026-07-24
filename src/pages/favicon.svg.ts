import type { APIRoute } from "astro"
import { resolveRequestFaviconUrl } from "../lib/resolveRequestFavicon.js"

export const prerender = false

/**
 * @param {string} target
 * @param {URL} requestUrl
 */
function absoluteLocation(target: string, requestUrl: URL): string {
  if (/^https?:\/\//i.test(target)) return target
  return new URL(target, requestUrl.origin).href
}

/** Same tenant redirect as favicon.ico — blocks Astro scaffold SVG. */
export const GET: APIRoute = async ({ request, locals }) => {
  const faviconUrl = await resolveRequestFaviconUrl(request, locals)
  if (!faviconUrl) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } })
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: absoluteLocation(faviconUrl, new URL(request.url)),
      "Cache-Control": "public, max-age=300",
    },
  })
}
