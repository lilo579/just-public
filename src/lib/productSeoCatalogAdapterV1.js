/**
 * Generic catalog → Product SEO Compiler v1 input adapter.
 * Pure function. No I/O. No tenant/host/slug branches.
 * Does not invent currency, availability, SKU, visible, or identity from description/image.
 */

import { asPublicCanonicalContract, buildCanonicalUrl } from "./canonicalAuthority.js"
import { isTrustedCanonicalContext, tenantKey, hostKey } from "./productSeoCanonicalContextV1.js"
import { identityKey, displayText, stableStringify } from "./productSeoCompilerV1.js"
import { sanitizePublicProductSlug } from "./publicSitemap.js"

export const SEO_ADAPTER_VERSION = "just-product-seo-catalog-adapter/v1"

/** Alias groups. Multiple present keys must agree after normalize; never first-wins on divergence. */
export const FIELD_ALIASES = Object.freeze({
  productId: Object.freeze(["productId", "product_id"]),
  tenantId: Object.freeze(["tenantId", "tenant_id"]),
  sourceHost: Object.freeze(["host", "sourceHost"]),
  brand: Object.freeze(["brand", "company_name", "companyName"]),
  lineName: Object.freeze(["lineName", "line_name"]),
  name: Object.freeze(["name", "title"]),
  categoryName: Object.freeze(["categoryName", "category_name"]),
  publicProductCode: Object.freeze(["publicProductCode", "public_product_code", "sku"]),
  description: Object.freeze(["description"]),
  price: Object.freeze(["price", "unit_price", "unitPrice"]),
  currency: Object.freeze(["currency", "priceCurrency", "price_currency"]),
  availability: Object.freeze(["availability"]),
  slug: Object.freeze(["slug"]),
  visible: Object.freeze(["visible"]),
  catalogEnabled: Object.freeze(["catalogEnabled", "catalog_enabled"]),
  tenantActive: Object.freeze(["tenantActive", "tenant_active"]),
  identityLabelOverride: Object.freeze(["identityLabelOverride", "identity_label_override"]),
  seoTitleOverride: Object.freeze(["seoTitleOverride", "seo_title_override"]),
  seoDescriptionOverride: Object.freeze(["seoDescriptionOverride", "seo_description_override"]),
})

const IMAGE_SINGLE_ALIASES = Object.freeze(["image_url", "imageUrl", "image_original_url"])
const BOOL_FIELDS = new Set(["visible", "catalogEnabled", "tenantActive"])

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return /** @type {Record<string, unknown>} */ (value)
}

function asTrimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

function isPresentValue(value) {
  if (value == null) return false
  if (typeof value === "string" && value.trim() === "") return false
  return true
}

function mediaUrls(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === "string") return asTrimmed(item)
      if (!item || typeof item !== "object") return ""
      const rec = /** @type {Record<string, unknown>} */ (item)
      return asTrimmed(rec.url || rec.href)
    })
    .filter(Boolean)
}

function imageListFromUnknown(value) {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string" || item == null)) {
      return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    }
    return mediaUrls(value)
  }
  if (typeof value === "string" && value.trim()) return [value.trim()]
  return []
}

/**
 * Comparable key for alias agreement. Unicode identity for text; numeric for price;
 * URL sets for images. Divergent types do not coerce except price ("90" ≡ 90).
 * @param {string} field
 * @param {unknown} value
 */
export function aliasComparableKey(field, value) {
  if (field === "price") {
    const n = typeof value === "number" ? value : Number(value)
    if (typeof value === "number" && Number.isFinite(value)) return `num:${value}`
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(n)) return `num:${n}`
    return `type:${typeof value}:${stableStringify(value)}`
  }
  if (field === "images") {
    const urls = imageListFromUnknown(value)
      .map((url) => displayText(url).replace(/\/$/, ""))
      .filter(Boolean)
      .sort()
    return `img:${urls.join("\n")}`
  }
  if (field === "variantAttributes") {
    const items = Array.isArray(value)
      ? value.map((item) => identityKey(item)).filter(Boolean).sort()
      : [identityKey(value)].filter(Boolean)
    return `va:${items.join("\n")}`
  }
  if (BOOL_FIELDS.has(field)) {
    if (typeof value === "boolean") return `bool:${value}`
    return `type:${typeof value}:${stableStringify(value)}`
  }
  if (field === "productId" || field === "tenantId") {
    if (typeof value !== "string") return `type:${typeof value}:${stableStringify(value)}`
    return `id:${tenantKey(value)}`
  }
  if (field === "sourceHost") {
    if (typeof value !== "string") return `type:${typeof value}:${stableStringify(value)}`
    return `host:${hostKey(value)}`
  }
  if (typeof value !== "string") {
    return `type:${typeof value}:${stableStringify(value)}`
  }
  return `str:${identityKey(value)}`
}

function pickStrict(source, aliases, field) {
  const found = []
  for (const key of aliases) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    const value = source[key]
    if (!isPresentValue(value)) continue
    found.push({ key, value })
  }
  if (!found.length) return { present: false, origin: null, value: null, conflict: false, reason: null }
  const keys = found.map((item) => aliasComparableKey(field, item.value))
  if (new Set(keys).size > 1) {
    return {
      present: false,
      origin: found.map((item) => `source.${item.key}`).sort().join(","),
      value: null,
      conflict: true,
      reason: `alias_conflict_${field}`,
    }
  }
  found.sort((a, b) => a.key.localeCompare(b.key))
  return {
    present: true,
    origin: found.map((item) => `source.${item.key}`).sort().join(","),
    value: found[0].value,
    conflict: false,
    reason: null,
  }
}

function pickVariantAttributes(source) {
  const arrays = []
  for (const key of ["variantAttributes", "variant_attributes"]) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    const value = source[key]
    if (!Array.isArray(value)) {
      return { present: false, origin: null, value: [], conflict: true, reason: "alias_conflict_variantAttributes" }
    }
    arrays.push({
      key,
      value: value.filter((item) => typeof item === "string" && item.trim()),
    })
  }
  const extras = []
  const extraOrigins = []
  for (const key of ["material", "dimensions"]) {
    const text = asTrimmed(source[key])
    if (!text) continue
    extras.push(text)
    extraOrigins.push(`source.${key}`)
  }

  if (arrays.length) {
    const keys = arrays.map((item) => aliasComparableKey("variantAttributes", item.value))
    if (new Set(keys).size > 1) {
      return { present: false, origin: null, value: [], conflict: true, reason: "alias_conflict_variantAttributes" }
    }
    if (extras.length) {
      const extraKey = aliasComparableKey("variantAttributes", extras)
      if (extraKey !== keys[0]) {
        return { present: false, origin: null, value: [], conflict: true, reason: "alias_conflict_variantAttributes" }
      }
    }
    const chosen = arrays.slice().sort((a, b) => a.key.localeCompare(b.key))[0]
    const origins = arrays.map((item) => `source.${item.key}`).sort()
    if (extras.length) origins.push(...extraOrigins)
    return {
      present: chosen.value.length > 0,
      origin: origins.join(","),
      value: chosen.value,
      conflict: false,
      reason: null,
    }
  }
  if (extras.length) {
    return { present: true, origin: extraOrigins.join(","), value: extras, conflict: false, reason: null }
  }
  return { present: false, origin: null, value: [], conflict: false, reason: null }
}

function pickImages(source) {
  const found = []
  if (Object.prototype.hasOwnProperty.call(source, "images")) {
    if (!Array.isArray(source.images) && source.images != null) {
      return { present: false, origin: null, value: [], conflict: true, reason: "alias_conflict_images" }
    }
    if (Array.isArray(source.images)) {
      found.push({
        key: "images",
        urls: source.images.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()),
      })
    }
  }
  if (Object.prototype.hasOwnProperty.call(source, "media")) {
    if (!Array.isArray(source.media) && source.media != null) {
      return { present: false, origin: null, value: [], conflict: true, reason: "alias_conflict_images" }
    }
    if (Array.isArray(source.media)) {
      found.push({ key: "media", urls: mediaUrls(source.media) })
    }
  }
  for (const key of IMAGE_SINGLE_ALIASES) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    const value = source[key]
    if (!isPresentValue(value)) continue
    if (typeof value !== "string") {
      return { present: false, origin: null, value: [], conflict: true, reason: "alias_conflict_images" }
    }
    found.push({ key, urls: [value.trim()] })
  }
  if (!found.length) return { present: false, origin: null, value: [], conflict: false, reason: null }
  const keys = found.map((item) => aliasComparableKey("images", item.urls))
  if (new Set(keys).size > 1) {
    return { present: false, origin: null, value: [], conflict: true, reason: "alias_conflict_images" }
  }
  found.sort((a, b) => a.key.localeCompare(b.key))
  return {
    present: found[0].urls.length > 0,
    origin: found.map((item) => `source.${item.key}`).sort().join(","),
    value: found[0].urls,
    conflict: false,
    reason: null,
  }
}

/**
 * Reconstruct today's public PDP paint for comparison. Display-only; not compiler input.
 * @param {Record<string, unknown>} input
 */
export function currentPublicPdpPaint(input) {
  const name = asTrimmed(input.name)
  const brand = asTrimmed(input.brand)
  const description = asTrimmed(input.description)
  const title = brand && name ? `${name} — ${brand}` : name
  return {
    h1: name,
    title,
    ogTitle: title,
    metaDescription: description || (name ? `Veja detalhes de ${name}.` : ""),
    ogDescription: description || (name ? `Veja detalhes de ${name}.` : ""),
    sitemapPath: asTrimmed(input.slug) ? `/p/${asTrimmed(input.slug)}` : "",
  }
}

/**
 * @param {unknown} source
 * @param {unknown} context
 * @returns {{
 *   ok: true
 *   input: Record<string, unknown>
 *   fieldProvenance: Record<string, { present: boolean, origin: string | null }>
 *   adapterVersion: string
 * } | {
 *   ok: false
 *   reason: string
 *   adapterVersion: string
 * }}
 */
export function adaptCatalogProductToSeoInputV1(source, context) {
  const src = asRecord(source)
  const ctx = asRecord(context)
  if (!src) return { ok: false, reason: "malformed_source", adapterVersion: SEO_ADAPTER_VERSION }
  if (!ctx) return { ok: false, reason: "missing_context", adapterVersion: SEO_ADAPTER_VERSION }

  if (!isTrustedCanonicalContext(ctx.canonicalContext)) {
    const sealed = asRecord(ctx.canonicalContext)
    return {
      ok: false,
      reason: (sealed && typeof sealed.reason === "string" && sealed.reason) || "missing_canonical_context",
      adapterVersion: SEO_ADAPTER_VERSION,
    }
  }

  const canonicalContext = ctx.canonicalContext
  const expectedTenantId = tenantKey(canonicalContext.tenantId)
  const contextHost = hostKey(canonicalContext.requestHost)
  const canonical = asPublicCanonicalContract(canonicalContext.canonical)
  if (!canonical) {
    return { ok: false, reason: "missing_canonical_authority", adapterVersion: SEO_ADAPTER_VERSION }
  }
  if (hostKey(canonical.host) !== hostKey(canonicalContext.primaryHost)) {
    return { ok: false, reason: "host_mismatch", adapterVersion: SEO_ADAPTER_VERSION }
  }
  if (ctx.expectedTenantId && tenantKey(ctx.expectedTenantId) !== expectedTenantId) {
    return { ok: false, reason: "tenant_mismatch", adapterVersion: SEO_ADAPTER_VERSION }
  }
  if (ctx.host && hostKey(ctx.host) !== contextHost && hostKey(ctx.host) !== hostKey(canonical.host)) {
    return { ok: false, reason: "host_mismatch", adapterVersion: SEO_ADAPTER_VERSION }
  }

  /** @type {Array<[string, ReturnType<typeof pickStrict>]>} */
  const picked = []
  const fieldOrder = [
    "productId",
    "tenantId",
    "sourceHost",
    "brand",
    "lineName",
    "name",
    "categoryName",
    "publicProductCode",
    "description",
    "price",
    "currency",
    "availability",
    "slug",
    "visible",
    "catalogEnabled",
    "tenantActive",
    "identityLabelOverride",
    "seoTitleOverride",
    "seoDescriptionOverride",
  ]
  for (const field of fieldOrder) {
    const result = pickStrict(src, FIELD_ALIASES[field], field)
    if (result.conflict) {
      return { ok: false, reason: result.reason, adapterVersion: SEO_ADAPTER_VERSION }
    }
    picked.push([field, result])
  }
  const byField = Object.fromEntries(picked)

  const variants = pickVariantAttributes(src)
  if (variants.conflict) {
    return { ok: false, reason: variants.reason, adapterVersion: SEO_ADAPTER_VERSION }
  }
  const images = pickImages(src)
  if (images.conflict) {
    return { ok: false, reason: images.reason, adapterVersion: SEO_ADAPTER_VERSION }
  }

  const sourceTenant = byField.tenantId
  if (sourceTenant.present && tenantKey(sourceTenant.value) !== expectedTenantId) {
    return { ok: false, reason: "tenant_mismatch", adapterVersion: SEO_ADAPTER_VERSION }
  }

  const sourceHost = byField.sourceHost
  if (sourceHost.present && hostKey(sourceHost.value) !== canonical.host) {
    return { ok: false, reason: "host_mismatch", adapterVersion: SEO_ADAPTER_VERSION }
  }

  const productId = byField.productId
  if (!productId.present) {
    return { ok: false, reason: "missing_product_id", adapterVersion: SEO_ADAPTER_VERSION }
  }

  const name = byField.name
  const lineName = byField.lineName
  const categoryName = byField.categoryName
  const description = byField.description
  const publicProductCode = byField.publicProductCode
  const price = byField.price
  const currency = byField.currency
  const availability = byField.availability
  const slug = byField.slug
  const visible = byField.visible
  const catalogEnabled = byField.catalogEnabled
  const tenantActive = byField.tenantActive
  const identityLabelOverride = byField.identityLabelOverride
  const seoTitleOverride = byField.seoTitleOverride
  const seoDescriptionOverride = byField.seoDescriptionOverride

  let brand = byField.brand
  if (!brand.present && asTrimmed(ctx.brand)) {
    brand = { present: true, origin: "context.brand", value: asTrimmed(ctx.brand) }
  }

  const slugValue = slug.present ? asTrimmed(slug.value) : ""
  const safeSlug = sanitizePublicProductSlug(slugValue)
  let canonicalUrl = ""
  let canonicalOrigin = null
  if (safeSlug) {
    canonicalUrl = buildCanonicalUrl(canonical, `/p/${safeSlug}`)
    canonicalOrigin = "context.canonical+slug"
  }

  const input = {
    productId: productId.value,
    tenantId: expectedTenantId,
    slug: slugValue,
    canonicalUrl,
    name: name.present ? name.value : "",
    lineName: lineName.present ? lineName.value : "",
    categoryName: categoryName.present ? categoryName.value : "",
    description: description.present ? description.value : "",
    variantAttributes: variants.value,
    publicProductCode: publicProductCode.present ? publicProductCode.value : "",
    images: images.value,
    brand: brand.present ? brand.value : "",
  }
  if (visible.present) input.visible = visible.value !== false
  if (catalogEnabled.present) {
    input.catalogEnabled = catalogEnabled.value !== false
  } else if (Object.prototype.hasOwnProperty.call(ctx, "catalogEnabled")) {
    input.catalogEnabled = ctx.catalogEnabled !== false
  }
  if (tenantActive.present) {
    input.tenantActive = tenantActive.value !== false
  } else if (Object.prototype.hasOwnProperty.call(ctx, "tenantActive")) {
    input.tenantActive = ctx.tenantActive !== false
  }
  if (price.present) input.price = price.value
  if (currency.present) input.currency = currency.value
  if (availability.present) input.availability = availability.value
  if (identityLabelOverride.present) input.identityLabelOverride = identityLabelOverride.value
  if (seoTitleOverride.present) input.seoTitleOverride = seoTitleOverride.value
  if (seoDescriptionOverride.present) input.seoDescriptionOverride = seoDescriptionOverride.value

  /** @type {Record<string, { present: boolean, origin: string | null }>} */
  const fieldProvenance = {
    productId: { present: true, origin: productId.origin },
    tenantId: {
      present: true,
      origin: sourceTenant.present ? sourceTenant.origin : "context.expectedTenantId",
    },
    brand: { present: brand.present, origin: brand.origin },
    lineName: { present: lineName.present, origin: lineName.origin },
    name: { present: name.present, origin: name.origin },
    variantAttributes: { present: variants.present, origin: variants.origin },
    categoryName: { present: categoryName.present, origin: categoryName.origin },
    publicProductCode: { present: publicProductCode.present, origin: publicProductCode.origin },
    description: { present: description.present, origin: description.origin },
    images: { present: images.present, origin: images.origin },
    price: { present: price.present, origin: price.origin },
    currency: { present: currency.present, origin: currency.origin },
    availability: { present: availability.present, origin: availability.origin },
    slug: { present: slug.present, origin: slug.origin },
    canonicalUrl: { present: Boolean(canonicalUrl), origin: canonicalOrigin },
    visible: { present: visible.present, origin: visible.origin },
    catalogEnabled: {
      present: catalogEnabled.present || Object.prototype.hasOwnProperty.call(ctx, "catalogEnabled"),
      origin: catalogEnabled.origin || (Object.prototype.hasOwnProperty.call(ctx, "catalogEnabled")
        ? "context.catalogEnabled"
        : null),
    },
    tenantActive: {
      present: tenantActive.present || Object.prototype.hasOwnProperty.call(ctx, "tenantActive"),
      origin: tenantActive.origin || (Object.prototype.hasOwnProperty.call(ctx, "tenantActive")
        ? "context.tenantActive"
        : null),
    },
    identityLabelOverride: {
      present: identityLabelOverride.present,
      origin: identityLabelOverride.origin,
    },
    seoTitleOverride: { present: seoTitleOverride.present, origin: seoTitleOverride.origin },
    seoDescriptionOverride: {
      present: seoDescriptionOverride.present,
      origin: seoDescriptionOverride.origin,
    },
  }

  return {
    ok: true,
    input,
    fieldProvenance,
    adapterVersion: SEO_ADAPTER_VERSION,
  }
}
