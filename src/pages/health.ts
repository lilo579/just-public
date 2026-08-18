import type { APIRoute } from "astro"
import {
  PUBLICATION_CONTRACT_VERSION,
  isPublicationIndexingEnforced,
} from "../lib/publicationContract.js"
import { PUBLIC_CANONICAL_CONTRACT_VERSION } from "../lib/publicRequestContext.js"

export const prerender = false

/**
 * Liveness + non-sensitive capability flags.
 * No Supabase, Edge, tenant, or Host dependency / probes.
 * publicationIndexingEnforced reflects the frozen Worker var only.
 */
export const GET: APIRoute = ({ locals }) =>
  new Response(
    JSON.stringify({
      status: "ok",
      service: "just-public",
      canonicalContractVersion: PUBLIC_CANONICAL_CONTRACT_VERSION,
      publicationContractVersion: PUBLICATION_CONTRACT_VERSION,
      publicationIndexingEnforced: isPublicationIndexingEnforced(locals),
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
