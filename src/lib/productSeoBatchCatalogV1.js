/**
 * Consumer parser for contract product-seo-catalog/v1.
 * Authority lives in Nexus. This module does not invent totals, images, or hosts.
 * Shadow-only. usableForEnforcement is always false.
 */

export const PRODUCT_SEO_CATALOG_CONTRACT_VERSION = "product-seo-catalog/v1"
export const PRODUCT_SEO_CATALOG_RPC = "public_get_product_seo_catalog_by_host_v1"
export const PRODUCT_SEO_CATALOG_MIN_LIMIT = 1
export const PRODUCT_SEO_CATALOG_ABSOLUTE_LIMIT = 500

export const PRODUCT_SEO_CATALOG_STATUSES = Object.freeze([
  "ok",
  "catalog_empty",
  "catalog_unavailable",
  "tenant_suspended",
  "host_not_resolved",
  "invalid_host",
  "host_not_primary",
  "primary_missing",
  "multiple_primaries",
  "limit_invalid",
  "internal_error",
])

const SUCCESS_STATUSES = new Set(["ok", "catalog_empty"])
const ANOMALY_STATUSES = new Set(["host_not_primary", "primary_missing", "multiple_primaries"])
const SHA256_FP = /^sha256:[0-9a-f]{64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"])

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return /** @type {Record<string, unknown>} */ (value)
}

function asTrimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

function hasDangerousKeys(value, depth = 0) {
  if (value == null || typeof value !== "object" || depth > 12) return false
  if (Object.prototype.hasOwnProperty.call(value, "__proto__")) return true
  if (Array.isArray(value)) return value.some((item) => hasDangerousKeys(item, depth + 1))
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) return true
    if (hasDangerousKeys(value[key], depth + 1)) return true
  }
  return false
}

function fail(reason, extra = {}) {
  return {
    accepted: false,
    reason,
    status: extra.status || "internal_error",
    ok: false,
    catalogComplete: false,
    usableForEnforcement: false,
    truncated: false,
    contractVersion: extra.contractVersion || null,
    tenantId: extra.tenantId ?? null,
    canonicalHost: extra.canonicalHost ?? null,
    requestHost: extra.requestHost ?? null,
    storageOrigin: extra.storageOrigin ?? null,
    effectiveLimit: extra.effectiveLimit ?? null,
    returnedCount: extra.returnedCount ?? 0,
    totalCount: extra.totalCount ?? null,
    catalogFingerprint: extra.catalogFingerprint ?? null,
    imageDiagnostics: extra.imageDiagnostics ?? null,
    products: [],
  }
}

function asInt(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value)
  return null
}

function asNullableInt(value) {
  if (value == null) return null
  return asInt(value)
}

/**
 * Structural public product-image URL. Does not use WHATWG path normalization.
 * @param {unknown} url
 * @param {string} storageOrigin
 * @param {string} tenantId
 */
export function isContractPublicProductImageUrl(url, storageOrigin, tenantId) {
  if (typeof url !== "string" || !url) return false
  if (/[?#@\\%\u0000-\u001f]/.test(url)) return false
  if (!url.startsWith("https://")) return false
  const origin = asTrimmed(storageOrigin)
  if (!origin.startsWith("https://")) return false
  const originHost = origin.slice("https://".length).toLowerCase()
  if (!originHost || originHost.includes("/") || originHost.includes("@") || originHost.includes(":")) {
    return false
  }
  const rest = url.slice("https://".length)
  const slash = rest.indexOf("/")
  if (slash <= 0) return false
  const authority = rest.slice(0, slash)
  if (authority.includes("@")) return false
  let host = authority
  if (authority.includes(":")) {
    const [h, port] = authority.split(":")
    if (port !== "443") return false
    host = h
  }
  if (host.toLowerCase() !== originHost) return false
  const path = rest.slice(slash)
  if (!path.startsWith("/") || path.includes("//")) return false
  const parts = path.split("/")
  if (parts[0] !== "" || parts.length < 8) return false
  const expected = ["storage", "v1", "object", "public", "product-images"]
  for (let i = 0; i < expected.length; i += 1) {
    if (parts[i + 1] !== expected[i]) return false
  }
  const tenantSeg = String(tenantId).toLowerCase()
  if (parts[6] !== tenantSeg || !UUID_RE.test(parts[6])) return false
  for (let i = 1; i < parts.length; i += 1) {
    const seg = parts[i]
    if (!seg || seg === "." || seg === "..") return false
  }
  return true
}

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value)
}

function normalizeHost(value) {
  if (typeof value !== "string") return null
  let host = value.trim().toLowerCase()
  host = host.split(":")[0]
  if (host.endsWith(".")) host = host.slice(0, -1)
  return host || null
}

function productViolations(product, envelope) {
  const rec = asRecord(product)
  if (!rec) return "malformed_product"
  if (hasDangerousKeys(rec)) return "dangerous_keys"

  if (!isUuid(envelope.tenantId)) return "malformed_envelope_tenant"
  const tenantId = String(envelope.tenantId).toLowerCase()
  if (!Object.prototype.hasOwnProperty.call(rec, "tenantId") || rec.tenantId == null) {
    return "missing_tenant_id"
  }
  if (!isUuid(rec.tenantId)) return "invalid_tenant_id"
  if (String(rec.tenantId).toLowerCase() !== tenantId) return "product_tenant_mismatch"

  const canonical = normalizeHost(envelope.canonicalHost)
  if (!canonical) return "malformed_envelope_host"
  if (!Object.prototype.hasOwnProperty.call(rec, "host") || rec.host == null) {
    return "missing_host"
  }
  const host = normalizeHost(rec.host)
  if (!host) return "invalid_host"
  if (host !== canonical) return "product_host_mismatch"

  if (!Object.prototype.hasOwnProperty.call(rec, "productId") || rec.productId == null) {
    return "missing_product_id"
  }
  if (!isUuid(rec.productId)) return "invalid_product_id"

  for (const key of ["slug", "name", "lineName", "categoryName", "description", "brand"]) {
    if (typeof rec[key] !== "string") return "malformed_product_field"
  }
  if (!Array.isArray(rec.variantAttributes) || rec.variantAttributes.some((item) => typeof item !== "string")) {
    return "malformed_product_field"
  }
  if (!Array.isArray(rec.images)) return "malformed_images"
  if (rec.price != null && (typeof rec.price !== "number" || !Number.isFinite(rec.price))) {
    return "malformed_product_field"
  }
  if (rec.currency !== null || rec.availability !== null || rec.publicProductCode !== null || rec.visible !== null) {
    return "malformed_product_field"
  }
  if (rec.catalogEnabled !== true || rec.tenantActive !== true) return "malformed_product_field"

  const origin = asTrimmed(envelope.storageOrigin)
  if (rec.images.length && !origin) return "images_without_storage_origin"
  for (const url of rec.images) {
    if (!isContractPublicProductImageUrl(url, origin, tenantId)) return "invalid_image"
  }
  return null
}

/**
 * @param {unknown} envelope
 */
export function parseProductSeoCatalogV1(envelope) {
  const rec = asRecord(envelope)
  if (!rec) return fail("malformed_envelope")
  if (hasDangerousKeys(rec)) return fail("dangerous_keys")

  const contractVersion = asTrimmed(rec.contractVersion)
  if (contractVersion !== PRODUCT_SEO_CATALOG_CONTRACT_VERSION) {
    return fail("unknown_contract_version", { contractVersion: contractVersion || null })
  }

  const status = asTrimmed(rec.status)
  if (!PRODUCT_SEO_CATALOG_STATUSES.includes(status)) {
    return fail("unknown_status", { contractVersion, status })
  }

  if (rec.usableForEnforcement !== false) {
    return fail("enforcement_flag_not_false", { contractVersion, status })
  }

  const products = Array.isArray(rec.products) ? rec.products : null
  if (!products) return fail("malformed_products", { contractVersion, status })
  if (hasDangerousKeys(products)) return fail("dangerous_keys", { contractVersion, status })

  const returnedCount = asInt(rec.returnedCount)
  const effectiveLimit = asInt(rec.effectiveLimit)
  const totalCount = asNullableInt(rec.totalCount)
  const truncated = rec.truncated === true
  const claimedComplete = rec.catalogComplete === true
  const claimedOk = rec.ok === true
  const fingerprint = rec.catalogFingerprint == null ? null : asTrimmed(rec.catalogFingerprint)
  const storageOrigin = rec.storageOrigin == null ? null : asTrimmed(rec.storageOrigin)

  if (returnedCount == null || effectiveLimit == null) {
    return fail("malformed_counts", { contractVersion, status })
  }
  if (returnedCount !== products.length) {
    return fail("incoherent_returned_count", { contractVersion, status, returnedCount })
  }
  if (returnedCount > PRODUCT_SEO_CATALOG_ABSOLUTE_LIMIT || returnedCount > effectiveLimit) {
    return fail("response_above_cap", { contractVersion, status, returnedCount, effectiveLimit })
  }
  if (effectiveLimit < PRODUCT_SEO_CATALOG_MIN_LIMIT || effectiveLimit > PRODUCT_SEO_CATALOG_ABSOLUTE_LIMIT) {
    return fail("malformed_effective_limit", { contractVersion, status, effectiveLimit })
  }

  if (ANOMALY_STATUSES.has(status) && claimedComplete) {
    return fail("canonical_anomaly_marked_complete", { contractVersion, status })
  }

  if (SUCCESS_STATUSES.has(status)) {
    if (!claimedOk) return fail("success_status_not_ok", { contractVersion, status })
    if (totalCount == null || totalCount < 0) {
      return fail("missing_proven_total", { contractVersion, status })
    }
    if (status === "catalog_empty") {
      if (totalCount !== 0 || returnedCount !== 0 || truncated || products.length !== 0) {
        return fail("incoherent_empty_catalog", { contractVersion, status, returnedCount, totalCount })
      }
    }
    if (status === "ok" && totalCount < 1) {
      return fail("ok_without_products", { contractVersion, status, totalCount })
    }
    const expectedTruncated = totalCount > effectiveLimit
    if (truncated !== expectedTruncated) {
      return fail("incoherent_truncated", { contractVersion, status, totalCount, effectiveLimit })
    }
    if (truncated && returnedCount !== effectiveLimit) {
      return fail("incoherent_truncated_page", { contractVersion, status, returnedCount, effectiveLimit })
    }
    if (!truncated && returnedCount !== totalCount) {
      return fail("incoherent_proven_total", { contractVersion, status, returnedCount, totalCount })
    }
    const proven = !truncated && returnedCount === totalCount
    if (truncated && claimedComplete) {
      return fail("truncated_must_not_be_proven", { contractVersion, status })
    }
    if (claimedComplete !== proven) {
      return fail("incoherent_catalog_complete", { contractVersion, status })
    }
    if (proven) {
      if (!fingerprint || !SHA256_FP.test(fingerprint)) {
        return fail("missing_fingerprint", { contractVersion, status })
      }
    } else if (fingerprint != null) {
      return fail("fingerprint_present_when_incomplete", { contractVersion, status })
    }

    const seenIds = new Set()
    for (const product of products) {
      const violation = productViolations(product, rec)
      if (violation) return fail(violation, { contractVersion, status })
      const id = asTrimmed(asRecord(product)?.productId).toLowerCase()
      if (!id) return fail("missing_product_id", { contractVersion, status })
      if (seenIds.has(id)) return fail("duplicate_product_id", { contractVersion, status })
      seenIds.add(id)
    }

    return {
      accepted: true,
      reason: null,
      status,
      ok: true,
      catalogComplete: proven,
      usableForEnforcement: false,
      truncated,
      contractVersion,
      tenantId: rec.tenantId ?? null,
      canonicalHost: rec.canonicalHost ?? null,
      requestHost: rec.requestHost ?? null,
      storageOrigin,
      effectiveLimit,
      returnedCount,
      totalCount,
      catalogFingerprint: fingerprint,
      imageDiagnostics: rec.imageDiagnostics ?? null,
      products,
    }
  }

  if (claimedOk) return fail("fail_closed_marked_ok", { contractVersion, status })
  if (claimedComplete) return fail("fail_closed_marked_complete", { contractVersion, status })
  if (truncated) return fail("fail_closed_truncated", { contractVersion, status })
  if (fingerprint != null) return fail("fail_closed_has_fingerprint", { contractVersion, status })
  if (products.length !== 0 || returnedCount !== 0) {
    return fail("fail_closed_has_products", { contractVersion, status })
  }
  if (totalCount != null) {
    return fail("fail_closed_has_total", { contractVersion, status, totalCount })
  }

  return {
    accepted: true,
    reason: null,
    status,
    ok: false,
    catalogComplete: false,
    usableForEnforcement: false,
    truncated: false,
    contractVersion,
    tenantId: rec.tenantId ?? null,
    canonicalHost: rec.canonicalHost ?? null,
    requestHost: rec.requestHost ?? null,
    storageOrigin,
    effectiveLimit,
    returnedCount: 0,
    totalCount: null,
    catalogFingerprint: null,
    imageDiagnostics: rec.imageDiagnostics ?? null,
    products: [],
  }
}

export function isProductSeoCatalogSuccess(parsed) {
  return Boolean(parsed && parsed.accepted && parsed.ok && SUCCESS_STATUSES.has(parsed.status))
}
