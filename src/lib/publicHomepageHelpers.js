/**
 * Pure homepage resolution helpers (JS mirror for node:test).
 * Keep in sync with publicHomepage.ts — Astro imports the .ts file.
 */

export function chooseHomepageRenderer(homepage, options) {
  const allowLegacy = options?.allowLegacy === true
  const forceLegacy = options?.forceLegacy === true

  if (forceLegacy && allowLegacy) {
    return { mode: "legacy", reason: "explicit_force_legacy" }
  }

  if (homepage.serializablePlan && Array.isArray(homepage.serializablePlan.nodes)) {
    return { mode: "canonical", plan: homepage.serializablePlan }
  }

  if (allowLegacy && Array.isArray(homepage.blocks) && homepage.blocks.length > 0) {
    return {
      mode: "legacy",
      reason: "canonical_plan_missing_explicit_legacy_fallback",
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

export function resolveRequestHost(request, searchParams) {
  const hostOverride = searchParams.get("host")?.trim()
  const headerHost = request.headers.get("host")?.trim()
  const host = hostOverride || headerHost
  if (!host) {
    throw new Error("Missing Host header")
  }
  return host.split(":")[0]
}
