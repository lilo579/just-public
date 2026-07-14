import { defineMiddleware } from "astro:middleware"

/**
 * Staging-only indexing guard. Production (unset / other values) is unchanged.
 * Future proxy/Worker must preserve the visitor Host header (or set Host
 * explicitly). This app does not trust X-Forwarded-Host from the public internet.
 *
 * Read process.env at runtime so container -e PUBLIC_DEPLOY_ENV=staging works
 * without rebuilding (import.meta.env.PUBLIC_* is build-time inlined).
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next()
  const deployEnv =
    (typeof process !== "undefined" && process.env?.PUBLIC_DEPLOY_ENV) ||
    import.meta.env.PUBLIC_DEPLOY_ENV
  if (deployEnv === "staging") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }
  return response
})
