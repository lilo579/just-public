/**
 * JUST Product SEO Compiler v1 — pure function, no I/O, no tenant/host/slug/segment branches.
 * Calculated output only. Does not publish HTML, sitemap, robots, or JSON-LD.
 */

import { createHash } from "node:crypto"

export const PRODUCT_SEO_COMPILER_VERSION = "just-product-seo-compiler/v1"
export const NEEDS_INPUT_PROMPT =
  "Precisamos diferenciar estes produtos. Informe o tipo, modelo ou outra característica real."

/**
 * Future HTML boundary: these strings are plain text. Always escape on emit.
 * Never use set:html, innerHTML, or equivalent with compiler output.
 */
export const HTML_ESCAPE_REQUIRED = true

const SEP = " · "
const TITLE_SEP = " | "
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEO_TITLE_MAX = 70
const SEO_DESC_MAX = 320
const IDENTITY_LABEL_MAX = 80
const FACTUAL_NAME_MAX = 120
const FACTUAL_DESC_MAX = 2000

/**
 * Documented identity-token separators: whitespace, middle dot, structural
 * hyphen/dash, colon (including fullwidth), slash, pipe, comma, semicolon.
 */
const TOKEN_SPLIT_RE = /[\s\u00b7\u2022|:;,/\-\u2010-\u2015\u2212\uFF1A\uFF0F\uFF0C]+/u
const TOKEN_LEAD_SEP_RE = /^[\s\u00b7\u2022|:;,/\-\u2010-\u2015\u2212\uFF1A\uFF0F\uFF0C]+/u

/** Fingerprint includes only inputs that can change compiled output. */
export const FINGERPRINT_INCLUDED = Object.freeze([
  "compilerVersion",
  "productId",
  "slug",
  "canonicalUrl",
  "name",
  "lineName",
  "categoryName",
  "description",
  "variantAttributes",
  "publicProductCode",
  "images",
  "price",
  "currency",
  "availability",
  "brand",
  "visible",
  "catalogEnabled",
  "tenantActive",
  "identityLabelOverride",
  "seoTitleOverride",
  "seoDescriptionOverride",
])

export const FINGERPRINT_EXCLUDED = Object.freeze([
  "tenantId",
  "host",
  "computedAt",
  "override",
])

const NAMED_ENTITIES = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
  colon: ":",
  nbsp: " ",
  tab: "\t",
  newline: "\n",
}

const DANGEROUS_SCHEMES = ["javascript", "vbscript", "data", "file"]
const URI_LIKE = /^(https?|ftp|mailto|file|tel):/i
const SCHEME_SLASH = /^[a-z][a-z0-9+.-]*:\/\//i

/** @param {unknown} value */
export function stableStringify(value) {
  if (value === undefined) return "null"
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`
}

/** @param {unknown} value */
export function displayText(value) {
  if (value == null) return ""
  const t = String(value)
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return t
}

/** Identity comparison: NFC display → NFD, strip marks, casefold. */
export function identityKey(value) {
  return displayText(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("und")
}

function key(value) {
  return identityKey(value)
}

/** @param {unknown} value */
function isUuidToken(value) {
  const t = displayText(value)
  return Boolean(t) && UUID_RE.test(t)
}

/** Unicode code points after NFC. Deterministic; not UTF-16 units. */
export function countCodePoints(value) {
  return [...String(value)].length
}

/** @param {string} s */
function decodeHtmlEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, inner) => {
    if (inner[0] === "#") {
      const n = inner[1] === "x" || inner[1] === "X" ? parseInt(inner.slice(2), 16) : parseInt(inner.slice(1), 10)
      if (Number.isFinite(n) && n >= 0 && n <= 0x10ffff) return String.fromCodePoint(n)
      return whole
    }
    const mapped = NAMED_ENTITIES[inner.toLowerCase()]
    return mapped == null ? whole : mapped
  })
}

/**
 * Detection-only compact form. Never used as published display.
 * NFKC folds fullwidth punctuation (U+FF1A → ":") after entity decode.
 */
function compactForDetection(s) {
  return decodeHtmlEntities(String(s))
    .normalize("NFKC")
    .replace(/[\u0000-\u0020\u007F-\u009F\u00A0\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF\u00AD\u061C]/g, "")
    .toLowerCase()
}

/**
 * @param {number} cp
 */
function isForbiddenControl(cp, allowEditorialWhitespace = false) {
  if (allowEditorialWhitespace && (cp === 0x09 || cp === 0x0a || cp === 0x0d)) return false
  if (cp <= 0x1f) return true
  if (cp >= 0x7f && cp <= 0x9f) return true
  if (cp >= 0x202a && cp <= 0x202e) return true
  if (cp >= 0x2066 && cp <= 0x2069) return true
  if (cp === 0x200e || cp === 0x200f || cp === 0x061c) return true
  if (cp === 0x200b || cp === 0xfeff || cp === 0x2060 || cp === 0x00ad) return true
  if (cp === 0x200c) return true
  return false
}

function hasForbiddenControls(s) {
  for (const ch of String(s)) {
    if (isForbiddenControl(ch.codePointAt(0))) return true
  }
  return false
}

function hasDangerousScheme(compact) {
  for (const scheme of DANGEROUS_SCHEMES) {
    if (compact.includes(`${scheme}:`)) return true
  }
  return false
}

/**
 * Plain-text policy. Rejects; never sanitizes.
 *
 * Unicode: detection runs on the original string and on HTML-entity-decoded
 * form. Scheme detection uses a compact NFKC form that is never published.
 * Accepted display is NFC + collapsed whitespace only after the value
 * passes. Limits use NFC code points (`[...str].length`), never UTF-16
 * `String.length`. Dangerous input is ignored; the automatic value stays.
 *
 * Future HTML boundary: always escape. Never use set:html / innerHTML.
 *
 * @param {unknown} raw
 * @param {{ maxCodePoints: number, kind: string, rejectUri: boolean, allowEditorialWhitespace?: boolean }} opts
 */
export function validateOverridePlainText(raw, opts) {
  if (raw == null || String(raw).trim() === "") return { present: false }
  const original = String(raw)
  const decoded = decodeHtmlEntities(original)
  const allowEditorial = Boolean(opts.allowEditorialWhitespace)
  for (const source of [original, decoded]) {
    for (const ch of source) {
      const cp = ch.codePointAt(0)
      if (cp === 0x3c || cp === 0x3e) return { present: true, ok: false, reason: `${opts.kind}_markup` }
      if (isForbiddenControl(cp, allowEditorial)) return { present: true, ok: false, reason: `${opts.kind}_control` }
    }
  }
  const compact = compactForDetection(original)
  if (hasDangerousScheme(compact)) return { present: true, ok: false, reason: `${opts.kind}_scheme` }
  if (opts.rejectUri) {
    if (URI_LIKE.test(compact) || SCHEME_SLASH.test(compact) || compact.startsWith("//")) {
      return { present: true, ok: false, reason: `${opts.kind}_uri` }
    }
  }
  const value = displayText(original)
  if (!value) return { present: true, ok: false, reason: `${opts.kind}_empty` }
  if (isUuidToken(value)) return { present: true, ok: false, reason: `${opts.kind}_uuid` }
  if (countCodePoints(value) > opts.maxCodePoints) return { present: true, ok: false, reason: `${opts.kind}_too_long` }
  return { present: true, ok: true, value }
}

/**
 * HTTPS public URL for images and canonical. Never uses validateOverridePlainText.
 * Detection-only compact/NFKC is not published.
 *
 * @param {unknown} raw
 * @param {string} kind
 */
export function validatePublicHttpsUrl(raw, kind = "image") {
  if (raw == null || String(raw).trim() === "") return { present: false }
  const original = String(raw)
  if (hasForbiddenControls(original) || hasForbiddenControls(decodeHtmlEntities(original))) {
    return { present: true, ok: false, reason: `${kind}_control` }
  }
  const compact = compactForDetection(original)
  if (hasDangerousScheme(compact)) return { present: true, ok: false, reason: `${kind}_scheme` }
  if (compact.startsWith("http:") && !compact.startsWith("https:")) {
    return { present: true, ok: false, reason: `${kind}_scheme` }
  }
  let parsed
  try {
    parsed = new URL(original.trim())
  } catch {
    return { present: true, ok: false, reason: `${kind}_invalid` }
  }
  if (parsed.protocol !== "https:") return { present: true, ok: false, reason: `${kind}_scheme` }
  if (parsed.username !== "" || parsed.password !== "") {
    return { present: true, ok: false, reason: `${kind}_credentials` }
  }
  if (!parsed.hostname) return { present: true, ok: false, reason: `${kind}_host` }
  if (hasForbiddenControls(parsed.href)) return { present: true, ok: false, reason: `${kind}_control` }
  return { present: true, ok: true, value: parsed.href }
}

/**
 * @param {unknown[]} rawImages
 */
export function acceptPublicImages(rawImages) {
  const errors = []
  const accepted = []
  const seen = new Set()
  const list = Array.isArray(rawImages) ? rawImages : []
  for (const item of list) {
    const check = validatePublicHttpsUrl(item, "image")
    if (!check.present) continue
    if (!check.ok) {
      errors.push(check.reason)
      continue
    }
    if (seen.has(check.value)) continue
    seen.add(check.value)
    accepted.push(check.value)
  }
  return { images: accepted, errors, missing: accepted.length === 0 }
}

const SUPPORTED_CURRENCIES = Object.freeze([
  "BRL",
  "USD",
  "EUR",
  "GBP",
  "ARS",
  "CLP",
  "COP",
  "MXN",
  "PEN",
  "UYU",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "ZAR",
  "INR",
  "KRW",
  "SGD",
  "HKD",
  "AED",
  "SAR",
  "TRY",
])

const SCHEMA_AVAILABILITY = Object.freeze([
  "https://schema.org/InStock",
  "https://schema.org/OutOfStock",
  "https://schema.org/PreOrder",
  "https://schema.org/BackOrder",
  "https://schema.org/LimitedAvailability",
  "https://schema.org/Discontinued",
  "https://schema.org/SoldOut",
  "https://schema.org/OnlineOnly",
  "https://schema.org/InStoreOnly",
  "https://schema.org/PreSale",
])

function serializeStableDecimal(n) {
  if (!Number.isFinite(n) || n < 0) return null
  if (Object.is(n, -0)) n = 0
  const s = Number.isInteger(n) ? String(n) : String(n)
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) return null
  return s
}

function acceptPrice(raw) {
  if (raw == null || raw === "") return { present: false }
  if (typeof raw === "number") {
    const serialized = serializeStableDecimal(raw)
    if (serialized == null) return { present: true, ok: false, reason: "offers_price" }
    return { present: true, ok: true, value: serialized }
  }
  if (typeof raw !== "string" && typeof raw !== "number") {
    return { present: true, ok: false, reason: "offers_price" }
  }
  const s = String(raw).trim()
  if (!s) return { present: false }
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) return { present: true, ok: false, reason: "offers_price" }
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return { present: true, ok: false, reason: "offers_price" }
  return { present: true, ok: true, value: s }
}

function acceptCurrency(raw) {
  if (raw == null || String(raw).trim() === "") return { present: false }
  const canonical = String(raw).trim().toUpperCase()
  if (!SUPPORTED_CURRENCIES.includes(canonical)) return { present: true, ok: false, reason: "offers_currency" }
  return { present: true, ok: true, value: canonical }
}

function acceptAvailability(raw) {
  if (raw == null || String(raw).trim() === "") return { present: false }
  const original = String(raw).trim()
  if (hasForbiddenControls(original) || hasDangerousScheme(compactForDetection(original))) {
    return { present: true, ok: false, reason: "offers_availability" }
  }
  let parsed
  try {
    parsed = new URL(original)
  } catch {
    return { present: true, ok: false, reason: "offers_availability" }
  }
  if (parsed.protocol !== "https:") return { present: true, ok: false, reason: "offers_availability" }
  if (parsed.username || parsed.password) return { present: true, ok: false, reason: "offers_availability" }
  if (parsed.hostname !== "schema.org") return { present: true, ok: false, reason: "offers_availability" }
  if (parsed.search || parsed.hash) return { present: true, ok: false, reason: "offers_availability" }
  const canonical = `https://schema.org${parsed.pathname}`
  if (!SCHEMA_AVAILABILITY.includes(canonical)) return { present: true, ok: false, reason: "offers_availability" }
  return { present: true, ok: true, value: canonical }
}

function acceptOffers(input) {
  const price = acceptPrice(input.price)
  const currency = acceptCurrency(input.currency)
  const availability = acceptAvailability(input.availability)
  const warnings = []
  if (price.present && !price.ok) warnings.push(price.reason)
  if (currency.present && !currency.ok) warnings.push(currency.reason)
  if (availability.present && !availability.ok) warnings.push(availability.reason)
  if (price.ok && currency.ok && availability.ok) {
    return {
      offers: {
        "@type": "Offer",
        price: price.value,
        priceCurrency: currency.value,
        availability: availability.value,
      },
      warnings,
    }
  }
  return { offers: null, warnings }
}

/**
 * @param {string} token
 * @param {string[]} existing
 */
function redundant(token, existing) {
  const kt = key(token)
  if (!kt) return true
  for (const e of existing) {
    const ke = key(e)
    if (kt === ke) return true
    if (kt.length >= 4 && ke.includes(kt)) return true
  }
  return false
}

/**
 * Split on documented separators after identityKey + NFKC (detection of
 * fullwidth punctuation). Not used as published text.
 * @param {string} value
 */
function identityTokenParts(value) {
  return key(value)
    .normalize("NFKC")
    .split(TOKEN_SPLIT_RE)
    .filter(Boolean)
}

/**
 * Label restates the base identity. Lexical prefixes without a separator
 * (Solar vs Sol, Anelar vs Anel) are not restatement.
 *
 * @param {string} label
 * @param {string[]} tokens
 */
export function isIdentityRestatement(label, tokens) {
  const lk = key(label).normalize("NFKC")
  const base = joinName(tokens)
  const bk = key(base).normalize("NFKC")
  if (!lk) return true
  if (bk && lk === bk) return true
  if (bk && lk.startsWith(bk) && lk.length > bk.length && TOKEN_LEAD_SEP_RE.test(lk.slice(bk.length))) {
    return true
  }
  const tokenKeys = tokens.map((t) => key(t).normalize("NFKC")).filter(Boolean)
  if (tokenKeys.some((tk) => lk === tk)) return true
  const baseParts = identityTokenParts(base)
  const labelParts = identityTokenParts(label)
  if (
    baseParts.length >= 1 &&
    labelParts.length >= baseParts.length &&
    baseParts.every((part, i) => labelParts[i] === part) &&
    (labelParts.length > baseParts.length || baseParts.length >= 2)
  ) {
    return true
  }
  return false
}

/**
 * @param {string[]} tokens
 * @param {unknown} raw
 */
function addToken(tokens, raw) {
  const t = displayText(raw)
  if (!t || isUuidToken(t)) return
  if (redundant(t, tokens)) return
  tokens.push(t)
}

/** @param {string[]} tokens */
function joinName(tokens) {
  return tokens.join(SEP)
}

/**
 * @param {string} desc
 * @param {string} line
 * @param {string} name
 */
function informativeDescription(desc, line, name) {
  const d = displayText(desc)
  if (!d) return false
  if (key(d) === key(line) || key(d) === key(name)) return false
  return d.split(" ").length >= 2
}

/**
 * @param {string} effective
 * @param {string} desc
 * @param {string} line
 * @param {string} name
 * @param {string} category
 */
function composeDescription(effective, desc, line, name, category) {
  if (informativeDescription(desc, line, name)) return displayText(desc)
  const parts = []
  addToken(parts, effective)
  addToken(parts, category)
  return parts.length ? parts.join(" ") : effective
}

/**
 * @param {unknown} raw
 * @param {string} kind
 * @param {number} max
 * @param {boolean} rejectUri
 * @param {{ allowEditorialWhitespace?: boolean }} [extra]
 */
function takePlain(raw, kind, max, rejectUri, extra = {}) {
  const check = validateOverridePlainText(raw, {
    maxCodePoints: max,
    kind,
    rejectUri,
    allowEditorialWhitespace: extra.allowEditorialWhitespace,
  })
  if (!check.present) return { value: "", invalid: false, reason: null }
  if (!check.ok) return { value: "", invalid: true, reason: check.reason }
  return { value: check.value, invalid: false, reason: null }
}

/**
 * Factual tenant fields: invalid values never enter H1/title/meta/OG/alt/JSON-LD.
 * @param {Record<string, unknown>} input
 */
function readFacts(input) {
  const blockingErrors = []
  const qualityWarnings = []
  const name = takePlain(input.name, "name", FACTUAL_NAME_MAX, true)
  const lineName = takePlain(input.lineName, "lineName", FACTUAL_NAME_MAX, true)
  const categoryName = takePlain(input.categoryName, "categoryName", FACTUAL_NAME_MAX, true)
  const publicProductCode = takePlain(input.publicProductCode, "publicProductCode", FACTUAL_NAME_MAX, true)
  const brand = takePlain(input.brand, "brand", FACTUAL_NAME_MAX, true)
  const description = takePlain(input.description, "description", FACTUAL_DESC_MAX, false, {
    allowEditorialWhitespace: true,
  })
  if (name.invalid) blockingErrors.push(name.reason)
  if (lineName.invalid) qualityWarnings.push(lineName.reason)
  if (categoryName.invalid) qualityWarnings.push(categoryName.reason)
  if (publicProductCode.invalid) qualityWarnings.push(publicProductCode.reason)
  if (brand.invalid) qualityWarnings.push(brand.reason)
  if (description.invalid) qualityWarnings.push(description.reason)

  const variantAttributes = []
  const structured = Array.isArray(input.variantAttributes) ? input.variantAttributes : []
  for (const attr of structured) {
    const item = takePlain(attr, "variantAttributes", FACTUAL_NAME_MAX, true)
    if (item.invalid) {
      qualityWarnings.push(item.reason)
      continue
    }
    if (item.value) variantAttributes.push(item.value)
  }

  const canonical = validatePublicHttpsUrl(input.canonicalUrl, "canonical")
  let canonicalUrl = ""
  if (canonical.present && canonical.ok) canonicalUrl = canonical.value
  else if (canonical.present) blockingErrors.push(canonical.reason)

  const imagesResult = acceptPublicImages(input.images)
  qualityWarnings.push(...imagesResult.errors)
  const offersResult = acceptOffers(input)
  qualityWarnings.push(...offersResult.warnings)

  return {
    name: name.value,
    nameInvalid: name.invalid,
    lineName: lineName.value,
    categoryName: categoryName.value,
    publicProductCode: publicProductCode.value,
    brand: brand.value,
    description: description.value,
    variantAttributes,
    canonicalUrl,
    images: imagesResult.images,
    missingValidImage: imagesResult.missing,
    offers: offersResult.offers,
    identityRequiredInvalid: name.invalid,
    blockingErrors,
    qualityWarnings,
  }
}

/** @param {Record<string, unknown>} input */
function fingerprintInput(input) {
  return {
    compilerVersion: PRODUCT_SEO_COMPILER_VERSION,
    productId: displayText(input.productId),
    slug: displayText(input.slug),
    canonicalUrl: displayText(input.canonicalUrl),
    name: displayText(input.name),
    lineName: displayText(input.lineName),
    categoryName: displayText(input.categoryName),
    description: displayText(input.description),
    variantAttributes: Array.isArray(input.variantAttributes)
      ? input.variantAttributes.map((v) => displayText(v)).filter(Boolean)
      : [],
    publicProductCode: displayText(input.publicProductCode),
    images: Array.isArray(input.images) ? input.images.map((v) => displayText(v)) : [],
    price: input.price == null || input.price === "" ? null : Number(input.price),
    currency: displayText(input.currency) || null,
    availability: displayText(input.availability) || null,
    brand: displayText(input.brand),
    visible: input.visible !== false,
    catalogEnabled: input.catalogEnabled !== false,
    tenantActive: input.tenantActive !== false,
    identityLabelOverride: displayText(input.identityLabelOverride) || null,
    seoTitleOverride: displayText(input.seoTitleOverride) || null,
    seoDescriptionOverride: displayText(input.seoDescriptionOverride) || null,
  }
}

/** @param {{ lineName: string, name: string }} facts */
function pass1Tokens(facts) {
  const tokens = []
  addToken(tokens, facts.lineName)
  addToken(tokens, facts.name)
  return tokens
}

/** @param {Record<string, unknown>} input */
function isPublicInput(input) {
  return input.visible !== false && input.catalogEnabled !== false && input.tenantActive !== false
}

/**
 * Structured variant extras only. Description is never an identity token.
 * @param {{ variantAttributes: string[] }} facts
 */
function variantExtras(facts) {
  return facts.variantAttributes.filter((t) => t && !isUuidToken(t))
}

/**
 * Compile one product against a catalog of factual inputs (same tenant list).
 * Catalog isolation is the caller's: pass only one tenant's products.
 *
 * @param {Record<string, unknown>} input
 * @param {Record<string, unknown>[]} [catalog]
 */
export function compileProductSeoV1(input, catalog) {
  const list = Array.isArray(catalog) && catalog.length ? catalog : [input]
  const byId = new Map()
  for (const row of list) {
    if (row && row.productId) byId.set(String(row.productId), row)
  }
  byId.set(String(input.productId), input)
  const compiled = compileCatalogSeoV1([...byId.values()])
  const found = compiled.find((row) => row.productId === displayText(input.productId))
  if (!found) throw new Error("compileProductSeoV1: product missing from catalog result")
  return found
}

/**
 * @param {Record<string, unknown>[]} inputs
 * @returns {ReturnType<typeof finalizeRow>[]}
 */
export function compileCatalogSeoV1(inputs) {
  const rows = (Array.isArray(inputs) ? inputs : []).map((p) => {
    const facts = readFacts(p)
    return {
      input: p,
      facts,
      tokens: pass1Tokens(facts),
      structuredResolutionCandidate: false,
    }
  })

  const identityKeyOf = (i) => key(joinName(rows[i].tokens))

  const applyStrict = (extraFn) => {
    /** @type {Map<string, number[]>} */
    const groups = new Map()
    rows.forEach((row, i) => {
      if (!isPublicInput(row.input)) return
      const k = identityKeyOf(i) || "__empty__"
      const list = groups.get(k) || []
      list.push(i)
      groups.set(k, list)
    })
    for (const idxs of groups.values()) {
      if (idxs.length < 2) continue
      const snapshots = idxs.map((i) => rows[i].tokens.slice())
      const planned = idxs.map((i) => {
        const extras = extraFn(rows[i])
        const list = Array.isArray(extras) ? extras : extras ? [extras] : []
        return list
          .map((t) => displayText(t))
          .filter((t) => t && !isUuidToken(t) && !redundant(t, rows[i].tokens))
      })
      if (planned.some((list) => list.length === 0)) {
        if (planned.some((list) => list.length > 0)) {
          idxs.forEach((i) => {
            rows[i].structuredResolutionCandidate = true
          })
        }
        continue
      }
      idxs.forEach((i, j) => {
        for (const token of planned[j]) addToken(rows[i].tokens, token)
      })
      const names = idxs.map((i) => identityKeyOf(i))
      const uniqueInGroup = new Set(names).size === idxs.length
      const allComplete = names.every((n) => Boolean(n))
      /** @type {Map<string, number>} */
      const catalogCounts = new Map()
      rows.forEach((row, i) => {
        if (!isPublicInput(row.input)) return
        const k = identityKeyOf(i) || "__empty__"
        catalogCounts.set(k, (catalogCounts.get(k) || 0) + 1)
      })
      const uniqueInCatalog = idxs.every((i) => catalogCounts.get(identityKeyOf(i) || "__empty__") === 1)
      if (!allComplete || !uniqueInGroup || !uniqueInCatalog) {
        idxs.forEach((i, j) => {
          rows[i].tokens = snapshots[j]
        })
      }
    }
  }

  applyStrict((row) => variantExtras(row.facts))
  applyStrict((row) => row.facts.categoryName)
  applyStrict((row) => {
    const code = row.facts.publicProductCode
    return isUuidToken(code) ? "" : code
  })

  const originallyColliding = collidingActives(rows, identityKeyOf)
  applyIdentityLabels(rows, originallyColliding, identityKeyOf)

  const unresolved = new Set()
  for (const i of originallyColliding) {
    if (!rows[i].identityLabelAccepted) unresolved.add(i)
  }
  for (const i of collidingActives(rows, identityKeyOf)) unresolved.add(i)

  const slugOwners = new Map()
  const canonOwners = new Map()
  for (const p of rows) {
    const s = key(p.input.slug)
    const c = key(p.facts.canonicalUrl || p.input.canonicalUrl)
    if (s) slugOwners.set(s, (slugOwners.get(s) || 0) + 1)
    if (c) canonOwners.set(c, (canonOwners.get(c) || 0) + 1)
  }

  const automatic = rows.map((row, i) =>
    finalizeRow(row, {
      colliding: unresolved.has(i),
      identityLabelAccepted: Boolean(row.identityLabelAccepted),
      identityLabelReject: row.identityLabelReject || null,
      slugDup: (slugOwners.get(key(row.input.slug)) || 0) > 1,
      canonDup: (canonOwners.get(key(row.facts.canonicalUrl || row.input.canonicalUrl)) || 0) > 1,
      structuredResolutionCandidate: Boolean(row.structuredResolutionCandidate),
    }),
  )

  return applySeoFieldOverrides(automatic, rows)
    .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0))
}

/**
 * @param {{ input: Record<string, unknown>, tokens: string[], identityLabelAccepted?: boolean, identityLabelReject?: string }[]} rows
 * @param {(i: number) => string} identityKeyOf
 * @returns {Set<number>}
 */
function collidingActives(rows, identityKeyOf) {
  /** @type {Map<string, number[]>} */
  const groups = new Map()
  rows.forEach((row, i) => {
    if (!isPublicInput(row.input)) return
    const k = identityKeyOf(i) || "__empty__"
    const list = groups.get(k) || []
    list.push(i)
    groups.set(k, list)
  })
  const colliding = new Set()
  for (const idxs of groups.values()) {
    if (idxs.length > 1) idxs.forEach((i) => colliding.add(i))
  }
  return colliding
}

/**
 * Identity label is per colliding product. Empty is not a differentiator for neighbors.
 * Suspended products do not reserve labels against actives.
 *
 * @param {{ input: Record<string, unknown>, tokens: string[], identityLabelAccepted?: boolean, identityLabelReject?: string }[]} rows
 * @param {Set<number>} originallyColliding
 * @param {(i: number) => string} identityKeyOf
 */
function applyIdentityLabels(rows, originallyColliding, identityKeyOf) {
  /** @type {{ i: number, label: string, labelKey: string }[]} */
  const proposed = []
  for (const i of originallyColliding) {
    const raw = rows[i].input.identityLabelOverride
    const check = validateOverridePlainText(raw, {
      maxCodePoints: IDENTITY_LABEL_MAX,
      kind: "identity_label",
      rejectUri: true,
    })
    if (!check.present) continue
    if (!check.ok) {
      rows[i].identityLabelReject = check.reason
      continue
    }
    const label = check.value
    if (isIdentityRestatement(label, rows[i].tokens)) {
      rows[i].identityLabelReject = "identity_label_restatement"
      continue
    }
    proposed.push({ i, label, labelKey: key(label) })
  }

  /** @type {Map<string, number>} */
  const labelCounts = new Map()
  for (const p of proposed) {
    labelCounts.set(p.labelKey, (labelCounts.get(p.labelKey) || 0) + 1)
  }
  const uniqueProposed = proposed.filter((p) => {
    if ((labelCounts.get(p.labelKey) || 0) > 1) {
      rows[p.i].identityLabelReject = "identity_label_duplicate"
      return false
    }
    return true
  })

  const snapshots = new Map(uniqueProposed.map((p) => [p.i, rows[p.i].tokens.slice()]))
  for (const p of uniqueProposed) {
    const t = displayText(p.label)
    if (!t || isUuidToken(t)) continue
    if (rows[p.i].tokens.some((e) => key(e) === key(t))) continue
    rows[p.i].tokens.push(t)
  }

  /** @type {Map<string, number>} */
  const catalogCounts = new Map()
  rows.forEach((row, i) => {
    if (!isPublicInput(row.input)) return
    const k = identityKeyOf(i) || "__empty__"
    catalogCounts.set(k, (catalogCounts.get(k) || 0) + 1)
  })
  for (const p of uniqueProposed) {
    const k = identityKeyOf(p.i)
    if (!k || catalogCounts.get(k) !== 1) {
      rows[p.i].tokens = snapshots.get(p.i)
      rows[p.i].identityLabelReject = "identity_label_duplicate"
      continue
    }
    rows[p.i].identityLabelAccepted = true
  }
}

/**
 * @param {{ input: Record<string, unknown>, facts: ReturnType<typeof readFacts>, tokens: string[], identityLabelAccepted?: boolean, identityLabelReject?: string, structuredResolutionCandidate?: boolean }} row
 * @param {{ colliding: boolean, identityLabelAccepted: boolean, identityLabelReject: string | null, slugDup: boolean, canonDup: boolean, structuredResolutionCandidate: boolean }} ctx
 */
function finalizeRow(row, ctx) {
  const p = row.input
  const facts = row.facts
  const tokens = row.tokens
  const effective = joinName(tokens)
  const brand = facts.brand
  const autoDesc = composeDescription(
    effective,
    facts.description,
    facts.lineName,
    facts.name,
    facts.categoryName,
  )
  const autoTitle = brand ? `${effective}${TITLE_SEP}${brand}` : effective
  const images = facts.images
  const blockingErrors = [...facts.blockingErrors]
  const qualityWarnings = [...facts.qualityWarnings]
  const overrideErrors = []
  const visible = p.visible !== false
  const catalogEnabled = p.catalogEnabled !== false
  const tenantActive = p.tenantActive !== false

  if (!visible || !catalogEnabled || !tenantActive) blockingErrors.push("not_public")
  if (facts.identityRequiredInvalid) blockingErrors.push("identity_invalid")
  if (!effective) blockingErrors.push("empty_effective_name")
  if (!displayText(p.slug)) blockingErrors.push("missing_slug")
  if (!facts.canonicalUrl) blockingErrors.push("missing_canonical")
  if (ctx.slugDup) blockingErrors.push("duplicate_slug")
  if (ctx.canonDup) blockingErrors.push("duplicate_canonical")
  if (ctx.colliding) blockingErrors.push("duplicate_effective_name")
  if (ctx.identityLabelReject) overrideErrors.push(ctx.identityLabelReject)
  if (facts.missingValidImage) qualityWarnings.push("missing_valid_image")
  if (!autoDesc && effective) qualityWarnings.push("empty_effective_description")

  let state
  if (!visible || !catalogEnabled || !tenantActive) state = "suspended"
  else if (blockingErrors.length > 0) state = "needs_input"
  else if (ctx.identityLabelAccepted) state = "override_ready"
  else state = "auto_ready"

  const indexingProposed = state === "auto_ready" || state === "override_ready"
  const jsonLd =
    indexingProposed && facts.canonicalUrl
      ? buildJsonLd({
          name: effective,
          description: autoDesc,
          canonicalUrl: facts.canonicalUrl,
          productId: displayText(p.productId),
          images,
          offers: facts.offers,
        })
      : null
  const complete = isStructuredDataComplete(jsonLd)

  const structuredResolutionCandidate =
    state === "needs_input" && ctx.colliding && ctx.structuredResolutionCandidate

  return {
    productId: displayText(p.productId),
    compilerVersion: PRODUCT_SEO_COMPILER_VERSION,
    contentFingerprint: createHash("sha256").update(stableStringify(fingerprintInput(p))).digest("hex"),
    effectiveProductName: effective,
    seoTitle: autoTitle,
    metaDescription: autoDesc,
    ogTitle: autoTitle,
    ogDescription: autoDesc,
    imageAlt: effective,
    jsonLd,
    state,
    blockingErrors,
    qualityWarnings,
    overrideErrors,
    errors: blockingErrors,
    identityLabelAccepted: Boolean(ctx.identityLabelAccepted),
    identityLabelRejected: Boolean(ctx.identityLabelReject),
    seoTitleOverrideAccepted: false,
    seoTitleOverrideRejected: false,
    seoDescriptionOverrideAccepted: false,
    seoDescriptionOverrideRejected: false,
    overrideRejected: Boolean(ctx.identityLabelReject),
    needsInputPrompt: state === "needs_input" ? NEEDS_INPUT_PROMPT : null,
    indexingProposed,
    indexingEnabled: indexingProposed,
    jsonLdProposed: Boolean(jsonLd),
    structuredDataComplete: complete,
    richResultEligible: indexingProposed && complete,
    inSitemapProposed: indexingProposed,
    robotsProposed: indexingProposed ? "index,follow" : "noindex,follow",
    structuredResolutionCandidate,
  }
}

/**
 * @param {unknown} raw
 * @param {number} max
 * @param {string} kind
 */
function validateSeoOverride(raw, max, kind, rejectUri, extra = {}) {
  return validateOverridePlainText(raw, {
    maxCodePoints: max,
    kind,
    rejectUri,
    allowEditorialWhitespace: extra.allowEditorialWhitespace,
  })
}

/**
 * Independent SEO title/description overrides. Invalid field keeps the automatic value.
 *
 * @param {ReturnType<typeof finalizeRow>[]} automatic
 * @param {{ input: Record<string, unknown>, tokens: string[] }[]} rows
 */
function applySeoFieldOverrides(automatic, rows) {
  return automatic.map((auto, i) => {
    const input = rows[i].input
    const titleCheck = validateSeoOverride(input.seoTitleOverride, SEO_TITLE_MAX, "seo_title", true)
    const descCheck = validateSeoOverride(input.seoDescriptionOverride, SEO_DESC_MAX, "seo_description", false, {
      allowEditorialWhitespace: true,
    })
    const overrideErrors = [...auto.overrideErrors]
    let seoTitle = auto.seoTitle
    let metaDescription = auto.metaDescription
    let ogDescription = auto.ogDescription
    let jsonLd = auto.jsonLd
    let seoTitleOverrideAccepted = false
    let seoTitleOverrideRejected = false
    let seoDescriptionOverrideAccepted = false
    let seoDescriptionOverrideRejected = false

    if (titleCheck.present && titleCheck.ok) {
      seoTitle = titleCheck.value
      seoTitleOverrideAccepted = true
    } else if (titleCheck.present) {
      seoTitleOverrideRejected = true
      overrideErrors.push("seo_title_rejected", titleCheck.reason)
    }

    if (descCheck.present && descCheck.ok) {
      metaDescription = descCheck.value
      ogDescription = descCheck.value
      seoDescriptionOverrideAccepted = true
      if (jsonLd) {
        jsonLd = { ...jsonLd, description: descCheck.value }
      }
    } else if (descCheck.present) {
      seoDescriptionOverrideRejected = true
      overrideErrors.push("seo_description_rejected", descCheck.reason)
    }

    return {
      ...auto,
      seoTitle,
      metaDescription,
      ogDescription,
      jsonLd,
      blockingErrors: auto.blockingErrors,
      qualityWarnings: auto.qualityWarnings,
      overrideErrors,
      errors: auto.blockingErrors,
      seoTitleOverrideAccepted,
      seoTitleOverrideRejected,
      seoDescriptionOverrideAccepted,
      seoDescriptionOverrideRejected,
      overrideRejected:
        auto.overrideRejected || seoTitleOverrideRejected || seoDescriptionOverrideRejected,
      contentFingerprint: createHash("sha256")
        .update(stableStringify(fingerprintInput(input)))
        .digest("hex"),
    }
  })
}

function isStructuredDataComplete(jsonLd) {
  if (!jsonLd) return false
  const hasImage = Array.isArray(jsonLd.image) ? jsonLd.image.length > 0 : Boolean(jsonLd.image)
  return Boolean(jsonLd.name && jsonLd.url && jsonLd.description && hasImage && jsonLd.offers)
}

/**
 * @param {{
 *   name: string
 *   description: string
 *   canonicalUrl: string
 *   productId: string
 *   images: string[]
 *   offers: Record<string, unknown> | null
 * }} args
 */
function buildJsonLd(args) {
  /** @type {Record<string, unknown>} */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: args.name,
    description: args.description,
    url: args.canonicalUrl,
    productID: args.productId,
  }
  if (args.images.length) jsonLd.image = args.images
  if (args.offers) jsonLd.offers = args.offers
  return jsonLd
}

/**
 * Report-only preview: calculated catalog SEO. Caller must not apply robots/sitemap/HTML.
 * @param {Record<string, unknown>[]} inputs
 */
export function previewCatalogSeoReportOnly(inputs) {
  const products = compileCatalogSeoV1(inputs)
  /** @type {Record<string, number>} */
  const byState = { auto_ready: 0, override_ready: 0, needs_input: 0, suspended: 0 }
  for (const row of products) {
    byState[row.state] = (byState[row.state] || 0) + 1
  }
  /** @type {Record<string, { identityKey: string, representativeDisplay: string, displays: string[], productIds: string[] }>} */
  const collisions = {}
  for (const row of products) {
    if (!row.blockingErrors.includes("duplicate_effective_name")) continue
    const identity = identityKey(row.effectiveProductName) || "__empty__"
    const group = collisions[identity] || {
      identityKey: identity,
      representativeDisplay: row.effectiveProductName,
      displays: [],
      productIds: [],
    }
    if (!group.displays.includes(row.effectiveProductName)) group.displays.push(row.effectiveProductName)
    group.productIds.push(row.productId)
    collisions[identity] = group
  }
  const needs = products.filter((row) => row.state === "needs_input")
  const needsInputCount = needs.length
  const hasStructuredResolutionCandidate = needs.filter((row) => row.structuredResolutionCandidate).length
  const requiresIdentityLabelOrNewAttribute = needs.filter(
    (row) => row.blockingErrors.includes("duplicate_effective_name") && !row.structuredResolutionCandidate,
  ).length
  const indexingProposedCount = products.filter((row) => row.indexingProposed).length
  const jsonLdProposedCount = products.filter((row) => row.jsonLdProposed).length
  const structuredDataCompleteCount = products.filter((row) => row.structuredDataComplete).length
  const richResultEligibleCount = products.filter((row) => row.richResultEligible).length
  const qualityWarningProductCount = products.filter((row) => row.qualityWarnings.length > 0).length
  return {
    mode: "report-only",
    publishesHtml: false,
    publishesSitemap: false,
    publishesRobots: false,
    publishesJsonLd: false,
    compilerVersion: PRODUCT_SEO_COMPILER_VERSION,
    productCount: products.length,
    byState,
    collisionMatrix: collisions,
    needsInputPrompt: NEEDS_INPUT_PROMPT,
    needsInputCount,
    hasStructuredResolutionCandidate,
    requiresIdentityLabelOrNewAttribute,
    indexingProposedCount,
    inSitemapProposedCount: indexingProposedCount,
    jsonLdProposedCount,
    structuredDataCompleteCount,
    richResultEligibleCount,
    qualityWarningProductCount,
    products,
  }
}
