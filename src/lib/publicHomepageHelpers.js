/**
 * Pure homepage resolution helpers for node:test and Astro.
 * Implementation owner: this file. `publicHomepage.ts` re-exports for typed Astro imports.
 *
 * Boundary (Slice 7 — Legacy Kill-Switch):
 * - Canonical plan present → Canonical renderer ONLY.
 * - No plan + legacy blocks → Shop/NoSource legacy runtime (architectural, not a flag).
 * - forceLegacy / allowLegacy / PUBLIC_ALLOW_LEGACY_RENDERER are removed for F1.
 */

export function chooseHomepageRenderer(homepage, options) {
  const forceLegacyRequested = options?.forceLegacy === true
  const hasPlan =
    homepage?.serializablePlan && Array.isArray(homepage.serializablePlan.nodes)
  const hasLegacyBlocks =
    Array.isArray(homepage?.blocks) && homepage.blocks.length > 0

  if (hasPlan) {
    if (forceLegacyRequested) {
      return {
        mode: "error",
        reason: "legacy_forbidden_for_canonical_plan",
      }
    }
    return { mode: "canonical", plan: homepage.serializablePlan }
  }

  // Shop / NoSource — Execution Plan absent; blocks[] is the legitimate runtime.
  if (hasLegacyBlocks) {
    return {
      mode: "legacy",
      reason: "nosource_or_shop_legacy_runtime",
    }
  }

  return {
    mode: "error",
    reason: "canonical_plan_missing",
  }
}

export function buildPublicSitePayloadUrl(identity, mode, baseUrl) {
  if (!baseUrl) throw new Error("baseUrl is required")
  const url = new URL(baseUrl)
  url.searchParams.set("mode", mode)
  if (identity.kind === "host") url.searchParams.set("host", identity.host)
  if (identity.kind === "slug") url.searchParams.set("slug", identity.slug)
  if (identity.kind === "tenantId") url.searchParams.set("tenantId", identity.tenantId)
  return url.toString()
}

/**
 * Normalize a raw host candidate for payload identity.
 * Does not resolve tenants or touch Hub.
 *
 * @param {unknown} raw
 * @returns {{ ok: true, host: string } | { ok: false, reason: string }}
 */
export function normalizeRequestHostname(raw) {
  if (typeof raw !== "string") {
    return { ok: false, reason: "not_string" }
  }
  let host = raw.trim()
  if (!host) {
    return { ok: false, reason: "empty" }
  }
  if (/\s/.test(host)) {
    return { ok: false, reason: "whitespace" }
  }
  // Reject absolute URLs / protocols masquerading as hosts.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(host)) {
    return { ok: false, reason: "has_protocol" }
  }
  if (host.includes("/") || host.includes("?") || host.includes("#")) {
    return { ok: false, reason: "has_path_or_query" }
  }

  // Strip :port (reject ambiguous multi-colon forms).
  if (host.includes(":")) {
    const parts = host.split(":")
    if (parts.length === 2 && /^\d+$/.test(parts[1])) {
      host = parts[0]
    } else {
      return { ok: false, reason: "invalid_port" }
    }
  }

  host = host.toLowerCase()
  while (host.endsWith(".")) {
    host = host.slice(0, -1)
  }
  host = host.trim()
  if (!host) {
    return { ok: false, reason: "empty" }
  }

  const dnsLabel =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/
  if (!dnsLabel.test(host) && !ipv4.test(host)) {
    return { ok: false, reason: "invalid_hostname" }
  }

  return { ok: true, host }
}

/** Local listen addresses — not authoritative tenant hosts → Host header fallback. */
function isNonAuthoritativeHostname(host) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "::1"
  )
}

export class HostResolutionError extends Error {
  /**
   * @param {string} reason
   */
  constructor(reason) {
    super(`Invalid or missing host (${reason})`)
    this.name = "HostResolutionError"
    this.reason = reason
  }
}

/**
 * Precedence (POC-001 Slice 3 / Workers):
 * 1. ?host= — explicit local/preview simulation only
 * 2. new URL(request.url).hostname — canonical on Workers Runtime
 * 3. Host header — defensive fallback when URL hostname is missing,
 *    invalid, or a local listen address (127.0.0.1 / localhost)
 *
 * Never trust X-Forwarded-Host / Forwarded.
 *
 * @param {Request} request
 * @param {URLSearchParams} searchParams
 * @returns {string}
 */
export function resolveRequestHost(request, searchParams) {
  if (searchParams.has("host")) {
    const normalized = normalizeRequestHostname(searchParams.get("host") ?? "")
    if (!normalized.ok) {
      throw new HostResolutionError(normalized.reason)
    }
    return normalized.host
  }

  let urlHostname = ""
  try {
    urlHostname = new URL(request.url).hostname
  } catch {
    urlHostname = ""
  }

  const fromUrl = normalizeRequestHostname(urlHostname)
  if (fromUrl.ok && !isNonAuthoritativeHostname(fromUrl.host)) {
    return fromUrl.host
  }

  const headerRaw = request.headers.get("host")
  if (headerRaw != null && headerRaw !== "") {
    const fromHeader = normalizeRequestHostname(headerRaw)
    if (fromHeader.ok) {
      return fromHeader.host
    }
    throw new HostResolutionError(fromHeader.reason)
  }

  if (fromUrl.ok) {
    // Authoritative only when no Host header (e.g. loopback local without override).
    return fromUrl.host
  }

  throw new HostResolutionError(fromUrl.ok ? "missing_host" : fromUrl.reason || "missing_host")
}
