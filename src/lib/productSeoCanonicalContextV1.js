/**
 * Validated canonical context for Product SEO shadow.
 * Brand string is diagnostic metadata only. Trust is WeakSet membership
 * after resolve/load validates authority. Callers cannot stamp isPrimaryRequest.
 */

import { asPublicCanonicalContract, buildCanonicalUrl } from "./canonicalAuthority.js"
import { parsePublicationContract, publicationFromPayload } from "./publicationContract.js"

export const CANONICAL_CONTEXT_BRAND = "just-product-seo-canonical-context/v1"

/** @type {WeakSet<object>} */
const trustedCanonicalContexts = new WeakSet()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return /** @type {Record<string, unknown>} */ (value)
}

function asTrimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

export function hostKey(value) {
  return asTrimmed(value).toLowerCase().replace(/:\d+$/, "")
}

export function tenantKey(value) {
  return asTrimmed(value).toLowerCase()
}

/**
 * Classify www↔apex relative to an already-authoritative primary.
 * Does not invent the primary by stripping www.
 */
export function isWwwAliasOfPrimary(requestHost, primaryHost) {
  const request = hostKey(requestHost)
  const primary = hostKey(primaryHost)
  if (!request || !primary || request === primary) return false
  return request === `www.${primary}` || primary === `www.${request}`
}

function fail(reason, extra = {}) {
  return {
    brand: CANONICAL_CONTEXT_BRAND,
    ok: false,
    trustedForShadow: false,
    reason,
    ...extra,
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value == null || typeof value !== "object") return value
  if (seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item, seen)
  } else {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze(value[key], seen)
    }
  }
  return Object.freeze(value)
}

function sealTrusted(fields) {
  const ctx = {
    brand: CANONICAL_CONTEXT_BRAND,
    ok: true,
    trustedForShadow: true,
    reason: null,
    ...fields,
  }
  const sealed = typeof structuredClone === "function" ? structuredClone(ctx) : ctx
  deepFreeze(sealed)
  trustedCanonicalContexts.add(sealed)
  return sealed
}

function payloadTenantId(payload) {
  const rec = asRecord(payload)
  if (!rec) return ""
  const direct = tenantKey(rec.tenantId || rec.tenant_id)
  if (direct) return direct
  const tenant = asRecord(rec.tenant)
  if (tenant) return tenantKey(tenant.id || tenant.tenantId || tenant.tenant_id)
  const source = asRecord(rec.source)
  if (source) return tenantKey(source.tenantId || source.tenant_id)
  return ""
}

function agreePublication(publication, primaryHost) {
  if (!publication) return { ok: true, publication: null }
  const parsed = parsePublicationContract(publication)
  if (!parsed.present) return { ok: true, publication: parsed }
  if (!parsed.valid) return { ok: false, reason: "publication_invalid" }
  const stamp = hostKey(parsed.canonicalHost)
  if (stamp && stamp !== hostKey(primaryHost)) {
    return { ok: false, reason: "publication_canonical_mismatch" }
  }
  return { ok: true, publication: parsed }
}

function trustedRelation(requestHost, primaryHost, isPrimaryRequest) {
  if (requestHost === primaryHost) {
    if (isPrimaryRequest !== true) return { ok: false, reason: "malformed_canonical_authority" }
    return { ok: true, relation: "primary" }
  }
  if (isWwwAliasOfPrimary(requestHost, primaryHost)) {
    if (isPrimaryRequest === true) return { ok: false, reason: "malformed_canonical_authority" }
    return { ok: true, relation: "www_alias" }
  }
  return { ok: false, reason: "host_not_primary" }
}

function rpcRequestHostField(rec) {
  const hasSnake = Object.prototype.hasOwnProperty.call(rec, "request_host")
  const hasCamel = Object.prototype.hasOwnProperty.call(rec, "requestHost")
  if (!hasSnake && !hasCamel) return { ok: false }
  const raw = hasSnake ? rec.request_host : rec.requestHost
  if (typeof raw !== "string") return { ok: false }
  const normalized = hostKey(raw)
  if (!normalized) return { ok: false }
  return { ok: true, host: normalized }
}

function fromRpcRow(row, requestHost, expectedTenantId, publication) {
  if (row == null) return fail("canonical_host_unresolved", { requestHost })
  const rec = asRecord(row)
  if (!rec) return fail("malformed_canonical_authority", { requestHost })

  const rpcHost = rpcRequestHostField(rec)
  if (!rpcHost.ok) {
    return fail("malformed_canonical_authority", { requestHost })
  }
  if (rpcHost.host !== requestHost) {
    return fail("host_mismatch", { requestHost, rpcRequestHost: rpcHost.host })
  }

  const tenantId = tenantKey(rec.tenant_id || rec.tenantId)
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return fail("malformed_canonical_authority", { requestHost })
  }
  const expected = tenantKey(expectedTenantId)
  if (expected && expected !== tenantId) {
    return fail("tenant_mismatch", { requestHost, tenantId, expectedTenantId: expected })
  }

  const hasPrimary = rec.has_primary === true
  const primaryHost = hostKey(rec.primary_host || rec.primaryHost)
  if (!hasPrimary || !primaryHost) {
    return fail("canonical_not_primary", { requestHost, tenantId })
  }

  const isPrimaryRequest = rec.is_primary_request === true || rec.isPrimaryRequest === true
  const relation = trustedRelation(requestHost, primaryHost, isPrimaryRequest)
  if (!relation.ok) return fail(relation.reason, { requestHost, tenantId, primaryHost })

  const canonical = asPublicCanonicalContract({
    host: primaryHost,
    origin: `https://${primaryHost}`,
    requestHost,
    isPrimaryRequest: requestHost === primaryHost,
  })
  if (!canonical) return fail("malformed_canonical_authority", { requestHost, tenantId, primaryHost })

  const pub = agreePublication(publication, primaryHost)
  if (!pub.ok) return fail(pub.reason, { requestHost, tenantId, primaryHost })

  return sealTrusted({
    source: "rpc",
    requestHost,
    tenantId,
    primaryHost,
    relation: relation.relation,
    isPrimaryRequest: canonical.isPrimaryRequest,
    canonical,
    publication: pub.publication,
    canonicalUrlOrigin: buildCanonicalUrl(canonical, "/"),
  })
}

function fromPayload(payload, requestHost, expectedTenantId) {
  const rec = asRecord(payload)
  if (!rec) return fail("malformed_canonical_authority", { requestHost })

  const canonicalRaw = rec.canonical
  if (canonicalRaw == null) return fail("missing_canonical_authority", { requestHost })
  const parsed = asPublicCanonicalContract(canonicalRaw)
  if (!parsed) return fail("malformed_canonical_authority", { requestHost })

  if (hostKey(parsed.requestHost) !== requestHost) {
    return fail("host_mismatch", { requestHost, payloadRequestHost: parsed.requestHost })
  }

  const tenantId = payloadTenantId(rec)
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return fail("malformed_canonical_authority", { requestHost })
  }
  const expected = tenantKey(expectedTenantId)
  if (expected && expected !== tenantId) {
    return fail("tenant_mismatch", { requestHost, tenantId, expectedTenantId: expected })
  }

  const primaryHost = parsed.host
  const relation = trustedRelation(requestHost, primaryHost, parsed.isPrimaryRequest)
  if (!relation.ok) return fail(relation.reason, { requestHost, tenantId, primaryHost })

  const pub = agreePublication(publicationFromPayload(rec), primaryHost)
  if (!pub.ok) return fail(pub.reason, { requestHost, tenantId, primaryHost })

  return sealTrusted({
    source: "payload",
    requestHost,
    tenantId,
    primaryHost,
    relation: relation.relation,
    isPrimaryRequest: parsed.isPrimaryRequest,
    canonical: parsed,
    publication: pub.publication,
    canonicalUrlOrigin: buildCanonicalUrl(parsed, "/"),
  })
}

/**
 * @param {{
 *   requestHost?: unknown
 *   expectedTenantId?: unknown
 *   authority?: {
 *     kind?: string
 *     row?: unknown
 *     payload?: unknown
 *   }
 *   publication?: unknown
 * }} input
 */
export function resolveProductSeoCanonicalContextV1(input) {
  const rec = asRecord(input) || {}
  const requestHost = hostKey(rec.requestHost)
  if (!requestHost) return fail("unknown_host")

  const authority = asRecord(rec.authority)
  if (!authority || authority.kind === "unavailable") {
    return fail("canonical_authority_unavailable", { requestHost })
  }

  if (authority.kind === "rpc") {
    return fromRpcRow(authority.row, requestHost, rec.expectedTenantId, rec.publication)
  }
  if (authority.kind === "payload") {
    return fromPayload(authority.payload, requestHost, rec.expectedTenantId)
  }
  return fail("malformed_canonical_authority", { requestHost })
}

function hasTrustedShape(rec) {
  return Boolean(
    rec.brand === CANONICAL_CONTEXT_BRAND &&
      rec.ok === true &&
      rec.trustedForShadow === true &&
      rec.canonical &&
      rec.tenantId &&
      rec.primaryHost,
  )
}

export function isTrustedCanonicalContext(value) {
  const rec = asRecord(value)
  return Boolean(rec && trustedCanonicalContexts.has(value) && hasTrustedShape(rec))
}
