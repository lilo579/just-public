/**
 * ADR-SEO-001 Phase 3 — public canonical authority helpers for just-public.
 *
 * Authority comes only from payload/RPC contract (active primary domain / is_primary).
 * Never invent apex/www by string surgery. Never fall back to request host for
 * indexable production pages.
 */

import { isLeadIntakeSafeMode } from "./runtimeEnv.js"

/**
 * @typedef {{
 *   host: string
 *   origin: string
 *   requestHost: string
 *   isPrimaryRequest: boolean
 * }} PublicCanonicalContract
 */

export class CanonicalAuthorityError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [httpStatus]
   */
  constructor(code, message, httpStatus = 422) {
    super(message)
    this.name = "CanonicalAuthorityError"
    this.code = code
    this.httpStatus = httpStatus
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Validate/normalize a payload `canonical` object. Returns null when absent.
 * Does not decide apex vs www — only checks shape and https origin consistency.
 *
 * @param {unknown} raw
 * @returns {PublicCanonicalContract | null}
 */
export function asPublicCanonicalContract(raw) {
  if (!raw || typeof raw !== "object") return null
  const record = /** @type {Record<string, unknown>} */ (raw)
  const host = asTrimmed(record.host).toLowerCase().replace(/:\d+$/, "")
  const requestHost = asTrimmed(record.requestHost).toLowerCase().replace(/:\d+$/, "")
  let origin = asTrimmed(record.origin)
  if (!host || !requestHost || !origin) return null
  if (/[/?#]/.test(host) || /[/?#]/.test(requestHost)) return null

  // Accept origin with or without trailing slash; force https + host match.
  try {
    const u = new URL(origin)
    if (u.protocol !== "https:") return null
    const originHost = u.hostname.toLowerCase()
    if (originHost !== host) return null
    origin = `https://${host}`
  } catch {
    return null
  }

  return {
    host,
    origin,
    requestHost,
    isPrimaryRequest: record.isPrimaryRequest === true,
  }
}

/**
 * Public/indexable pages require a contract. Preview/staging (safe mode) or
 * explicit noindex may omit canonical — never invent one from request host.
 *
 * @param {unknown} raw
 * @param {{
 *   deployEnv?: string
 *   noindex?: boolean
 * }} [context]
 * @returns {PublicCanonicalContract | null}
 */
export function requirePublicCanonical(raw, context = {}) {
  const parsed = asPublicCanonicalContract(raw)
  if (parsed) return parsed

  const noindex = context.noindex === true
  const safe = isLeadIntakeSafeMode(context.deployEnv)
  if (noindex || safe) {
    return null
  }

  throw new CanonicalAuthorityError(
    "missing_primary_domain",
    "Public page missing canonical authority from primary domain",
    422,
  )
}

/**
 * Build an absolute canonical URL for a path.
 * Homepage → trailing slash. Internal paths → no trailing slash.
 * Query/fragment are never included.
 *
 * @param {PublicCanonicalContract} canonical
 * @param {string} [pathname]
 * @returns {string}
 */
export function buildCanonicalUrl(canonical, pathname = "/") {
  const origin = canonical.origin.replace(/\/$/, "")
  let path = typeof pathname === "string" ? pathname.trim() : "/"
  if (!path.startsWith("/")) path = `/${path}`

  // Strip query/hash if a caller accidentally passed a full path-with-query.
  const q = path.indexOf("?")
  if (q >= 0) path = path.slice(0, q)
  const h = path.indexOf("#")
  if (h >= 0) path = path.slice(0, h)

  // Collapse duplicate slashes in the path only.
  path = path.replace(/\/{2,}/g, "/")

  if (path === "/" || path === "") {
    return `${origin}/`
  }

  // Internal pages: no trailing slash (ADR-SEO-001 §5).
  if (path.length > 1 && path.endsWith("/")) {
    path = path.replace(/\/+$/, "")
  }
  return `${origin}${path}`
}

/**
 * Absolutize a public asset URL against the canonical origin (not request host).
 *
 * @param {string} origin
 * @param {string | null | undefined} pathOrUrl
 * @returns {string}
 */
export function toAbsoluteCanonicalUrl(origin, pathOrUrl) {
  const value = asTrimmed(pathOrUrl)
  if (!value) return ""
  if (/^https?:\/\//i.test(value)) return value
  const base = asTrimmed(origin).replace(/\/$/, "")
  if (!base) return value
  const path = value.startsWith("/") ? value : `/${value}`
  return `${base}${path}`
}

/**
 * Controlled Response for missing canonical on public HTML routes.
 *
 * @param {CanonicalAuthorityError} err
 * @returns {Response}
 */
export function canonicalAuthorityErrorResponse(err) {
  return new Response(`Site unavailable (${err.code})`, {
    status: err.httpStatus || 422,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}

/**
 * Resolve a page canonical URL from chrome/payload authority.
 * Returns `{ ok:false, response }` when public indexable page lacks authority.
 *
 * @param {{
 *   canonical?: unknown
 *   deployEnv?: string
 *   noindex?: boolean
 * }} chrome
 * @param {string} pathname
 * @returns {{ ok: true, canonicalUrl: string | undefined, authority: PublicCanonicalContract | null } | { ok: false, response: Response }}
 */
export function resolveChromeCanonicalUrl(chrome, pathname) {
  try {
    const authority = requirePublicCanonical(chrome?.canonical, {
      deployEnv: chrome?.deployEnv,
      noindex: chrome?.noindex === true,
    })
    if (!authority) {
      return { ok: true, canonicalUrl: undefined, authority: null }
    }
    return {
      ok: true,
      canonicalUrl: buildCanonicalUrl(authority, pathname),
      authority,
    }
  } catch (err) {
    if (err instanceof CanonicalAuthorityError) {
      return { ok: false, response: canonicalAuthorityErrorResponse(err) }
    }
    throw err
  }
}

/**
 * Path B — pages that do not already have ResolvedHomepage.canonical.
 * Calls the same RPC as Edge (`public_host_canonical_authority`). Never
 * invents apex/www; never falls back to request host.
 *
 * @param {{
 *   rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{
 *     data: unknown
 *     error: { message?: string } | null
 *   }>
 * }} supabase
 * @param {string} host
 * @returns {Promise<PublicCanonicalContract | null>}
 */
export async function fetchPublicCanonicalFromRpc(supabase, host) {
  const normalized = asTrimmed(host).toLowerCase().replace(/:\d+$/, "")
  if (!normalized || /[/?#]/.test(normalized)) {
    throw new CanonicalAuthorityError(
      "invalid_host",
      "Invalid host for canonical authority",
      400,
    )
  }

  const { data, error } = await supabase.rpc("public_host_canonical_authority", {
    p_host: normalized,
  })

  if (error) {
    throw new CanonicalAuthorityError(
      "canonical_rpc_failed",
      error.message || "Failed to resolve host canonical authority",
      500,
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") return null

  const record = /** @type {Record<string, unknown>} */ (row)
  const tenantId = asTrimmed(record.tenant_id)
  if (!tenantId) return null

  const primaryHost = asTrimmed(record.primary_host).toLowerCase()
  const hasPrimary = record.has_primary === true && Boolean(primaryHost)
  if (!hasPrimary) return null

  const requestHost =
    asTrimmed(record.request_host).toLowerCase() || normalized

  return asPublicCanonicalContract({
    host: primaryHost,
    origin: `https://${primaryHost}`,
    requestHost,
    isPrimaryRequest: record.is_primary_request === true,
  })
}
