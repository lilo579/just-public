import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MISSING_PUBLICATION,
  isPublicationIndexingEnforced,
  parsePublicationContract,
  publicationCacheControl,
  publicationFromPayload,
  shouldNoindexFromPublication,
} from "../src/lib/publicationContract.js"

describe("publicationContract (Public)", () => {
  it("flag OFF does not change indexing for missing or approved state", () => {
    assert.equal(isPublicationIndexingEnforced({}), false)
    assert.equal(
      shouldNoindexFromPublication({ enforce: false, publication: MISSING_PUBLICATION }),
      false,
    )
    assert.equal(publicationCacheControl(false), "public, max-age=300")
  })

  it("flag ON: missing, unknown version, structural backfill are noindex", () => {
    assert.equal(shouldNoindexFromPublication({ enforce: true, publication: MISSING_PUBLICATION }), true)
    assert.equal(
      shouldNoindexFromPublication({
        enforce: true,
        publication: parsePublicationContract({ contractVersion: "v9", present: true, indexingEnabled: true }),
      }),
      true,
    )
    assert.equal(
      shouldNoindexFromPublication({
        enforce: true,
        publication: parsePublicationContract({
          contractVersion: "v1",
          present: true,
          indexingEnabled: false,
          domainState: "domain_bound",
          seoState: "not_configured",
        }),
      }),
      true,
    )
    assert.equal(publicationCacheControl(true), "no-store")
  })

  it("flag ON: approved v1 remains indexable", () => {
    const seven = parsePublicationContract({
      contractVersion: "v1",
      present: true,
      indexingEnabled: true,
      domainState: "domain_bound",
      seoState: "seo_validated",
      canonicalHost: "rossanamendonca.com.br",
    })
    assert.equal(shouldNoindexFromPublication({ enforce: true, publication: seven }), false)
  })

  it("billing, site.mode, and exposure never enable indexing", () => {
    assert.equal(
      shouldNoindexFromPublication({
        enforce: true,
        publication: MISSING_PUBLICATION,
        billingStatus: "active",
        siteMode: "LIVE",
        exposureAllowed: true,
      }),
      true,
    )
  })

  it("does not invent canonical host from payload slug", () => {
    const parsed = publicationFromPayload({ slug: "acme", publication: null })
    assert.equal(parsed.canonicalHost, null)
    assert.equal(parsed.present, false)
  })
})
