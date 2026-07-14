/**
 * Minimal server-side runtime env access for Cloudflare Workers (POC-001 Slice 2).
 *
 * Preferred: Astro locals.runtime.env (Worker bindings from wrangler vars / .dev.vars).
 * Contingency: process.env for Node/Docker only — not assumed on workerd without nodejs_compat.
 *
 * Absent key → undefined. Present empty string → "".
 * No production URL/key defaults. Never import this from client components.
 */

/**
 * @param {Record<string, unknown> | undefined} env
 * @param {string} key
 * @returns {string | undefined}
 */
function readFromEnvBag(env, key) {
  if (!env || !Object.prototype.hasOwnProperty.call(env, key)) {
    return undefined
  }
  const value = env[key]
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

/**
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} locals
 * @param {string} key
 * @returns {string | undefined}
 */
export function getServerRuntimeString(locals, key) {
  const fromWorker = readFromEnvBag(locals?.runtime?.env, key)
  if (fromWorker !== undefined) return fromWorker

  if (typeof process !== "undefined" && process.env) {
    return readFromEnvBag(/** @type {Record<string, unknown>} */ (process.env), key)
  }
  return undefined
}

/**
 * Canonical deploy classification for Workers: DEPLOY_ENV.
 * Minimal Node contingency: PUBLIC_DEPLOY_ENV (historical Docker/runbook name).
 *
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} [locals]
 * @returns {string | undefined}
 */
export function resolveDeployEnv(locals) {
  const deployEnv = getServerRuntimeString(locals, "DEPLOY_ENV")
  if (deployEnv !== undefined) return deployEnv
  return getServerRuntimeString(locals, "PUBLIC_DEPLOY_ENV")
}

/**
 * Future payload fetch config — runtime binding only; no production fallback here.
 *
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} [locals]
 * @returns {string | undefined}
 */
export function resolveSitePayloadUrl(locals) {
  return getServerRuntimeString(locals, "PUBLIC_SITE_PAYLOAD_URL")
}

/**
 * Future payload auth — runtime binding only; no secret defaults.
 *
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} [locals]
 * @returns {string | undefined}
 */
export function resolveSupabaseAnonKey(locals) {
  return getServerRuntimeString(locals, "SUPABASE_ANON_KEY")
}
