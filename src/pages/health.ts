import type { APIRoute } from "astro"
import { PUBLIC_CANONICAL_CONTRACT_VERSION } from "../lib/publicRequestContext.js"

export const prerender = false

/**
 * Liveness + non-sensitive capability flags.
 * No Supabase, Edge, tenant, or Host dependency / probes.
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      status: "ok",
      service: "just-public",
      canonicalContractVersion: PUBLIC_CANONICAL_CONTRACT_VERSION,
      features: {
        canonicalRedirects: true,
        requestScopedAuthority: true,
        sharedAuthorityCache: false,
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  )
