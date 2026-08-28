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
}

const DANGEROUS_SCHEMES = ["javascript", "vbscript", "data"]
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

/** Detection-only compact form. Never used as output. */
function compactForDetection(s) {
  return decodeHtmlEntities(String(s))
    .replace(/[\u0000-\u0020\u007F-\u009F\u00A0\u200B\u200C\uFEFF\u2060\u00AD]/g, "")
    .toLowerCase()
}

/**
 * @param {number} cp
 */
function isForbiddenControl(cp) {
  if (cp <= 0x1f) return true
  if (cp >= 0x7f && cp <= 0x9f) return true
  if (cp >= 0x202a && cp <= 0x202e) return true
  if (cp >= 0x2066 && cp <= 0x2069) return true
  if (cp === 0x200e || cp === 0x200f || cp === 0x061c) return true
  if (cp === 0x200b || cp === 0xfeff || cp === 0x2060 || cp === 0x00ad) return true
  if (cp === 0x200c) return true
  return false
}

/**
 * Plain-text policy for overrides. Rejects; never sanitizes.
 *
 * Unicode: detection runs on the original string and on HTML-entity-decoded
 * form. Accepted display is NFC + collapsed whitespace only after the value
 * passes. Limits use NFC code points (`[...str].length`), never UTF-16
 * `String.length`. Dangerous input is ignored; the automatic value stays.
 *
 * Future HTML boundary: always escape. Never use set:html / innerHTML.
 *
 * @param {unknown} raw
 * @param {{ maxCodePoints: number, kind: string, rejectUri: boolean }} opts
 */
export function validateOverridePlainText(raw, opts) {
  if (raw == null || String(raw).trim() === "") return { present: false }
  const original = String(raw)
  const decoded = decodeHtmlEntities(original)
  for (const source of [original, decoded]) {
    for (const ch of source) {
      const cp = ch.codePointAt(0)
      if (cp === 0x3c || cp === 0x3e) return { present: true, ok: false, reason: `${opts.kind}_markup` }
      if (isForbiddenControl(cp)) return { present: true, ok: false, reason: `${opts.kind}_control` }
    }
  }
  const compact = compactForDetection(original)
  for (const scheme of DANGEROUS_SCHEMES) {
    if (compact.includes(`${scheme}:`)) return { present: true, ok: false, reason: `${opts.kind}_scheme` }
  }
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
 * Label restates the base identity. Does not flag a short legitimate word
 * that merely occurs inside a longer token (e.g. "Ouro" inside "Marinho & Ouro Claro").
 *
 * @param {string} label
 * @param {string[]} tokens
 */
function isIdentityRestatement(label, tokens) {
  const lk = key(label)
  const base = joinName(tokens)
  const bk = key(base)
  if (!lk) return true
  if (bk && lk === bk) return true
  if (bk && lk.startsWith(bk)) return true
  const tokenKeys = tokens.map((t) => key(t)).filter(Boolean)
  if (tokenKeys.some((tk) => lk === tk)) return true
  if (tokenKeys.length >= 2 && tokenKeys.every((tk) => lk.includes(tk))) return true
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

/** @param {unknown} url */
function validImage(url) {
  const u = displayText(url)
  return u.startsWith("https://") || u.startsWith("http://")
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

/** @param {Record<string, unknown>} input */
function pass1Tokens(input) {
  const tokens = []
  addToken(tokens, input.lineName)
  addToken(tokens, input.name)
  return tokens
}

/** @param {Record<string, unknown>} input */
function isPublicInput(input) {
  return input.visible !== false && input.catalogEnabled !== false && input.tenantActive !== false
}

/**
 * Structured variant extras only. Description is never an identity token.
 * @param {Record<string, unknown>} input
 */
function variantExtras(input) {
  const structured = Array.isArray(input.variantAttributes) ? input.variantAttributes : []
  return structured.map((attr) => displayText(attr)).filter((t) => t && !isUuidToken(t))
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
  const rows = (Array.isArray(inputs) ? inputs : []).map((p) => ({
    input: p,
    tokens: pass1Tokens(p),
  }))

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
      if (planned.some((list) => list.length === 0)) continue
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

  applyStrict((row) => variantExtras(row.input))
  applyStrict((row) => displayText(row.input.categoryName))
  applyStrict((row) => {
    const code = displayText(row.input.publicProductCode)
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
    const c = key(p.input.canonicalUrl)
    if (s) slugOwners.set(s, (slugOwners.get(s) || 0) + 1)
    if (c) canonOwners.set(c, (canonOwners.get(c) || 0) + 1)
  }

  const automatic = rows.map((row, i) =>
    finalizeRow(row, {
      colliding: unresolved.has(i),
      identityLabelAccepted: Boolean(row.identityLabelAccepted),
      identityLabelReject: row.identityLabelReject || null,
      slugDup: (slugOwners.get(key(row.input.slug)) || 0) > 1,
      canonDup: (canonOwners.get(key(row.input.canonicalUrl)) || 0) > 1,
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
 * @param {{ input: Record<string, unknown>, tokens: string[], identityLabelAccepted?: boolean, identityLabelReject?: string }} row
 * @param {{ colliding: boolean, identityLabelAccepted: boolean, identityLabelReject: string | null, slugDup: boolean, canonDup: boolean }} ctx
 */
function finalizeRow(row, ctx) {
  const p = row.input
  const tokens = row.tokens
  const effective = joinName(tokens) || displayText(p.name)
  const brand = displayText(p.brand)
  const autoDesc = composeDescription(
    effective,
    displayText(p.description),
    displayText(p.lineName),
    displayText(p.name),
    displayText(p.categoryName),
  )
  const autoTitle = brand ? `${effective}${TITLE_SEP}${brand}` : effective
  const images = Array.isArray(p.images) ? p.images.map((u) => displayText(u)).filter(Boolean) : []
  const errors = []
  const visible = p.visible !== false
  const catalogEnabled = p.catalogEnabled !== false
  const tenantActive = p.tenantActive !== false

  if (!visible || !catalogEnabled || !tenantActive) errors.push("not_public")
  if (!effective) errors.push("empty_effective_name")
  if (!autoDesc) errors.push("empty_effective_description")
  if (!validImage(images[0])) errors.push("missing_valid_image")
  if (!displayText(p.slug)) errors.push("missing_slug")
  if (!displayText(p.canonicalUrl)) errors.push("missing_canonical")
  if (ctx.slugDup) errors.push("duplicate_slug")
  if (ctx.canonDup) errors.push("duplicate_canonical")
  if (ctx.colliding) errors.push("duplicate_effective_name")
  if (ctx.identityLabelReject) errors.push(ctx.identityLabelReject)

  let state = "auto_ready"
  if (errors.includes("not_public")) state = "suspended"
  else if (ctx.identityLabelAccepted && !ctx.colliding) state = "override_ready"
  else if (ctx.colliding || errors.includes("duplicate_effective_name")) state = "needs_input"
  else if (
    errors.includes("empty_effective_name") ||
    errors.includes("empty_effective_description") ||
    errors.includes("missing_valid_image") ||
    errors.includes("missing_slug") ||
    errors.includes("missing_canonical") ||
    errors.includes("duplicate_slug") ||
    errors.includes("duplicate_canonical")
  ) {
    state = "needs_input"
  }

  const indexingEnabled = state === "auto_ready" || state === "override_ready"
  const jsonLd = indexingEnabled
    ? buildJsonLd({
        name: effective,
        description: autoDesc,
        canonicalUrl: displayText(p.canonicalUrl),
        productId: displayText(p.productId),
        images,
        price: p.price,
        currency: p.currency,
        availability: p.availability,
      })
    : null

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
    errors,
    identityLabelAccepted: Boolean(ctx.identityLabelAccepted),
    identityLabelRejected: Boolean(ctx.identityLabelReject),
    seoTitleOverrideAccepted: false,
    seoTitleOverrideRejected: false,
    seoDescriptionOverrideAccepted: false,
    seoDescriptionOverrideRejected: false,
    overrideRejected: Boolean(ctx.identityLabelReject),
    needsInputPrompt: state === "needs_input" ? NEEDS_INPUT_PROMPT : null,
    indexingEnabled,
    inSitemapProposed: indexingEnabled,
    robotsProposed: indexingEnabled ? "index,follow" : "noindex,follow",
  }
}

/**
 * @param {unknown} raw
 * @param {number} max
 * @param {string} kind
 */
function validateSeoOverride(raw, max, kind, rejectUri) {
  return validateOverridePlainText(raw, { maxCodePoints: max, kind, rejectUri })
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
    const descCheck = validateSeoOverride(input.seoDescriptionOverride, SEO_DESC_MAX, "seo_description", false)
    const errors = [...auto.errors]
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
      errors.push("seo_title_rejected", titleCheck.reason)
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
      errors.push("seo_description_rejected", descCheck.reason)
    }

    return {
      ...auto,
      seoTitle,
      metaDescription,
      ogDescription,
      jsonLd,
      errors,
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

/**
 * @param {{
 *   name: string
 *   description: string
 *   canonicalUrl: string
 *   productId: string
 *   images: string[]
 *   price: unknown
 *   currency: unknown
 *   availability: unknown
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
  const priceNum = args.price == null || args.price === "" ? NaN : Number(args.price)
  const currency = displayText(args.currency)
  const availability = displayText(args.availability)
  if (Number.isFinite(priceNum) && currency && availability) {
    jsonLd.offers = {
      "@type": "Offer",
      price: priceNum,
      priceCurrency: currency,
      availability,
    }
  }
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
    if (!row.errors.includes("duplicate_effective_name")) continue
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
    couldResolveWithStructuredAttributeOrIdentityLabel: products.filter((row) => row.state === "needs_input")
      .length,
    products,
  }
}
