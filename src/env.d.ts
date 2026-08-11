/// <reference types="astro/client" />

/**
 * ADR-SEO-001 Phase 6 — request-scoped public context on Astro.locals.
 * Never shared across requests; never used as a global authority cache.
 */
type PublicCanonicalContractLocals = {
  host: string
  origin: string
  requestHost: string
  isPrimaryRequest: boolean
}

type PublicRequestContextLocals = {
  requestHost: string
  deployEnv: string | undefined
  safeMode: boolean
  routeKind: string
  canonical: PublicCanonicalContractLocals | null
  payload: object | null
  tenantId: string | null
  resolutionSource: "payload" | "rpc" | "locals" | "fixture" | "none"
  result:
    | "ok"
    | "missing_primary"
    | "host_not_resolved"
    | "unavailable"
    | "skipped"
  errorCode: string | null
  timings: {
    hostMs: number
    payloadMs: number
    canonicalMs: number
    totalMs: number
  }
  counters: {
    payloadFetches: number
    rpcCalls: number
    hostResolves: number
    canonicalParses: number
  }
  loggedResolution: boolean
}

declare namespace App {
  interface Locals {
    /** Validated Edge/RPC canonical contract for this request host. */
    publicCanonical?: PublicCanonicalContractLocals | null
    publicCanonicalTenantId?: string | null
    /** Validated public-site-payload body (request-scoped reuse). */
    publicSitePayload?: object | null
    /** Host key that `publicSitePayload` was loaded for. */
    publicSitePayloadHost?: string | null
    /** In-flight payload Promise (same request dedupe only). */
    publicSitePayloadPromise?: Promise<unknown>
    /** Orchestrated request context (Phase 6). */
    publicRequestContext?: PublicRequestContextLocals | null
    /** In-flight context Promise (same request dedupe only). */
    publicRequestContextPromise?: Promise<PublicRequestContextLocals>
    runtime?: {
      env?: Record<string, unknown>
    }
  }
}

export {}
