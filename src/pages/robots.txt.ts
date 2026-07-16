import type { APIRoute } from "astro"
import { isLeadIntakeSafeMode, resolveDeployEnv } from "../lib/runtimeEnv.js"
import { resolveRequestHost, HostResolutionError } from "../lib/publicHomepage"

export const prerender = false

export const GET: APIRoute = async ({ request, locals }) => {
  const deployEnv = resolveDeployEnv(locals)
  const safe = isLeadIntakeSafeMode(deployEnv)

  let host = "localhost"
  try {
    host = resolveRequestHost(request, new URL(request.url).searchParams)
  } catch (err) {
    if (!(err instanceof HostResolutionError)) {
      /* keep localhost */
    }
  }

  const body = safe
    ? ["User-agent: *", "Disallow: /", ""].join("\n")
    : [
        "User-agent: *",
        "Allow: /",
        `Sitemap: https://${host}/sitemap.xml`,
        "",
      ].join("\n")

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
