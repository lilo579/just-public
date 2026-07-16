import { defineMiddleware } from "astro:middleware"
import { resolveDeployEnv } from "./lib/runtimeEnv.js"
import { resolveHtmlCacheControl } from "./lib/cacheHeaders.js"

/**
 * Preview/staging indexing guard. Production / unset / other values: no automatic X-Robots-Tag.
 * Future proxy/Worker must preserve the visitor Host header (or set Host explicitly).
 * This app does not trust X-Forwarded-Host from the public internet.
 *
 * Canonical Worker env: DEPLOY_ENV (locals.runtime.env / .dev.vars / wrangler --var).
 * Node contingency: PUBLIC_DEPLOY_ENV via process.env remains readable as fallback only.
 * import.meta.env is build-time and is not the Worker runtime source of truth.
 *
 * FT-005B — Cache-Control for Worker-generated responses (SSR HTML + route handlers).
 * Static /_astro/* headers come from public/_headers (Static Assets), not this middleware.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next()
  const deployEnv = resolveDeployEnv(context.locals)?.trim().toLowerCase()
  if (deployEnv === "preview" || deployEnv === "staging") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }

  const pathname = context.url.pathname
  if (pathname === "/health" || pathname.startsWith("/health/")) {
    response.headers.set("Cache-Control", "no-store")
    return response
  }

  response.headers.set(
    "Cache-Control",
    resolveHtmlCacheControl(deployEnv, response.status),
  )
  return response
})
