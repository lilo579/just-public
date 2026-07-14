import type { ResolvedHomepage, SerializableHomepageRenderPlan } from "../contracts/homepage"
import { PUBLIC_SITE_PAYLOAD_URL, SUPABASE_ANON_KEY } from "../config/publicSite"
import {
  buildPublicSitePayloadUrl as buildUrl,
  chooseHomepageRenderer as chooseRenderer,
  resolveRequestHost as resolveHost,
} from "./publicHomepageHelpers.js"

export type PublicPayloadIdentity =
  | { kind: "host"; host: string }
  | { kind: "slug"; slug: string }
  | { kind: "tenantId"; tenantId: string }

export type RendererChoice =
  | { mode: "canonical"; plan: SerializableHomepageRenderPlan }
  | { mode: "legacy"; reason: string }
  | { mode: "error"; reason: string }

export function chooseHomepageRenderer(
  homepage: ResolvedHomepage,
  options?: { allowLegacy?: boolean; forceLegacy?: boolean },
): RendererChoice {
  return chooseRenderer(homepage, options) as RendererChoice
}

export function buildPublicSitePayloadUrl(
  identity: PublicPayloadIdentity,
  mode: "public" | "preview",
): string {
  return buildUrl(identity, mode, PUBLIC_SITE_PAYLOAD_URL)
}

export async function fetchPublicSitePayload(
  identity: PublicPayloadIdentity,
  mode: "public" | "preview",
): Promise<{ ok: true; homepage: ResolvedHomepage } | { ok: false; status: number; body: string }> {
  const url = buildPublicSitePayloadUrl(identity, mode)
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  })

  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() }
  }

  const homepage = (await res.json()) as ResolvedHomepage
  return { ok: true, homepage }
}

export function resolveRequestHost(request: Request, searchParams: URLSearchParams): string {
  return resolveHost(request, searchParams)
}
