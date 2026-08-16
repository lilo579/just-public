/**
 * ADR-SEO-001 publication contract v1 (Public consumer).
 * Flag default OFF: seven live tenants keep current indexing body.
 */

import { getServerRuntimeString } from "./runtimeEnv.js"

export const PUBLICATION_CONTRACT_VERSION = "v1"
export const PUBLICATION_ENFORCE_FLAG = "SEO001_ENFORCE_PUBLICATION_INDEXING"

/** @typedef {{
 *   contractVersion: string,
 *   present: boolean,
 *   valid: boolean,
 *   indexingEnabled: boolean,
 *   domainState: string,
 *   seoState: string,
 *   canonicalHost: string | null
 * }} PublicPublicationContract */

/** @type {PublicPublicationContract} */
export const MISSING_PUBLICATION = {
  contractVersion: PUBLICATION_CONTRACT_VERSION,
  present: false,
  valid: false,
  indexingEnabled: false,
  domainState: "not_configured",
  seoState: "not_configured",
  canonicalHost: null,
}

/**
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} [locals]
 * @returns {boolean}
 */
export function isPublicationIndexingEnforced(locals) {
  return getServerRuntimeString(locals, PUBLICATION_ENFORCE_FLAG) === "true"
}

/**
 * @param {unknown} raw
 * @returns {PublicPublicationContract}
 */
export function parsePublicationContract(raw) {
  if (!raw || typeof raw !== "object") return { ...MISSING_PUBLICATION }
  const o = /** @type {Record<string, unknown>} */ (raw)
  if (o.contractVersion !== PUBLICATION_CONTRACT_VERSION) {
    return {
      ...MISSING_PUBLICATION,
      contractVersion: typeof o.contractVersion === "string" ? o.contractVersion : "unknown",
      valid: false,
    }
  }
  return {
    contractVersion: PUBLICATION_CONTRACT_VERSION,
    present: o.present === true,
    valid: true,
    indexingEnabled: o.indexingEnabled === true,
    domainState: typeof o.domainState === "string" ? o.domainState : "not_configured",
    seoState: typeof o.seoState === "string" ? o.seoState : "not_configured",
    canonicalHost: typeof o.canonicalHost === "string" && o.canonicalHost ? o.canonicalHost : null,
  }
}

/**
 * @param {{
 *   enforce: boolean,
 *   publication?: PublicPublicationContract | null,
 *   billingStatus?: unknown,
 *   siteMode?: unknown,
 *   exposureAllowed?: unknown
 * }} input
 * @returns {boolean}
 */
export function shouldNoindexFromPublication(input) {
  void input.billingStatus
  void input.siteMode
  void input.exposureAllowed
  if (!input.enforce) return false
  const p = input.publication
  if (!p?.valid) return true
  if (!p.present) return true
  if (p.indexingEnabled !== true) return true
  if (p.seoState !== "seo_validated") return true
  if (p.domainState !== "domain_bound") return true
  return false
}

/**
 * @param {unknown} payloadOrHomepage
 * @returns {PublicPublicationContract}
 */
export function publicationFromPayload(payloadOrHomepage) {
  if (!payloadOrHomepage || typeof payloadOrHomepage !== "object") {
    return { ...MISSING_PUBLICATION }
  }
  const o = /** @type {Record<string, unknown>} */ (payloadOrHomepage)
  return parsePublicationContract(o.publication)
}

/**
 * Publication-dependent robots/sitemap: no-store when enforcement is ON.
 * Flag OFF keeps the prior max-age so the seven live tenants stay identical.
 * @param {boolean} enforce
 * @param {string} [indexableMaxAge]
 */
export function publicationCacheControl(enforce, indexableMaxAge = "public, max-age=300") {
  return enforce ? "no-store" : indexableMaxAge
}
