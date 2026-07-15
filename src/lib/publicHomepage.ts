import type { ResolvedHomepage, SerializableHomepageRenderPlan } from "../contracts/homepage"
import {
  buildPublicSitePayloadUrl as buildUrl,
  chooseHomepageRenderer as chooseRenderer,
  resolveRequestHost as resolveHost,
  HostResolutionError,
  normalizeRequestHostname,
} from "./publicHomepageHelpers.js"

export type PublicPayloadIdentity =
  | { kind: "host"; host: string }
  | { kind: "slug"; slug: string }
  | { kind: "tenantId"; tenantId: string }

export type RendererChoice =
  | { mode: "canonical"; plan: SerializableHomepageRenderPlan }
  | { mode: "legacy"; reason: string }
  | { mode: "error"; reason: string }

export type FetchPublicSitePayloadOptions = {
  /** Runtime binding — required on Workers POC (no production default). */
  payloadUrl?: string
  anonKey?: string
}

export { HostResolutionError, normalizeRequestHostname }

export function chooseHomepageRenderer(
  homepage: ResolvedHomepage,
  options?: { allowLegacy?: boolean; forceLegacy?: boolean },
): RendererChoice {
  return chooseRenderer(homepage, options) as RendererChoice
}

export function buildPublicSitePayloadUrl(
  identity: PublicPayloadIdentity,
  mode: "public" | "preview",
  baseUrl: string,
): string {
  return buildUrl(identity, mode, baseUrl)
}

export async function fetchPublicSitePayload(
  identity: PublicPayloadIdentity,
  mode: "public" | "preview",
  options?: FetchPublicSitePayloadOptions,
): Promise<{ ok: true; homepage: ResolvedHomepage } | { ok: false; status: number; body: string }> {
  const baseUrl = options?.payloadUrl
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    return {
      ok: false,
      status: 503,
      body: "PUBLIC_SITE_PAYLOAD_URL missing",
    }
  }

  const anonKey = typeof options?.anonKey === "string" ? options.anonKey : ""
  const url = buildPublicSitePayloadUrl(identity, mode, baseUrl)
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })

  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() }
  }

  try {
    const homepage = (await res.json()) as ResolvedHomepage
    return { ok: true, homepage }
  } catch {
    // Controlled failure — do not surface stack or raw body to callers.
    return { ok: false, status: 502, body: "Invalid payload" }
  }
}

export function resolveRequestHost(request: Request, searchParams: URLSearchParams): string {
  return resolveHost(request, searchParams)
}
