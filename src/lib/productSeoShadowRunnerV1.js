/**
 * Shadow / report-only runner for Product SEO Compiler v1.
 * Compiles in memory. Zero writes. Caller injects catalog loading.
 */

import { compileCatalogSeoV1, previewCatalogSeoReportOnly, identityKey, displayText, stableStringify } from "./productSeoCompilerV1.js"
import {
  adaptCatalogProductToSeoInputV1,
  currentPublicPdpPaint,
  SEO_ADAPTER_VERSION,
} from "./productSeoCatalogAdapterV1.js"
import {
  isTrustedCanonicalContext,
  resolveProductSeoCanonicalContextV1,
} from "./productSeoCanonicalContextV1.js"

export const SHADOW_RUNNER_VERSION = "just-product-seo-shadow/v1"
export const SHADOW_DEFAULT_LIMIT = 500
export const SHADOW_DEFAULT_PAGE_SIZE = 100
export const SHADOW_DEFAULT_TIMEOUT_MS = 4000
export const READ_ONLY_CATALOG_RPC = "public_get_products_by_host"
export const READ_ONLY_CANONICAL_RPC = "public_host_canonical_authority"
export const READ_ONLY_RPC_ALLOWLIST = Object.freeze([
  READ_ONLY_CATALOG_RPC,
  READ_ONLY_CANONICAL_RPC,
])
export const BLOCKED_CLIENT_METHODS = Object.freeze([
  "from",
  "insert",
  "update",
  "delete",
  "upsert",
  "storage",
  "schema",
])

function asTrimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

function isAbortLike(err) {
  if (!err || typeof err !== "object") return false
  const name = "name" in err ? String(err.name) : ""
  return name === "AbortError" || name === "TimeoutError"
}

function bump(map, key) {
  const k = key || "__empty__"
  map[k] = (map[k] || 0) + 1
}

function countKeys(values) {
  /** @type {Record<string, number>} */
  const out = {}
  for (const list of values) {
    for (const item of list || []) bump(out, String(item))
  }
  return out
}

function fieldCompleteness(provenances) {
  /** @type {Record<string, { present: number, absent: number }>} */
  const out = {}
  for (const provenance of provenances) {
    for (const [field, meta] of Object.entries(provenance || {})) {
      const row = out[field] || { present: 0, absent: 0 }
      if (meta && meta.present) row.present += 1
      else row.absent += 1
      out[field] = row
    }
  }
  return out
}

function redactString(value) {
  if (/whatsapp|wa\.me/i.test(value)) return "[redacted-contact]"
  if (/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./.test(value)) return "[redacted-token]"
  if (/[?&](token|sig|signature|signature=|apikey|api_key|access_token|refresh_token|sb|auth)=/i.test(value)) {
    return /\/storage\/|product-images\/|\.(webp|png|jpe?g|gif)(\?|$)/i.test(value)
      ? "[redacted-image]"
      : "[redacted-query]"
  }
  if (/supabase\.co\/storage|product-images\//i.test(value)) return "[redacted-image]"
  if (/^https:\/\/[^/]+\/.+\.(webp|png|jpe?g|gif)(\?|$)/i.test(value)) return "[redacted-image]"
  return value
}

/**
 * Drop storage URLs, WhatsApp, tokens, and sensitive query strings from the public report.
 * @param {unknown} value
 */
export function redactShadowValue(value) {
  if (typeof value === "string") return redactString(value)
  if (Array.isArray(value)) return value.map((item) => redactShadowValue(item))
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (k === "images" || k === "image" || k === "ogImage") {
        if (v && typeof v === "object" && !Array.isArray(v) && ("present" in v || "absent" in v)) {
          out[k] = v
          continue
        }
        out[k] = Array.isArray(v) ? v.map(() => "[redacted-image]") : v ? "[redacted-image]" : v
        continue
      }
      if (/^(whatsapp|phone|email|anonKey|anon_key|service_role|password|secret|token|authorization)/i.test(k)) {
        out[k] = "[redacted]"
        continue
      }
      out[k] = redactShadowValue(v)
    }
    return out
  }
  return value
}

function productContentFingerprint(input) {
  return stableStringify({
    slug: displayText(input.slug),
    name: identityKey(input.name),
    lineName: identityKey(input.lineName),
    categoryName: identityKey(input.categoryName),
    description: identityKey(input.description),
    variantAttributes: Array.isArray(input.variantAttributes)
      ? input.variantAttributes.map((item) => identityKey(item)).filter(Boolean).sort()
      : [],
    publicProductCode: identityKey(input.publicProductCode),
    images: Array.isArray(input.images) ? input.images.map((item) => identityKey(item)).sort() : [],
    price: input.price == null || input.price === "" ? null : Number(input.price),
    currency: identityKey(input.currency),
    availability: identityKey(input.availability),
    brand: identityKey(input.brand),
    canonicalUrl: displayText(input.canonicalUrl),
  })
}

function emptyWriteLog() {
  return []
}

function shadowFlags(writes, extra = {}) {
  return {
    mode: "shadow-report-only",
    writes: Object.freeze(writes.slice()),
    publishesHtml: false,
    publishesSitemap: false,
    publishesRobots: false,
    publishesJsonLd: false,
    persistsOverrides: false,
    persistsPublicationState: false,
    touchesGsc: false,
    catalogComplete: false,
    completeness: "unknown",
    ...extra,
    usableForEnforcement: false,
  }
}

function pageCountMeta(chunk) {
  if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) {
    return { kind: "none", total: null, version: null }
  }
  const rangeTotal =
    chunk.contentRange && typeof chunk.contentRange === "object" ? Number(chunk.contentRange.total) : NaN
  const totalRaw = chunk.totalCount != null ? chunk.totalCount : rangeTotal
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : null
  const exact = chunk.countKind === "exact" && total != null
  return {
    kind: exact ? "exact" : "none",
    total: exact ? total : null,
    version: chunk.snapshotVersion == null ? null : String(chunk.snapshotVersion),
  }
}

function evaluateCompleteness(state) {
  if (state.hitLimit) {
    return {
      catalogComplete: false,
      incomplete: true,
      completeness: "incomplete",
      completenessReason: "limit",
    }
  }
  const versions = [...new Set(state.snapshotVersions.filter(Boolean))]
  if (versions.length > 1) {
    return {
      catalogComplete: false,
      incomplete: true,
      completeness: "incomplete",
      completenessReason: "snapshot_version_changed",
    }
  }
  const exactTotals = state.exactTotals
  if (exactTotals.length) {
    const unique = [...new Set(exactTotals)]
    if (unique.length > 1) {
      return {
        catalogComplete: false,
        incomplete: true,
        completeness: "incomplete",
        completenessReason: "total_changed",
      }
    }
    const total = unique[0]
    if (state.received > total) {
      return {
        catalogComplete: false,
        incomplete: true,
        completeness: "incomplete",
        completenessReason: "total_less_than_received",
      }
    }
    if (state.lastWasEmpty && state.received < total) {
      return {
        catalogComplete: false,
        incomplete: true,
        completeness: "incomplete",
        completenessReason: "premature_empty_page",
      }
    }
    if (state.received < total) {
      return {
        catalogComplete: false,
        incomplete: true,
        completeness: "incomplete",
        completenessReason: "total_greater_than_received",
      }
    }
    return {
      catalogComplete: true,
      incomplete: false,
      completeness: "proven",
      completenessReason: "count_exact",
    }
  }
  return {
    catalogComplete: false,
    incomplete: true,
    completeness: "unknown",
    completenessReason: state.lastPageFull && state.lastNextPage == null ? "unproven_silent_cap" : "unproven_total",
  }
}

/**
 * @param {{
 *   loadCatalog: (args: {
 *     page: number
 *     pageSize: number
 *     signal: AbortSignal
 *   }) => Promise<{ rows?: unknown[], nextPage?: number | null } | unknown[]>
 *   context: Record<string, unknown>
 *   pageSize?: number
 *   limit?: number
 *   timeoutMs?: number
 *   signal?: AbortSignal
 *   writeAttempts?: string[]
 * }} args
 */
export async function runProductSeoShadowV1(args) {
  const writeAttempts = Array.isArray(args.writeAttempts) ? args.writeAttempts : emptyWriteLog()
  const pageSize =
    typeof args.pageSize === "number" && args.pageSize > 0 ? args.pageSize : SHADOW_DEFAULT_PAGE_SIZE
  const limit = typeof args.limit === "number" && args.limit > 0 ? args.limit : SHADOW_DEFAULT_LIMIT
  const timeoutMs =
    typeof args.timeoutMs === "number" && args.timeoutMs > 0 ? args.timeoutMs : SHADOW_DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (args.signal) {
    if (args.signal.aborted) controller.abort()
    else args.signal.addEventListener("abort", onAbort, { once: true })
  }
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  /** @type {unknown[]} */
  const rawRows = []
  /** @type {string[]} */
  const rejected = []
  let pagesRead = 0
  let incomplete = false
  let incompleteReason = null
  let catalogComplete = false
  let completeness = "unknown"
  let completenessReason = "unproven_total"
  const exactTotals = []
  const snapshotVersions = []
  let lastWasEmpty = false
  let lastPageFull = false
  let lastNextPage = null
  let hitLimit = false

  try {
    if (typeof args.loadCatalog !== "function") {
      return failClosed("missing_loader", writeAttempts, timedOut)
    }
    if (!isTrustedCanonicalContext(args.context?.canonicalContext)) {
      const reason = args.context?.canonicalContext?.reason || "missing_canonical_context"
      return failClosed(reason, writeAttempts, timedOut)
    }
    let page = 1
    while (rawRows.length < limit) {
      if (controller.signal.aborted) {
        return failClosed(timedOut ? "timeout" : "aborted", writeAttempts, timedOut)
      }
      const remaining = limit - rawRows.length
      const size = Math.min(pageSize, remaining)
      const chunk = await args.loadCatalog({
        page,
        pageSize: size,
        signal: controller.signal,
      })
      if (controller.signal.aborted) {
        return failClosed(timedOut ? "timeout" : "aborted", writeAttempts, timedOut)
      }
      pagesRead += 1
      const rows = Array.isArray(chunk) ? chunk : Array.isArray(chunk?.rows) ? chunk.rows : null
      if (!rows) return failClosed("malformed_page", writeAttempts, timedOut)
      const meta = pageCountMeta(Array.isArray(chunk) ? {} : chunk)
      if (meta.kind === "exact") exactTotals.push(meta.total)
      if (meta.version) snapshotVersions.push(meta.version)
      lastWasEmpty = rows.length === 0
      lastPageFull = rows.length === size
      lastNextPage = Array.isArray(chunk) ? (rows.length < size ? null : page + 1) : chunk.nextPage
      if (rows.length === 0) break
      if (rows.length > remaining) {
        rawRows.push(...rows.slice(0, remaining))
        hitLimit = true
        break
      }
      rawRows.push(...rows)
      if (lastNextPage == null || rows.length < size) break
      if (rawRows.length >= limit) {
        hitLimit = true
        break
      }
      page = lastNextPage
    }
  } catch (err) {
    if (timedOut || controller.signal.aborted || isAbortLike(err)) {
      return failClosed(timedOut ? "timeout" : "aborted", writeAttempts, timedOut)
    }
    if (err && typeof err === "object" && "code" in err && err.code === "write_method_blocked") {
      const method = "method" in err && err.method ? String(err.method) : "unknown"
      if (!writeAttempts.includes(method)) writeAttempts.push(method)
      return failClosed("write_attempted", writeAttempts, timedOut)
    }
    if (err && typeof err === "object" && "code" in err && err.code === "rpc_error") {
      return failClosed("rpc_error", writeAttempts, timedOut)
    }
    if (err && typeof err === "object" && "code" in err && err.code === "missing_rpc") {
      return failClosed("missing_rpc", writeAttempts, timedOut)
    }
    if (err && typeof err === "object" && "code" in err && err.code === "malformed_page") {
      return failClosed("malformed_page", writeAttempts, timedOut)
    }
    return failClosed("load_failed", writeAttempts, timedOut)
  } finally {
    clearTimeout(timer)
    if (args.signal) args.signal.removeEventListener("abort", onAbort)
  }

  if (writeAttempts.length) {
    return failClosed("write_attempted", writeAttempts, timedOut)
  }

  const completenessState = evaluateCompleteness({
    received: rawRows.length,
    hitLimit,
    exactTotals,
    snapshotVersions,
    lastWasEmpty,
    lastPageFull,
    lastNextPage,
  })
  catalogComplete = completenessState.catalogComplete
  incomplete = completenessState.incomplete
  incompleteReason = completenessState.completenessReason
  completeness = completenessState.completeness
  completenessReason = completenessState.completenessReason

  const pairs = []
  for (const row of rawRows) {
    const result = adaptCatalogProductToSeoInputV1(row, args.context)
    if (!result.ok) {
      rejected.push(result.reason)
      continue
    }
    pairs.push({ input: result.input, provenance: result.fieldProvenance })
  }

  pairs.sort((a, b) => identityKey(a.input.productId).localeCompare(identityKey(b.input.productId)))

  const unique = []
  const uniqueProvenance = []
  const seen = new Map()
  for (const pair of pairs) {
    const id = identityKey(pair.input.productId)
    const fingerprint = productContentFingerprint(pair.input)
    if (!seen.has(id)) {
      seen.set(id, fingerprint)
      unique.push(pair.input)
      uniqueProvenance.push(pair.provenance)
      continue
    }
    if (seen.get(id) !== fingerprint) {
      return failClosed("duplicate_product_id_conflict", writeAttempts, timedOut)
    }
  }

  const compiled = compileCatalogSeoV1(unique)
  const preview = previewCatalogSeoReportOnly(unique)
  const inputById = new Map(unique.map((row) => [identityKey(row.productId), row]))

  /** @type {Record<string, number>} */
  const rejectReasons = {}
  for (const reason of rejected) bump(rejectReasons, reason)

  const comparisons = compiled.map((row) => {
    const input = inputById.get(identityKey(row.productId)) || {}
    const paint = currentPublicPdpPaint(input)
    return {
      productId: row.productId,
      current: {
        h1: paint.h1,
        title: paint.title,
        metaDescription: paint.metaDescription,
        ogTitle: paint.ogTitle,
        sitemapPath: paint.sitemapPath,
      },
      proposed: {
        h1: row.effectiveProductName,
        title: row.seoTitle,
        metaDescription: row.metaDescription,
        ogTitle: row.ogTitle,
        sitemapPath: row.inSitemapProposed && input.slug ? `/p/${input.slug}` : null,
        state: row.state,
        indexingProposed: row.indexingProposed,
      },
      titleChanged: paint.title !== row.seoTitle,
      h1Changed: paint.h1 !== row.effectiveProductName,
      metaChanged: paint.metaDescription !== row.metaDescription,
      sitemapWouldInclude: row.inSitemapProposed === true,
    }
  })

  const report = {
    ...shadowFlags(writeAttempts, {
      catalogComplete,
      incomplete,
      incompleteReason,
      completeness,
      completenessReason,
    }),
    adapterVersion: SEO_ADAPTER_VERSION,
    runnerVersion: SHADOW_RUNNER_VERSION,
    compilerVersion: preview.compilerVersion,
    pagesRead,
    loadedCount: rawRows.length,
    adaptedCount: unique.length,
    rejectedCount: rejected.length,
    rejectReasons,
    metrics: {
      total: compiled.length,
      auto_ready: preview.byState.auto_ready || 0,
      override_ready: preview.byState.override_ready || 0,
      needs_input: preview.byState.needs_input || 0,
      suspended: preview.byState.suspended || 0,
      indexingProposed: preview.indexingProposedCount,
      inSitemapProposed: preview.inSitemapProposedCount,
      jsonLdProposed: preview.jsonLdProposedCount,
      structuredDataComplete: preview.structuredDataCompleteCount,
      richResultEligible: preview.richResultEligibleCount,
      collisions: Object.keys(preview.collisionMatrix || {}).length,
      requiresIdentityLabelOrNewAttribute: preview.requiresIdentityLabelOrNewAttribute,
      hasStructuredResolutionCandidate: preview.hasStructuredResolutionCandidate,
      blockingErrors: countKeys(compiled.map((row) => row.blockingErrors)),
      qualityWarnings: countKeys(compiled.map((row) => row.qualityWarnings)),
      fieldCompleteness: fieldCompleteness(uniqueProvenance),
    },
    collisionMatrix: preview.collisionMatrix,
    needsInputPrompt: preview.needsInputPrompt,
    comparisons,
    products: compiled.map((row) => ({
      productId: row.productId,
      state: row.state,
      effectiveProductName: row.effectiveProductName,
      seoTitle: row.seoTitle,
      metaDescription: row.metaDescription,
      blockingErrors: row.blockingErrors,
      qualityWarnings: row.qualityWarnings,
      overrideErrors: row.overrideErrors,
      indexingProposed: row.indexingProposed,
      inSitemapProposed: row.inSitemapProposed,
      jsonLdProposed: row.jsonLdProposed,
      structuredDataComplete: row.structuredDataComplete,
      richResultEligible: row.richResultEligible,
      structuredResolutionCandidate: row.structuredResolutionCandidate,
    })),
  }

  return redactShadowValue(report)
}

function failClosed(reason, writeAttempts, timedOut) {
  return redactShadowValue({
    ...shadowFlags(writeAttempts, {
      ok: false,
      reason,
      timedOut,
      catalogComplete: false,
      incomplete: true,
      incompleteReason: reason,
      completeness: "incomplete",
      completenessReason: reason,
    }),
    adapterVersion: SEO_ADAPTER_VERSION,
    runnerVersion: SHADOW_RUNNER_VERSION,
    metrics: {
      total: 0,
      auto_ready: 0,
      override_ready: 0,
      needs_input: 0,
      suspended: 0,
      indexingProposed: 0,
    },
    products: [],
    comparisons: [],
  })
}

/**
 * Intercept write-capable client methods. Allowlist is read-only RPCs only.
 * @param {{ rpc?: Function }} supabase
 * @param {string[]} writeAttempts
 */
export function wrapReadOnlySupabase(supabase, writeAttempts = []) {
  const blocked = new Set(BLOCKED_CLIENT_METHODS)
  return new Proxy(supabase, {
    get(target, prop, receiver) {
      const name = String(prop)
      if (blocked.has(name)) {
        writeAttempts.push(name)
        const err = new Error("write_method_blocked")
        err.code = "write_method_blocked"
        err.method = name
        throw err
      }
      if (name === "rpc") {
        return (rpcName, rpcArgs) => {
          if (!READ_ONLY_RPC_ALLOWLIST.includes(rpcName)) {
            writeAttempts.push(`rpc:${rpcName}`)
            const err = new Error("non_catalog_rpc_blocked")
            err.code = "write_method_blocked"
            err.method = `rpc:${rpcName}`
            throw err
          }
          return target.rpc(rpcName, rpcArgs)
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}

function readCatalogRpcResult(result) {
  if (result && result.error) {
    const err = new Error("rpc_error")
    err.code = "rpc_error"
    throw err
  }
  if (!result || !Array.isArray(result.data)) {
    const err = new Error("malformed_page")
    err.code = "malformed_page"
    throw err
  }
  return { rows: result.data, nextPage: null, countKind: "none" }
}

/**
 * Host-bound list RPC loader. Inject supabase; no writes.
 * @param {{
 *   supabase: { rpc?: Function }
 *   host: string
 *   writeAttempts?: string[]
 * }} args
 */
export function createHostBoundCatalogLoader(args) {
  const writeAttempts = Array.isArray(args.writeAttempts) ? args.writeAttempts : []
  return async function loadCatalog({ signal }) {
    const host = asTrimmed(args.host).toLowerCase()
    if (!host) {
      const err = new Error("unknown_host")
      err.code = "unknown_host"
      throw err
    }
    if (!args.supabase || typeof args.supabase.rpc !== "function") {
      const err = new Error("missing_rpc")
      err.code = "missing_rpc"
      throw err
    }
    const guarded = wrapReadOnlySupabase(args.supabase, writeAttempts)
    const builder = guarded.rpc(READ_ONLY_CATALOG_RPC, { p_host: host })
    if (builder && typeof builder.abortSignal === "function") {
      return readCatalogRpcResult(await builder.abortSignal(signal))
    }
    return readCatalogRpcResult(await builder)
  }
}

/**
 * Resolve sealed canonical context from the public canonical RPC.
 * @param {{
 *   supabase: { rpc?: Function }
 *   requestHost: string
 *   expectedTenantId?: string
 *   writeAttempts?: string[]
 *   signal?: AbortSignal
 *   publication?: unknown
 * }} args
 */
export async function loadProductSeoCanonicalContextV1(args) {
  const writeAttempts = Array.isArray(args.writeAttempts) ? args.writeAttempts : []
  const requestHost = asTrimmed(args.requestHost).toLowerCase()
  if (!args.supabase || typeof args.supabase.rpc !== "function") {
    return resolveProductSeoCanonicalContextV1({
      requestHost,
      expectedTenantId: args.expectedTenantId,
      authority: { kind: "unavailable" },
    })
  }
  try {
    const guarded = wrapReadOnlySupabase(args.supabase, writeAttempts)
    const builder = guarded.rpc(READ_ONLY_CANONICAL_RPC, { p_host: requestHost })
    const result = builder && typeof builder.abortSignal === "function"
      ? await builder.abortSignal(args.signal)
      : await builder
    if (result && result.error) {
      return resolveProductSeoCanonicalContextV1({
        requestHost,
        expectedTenantId: args.expectedTenantId,
        authority: { kind: "unavailable" },
      })
    }
    const data = result && result.data
    const row = Array.isArray(data) ? data[0] : data
    return resolveProductSeoCanonicalContextV1({
      requestHost,
      expectedTenantId: args.expectedTenantId,
      authority: { kind: "rpc", row: row ?? null },
      publication: args.publication,
    })
  } catch (err) {
    if (err && typeof err === "object" && err.code === "write_method_blocked") throw err
    return resolveProductSeoCanonicalContextV1({
      requestHost,
      expectedTenantId: args.expectedTenantId,
      authority: { kind: "unavailable" },
    })
  }
}
