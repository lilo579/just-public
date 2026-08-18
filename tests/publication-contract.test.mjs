import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MISSING_PUBLICATION,
  PUBLICATION_CONTRACT_VERSION,
  PUBLICATION_ENFORCE_FLAG,
  isPublicationIndexingEnforced,
  parsePublicationContract,
  publicationCacheControl,
  publicationFromPayload,
  shouldNoindexFromPublication,
} from "../src/lib/publicationContract.js"

const SEVEN_APPROVED_HOSTS = [
  "justwebsites.com.br",
  "marceloborer.com.br",
  "rossanamendonca.com.br",
  "sorayabarbosa.com.br",
  "treinecomflaviohenrique.com.br",
  "3djewish.com.br",
  "celinapiresdorio.com.br",
]

/** @param {string} host */
function approvedPublication(host) {
  return parsePublicationContract({
    contractVersion: "v1",
    present: true,
    indexingEnabled: true,
    domainState: "domain_bound",
    seoState: "seo_validated",
    canonicalHost: host,
  })
}

describe("publicationContract (Public)", () => {
  it("flag OFF does not change indexing for missing or approved state", () => {
    assert.equal(isPublicationIndexingEnforced({}), false)
    assert.equal(isPublicationIndexingEnforced({ runtime: { env: {} } }), false)
    assert.equal(
      isPublicationIndexingEnforced({
        runtime: { env: { [PUBLICATION_ENFORCE_FLAG]: "TRUE" } },
      }),
      false,
    )
    assert.equal(
      shouldNoindexFromPublication({ enforce: false, publication: MISSING_PUBLICATION }),
      false,
    )
    assert.equal(publicationCacheControl(false), "public, max-age=300")
  })

  it("flag ON only when Worker var is the exact string true", () => {
    assert.equal(
      isPublicationIndexingEnforced({
        runtime: { env: { [PUBLICATION_ENFORCE_FLAG]: "true" } },
      }),
      true,
    )
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

  it("flag ON: seven approved v1 hosts remain indexable", () => {
    for (const host of SEVEN_APPROVED_HOSTS) {
      const seven = approvedPublication(host)
      assert.equal(seven.contractVersion, PUBLICATION_CONTRACT_VERSION)
      assert.equal(shouldNoindexFromPublication({ enforce: true, publication: seven }), false)
    }
  })

  it("flag ON: unapproved publication fixtures are noindex", () => {
    const cases = [
      ["absent payload", publicationFromPayload(null)],
      [
        "not_configured",
        parsePublicationContract({
          contractVersion: "v1",
          present: false,
          indexingEnabled: false,
          domainState: "not_configured",
          seoState: "not_configured",
          canonicalHost: null,
        }),
      ],
      [
        "seo_validated indexing false",
        parsePublicationContract({
          contractVersion: "v1",
          present: true,
          indexingEnabled: false,
          domainState: "domain_bound",
          seoState: "seo_validated",
          canonicalHost: "example.com.br",
        }),
      ],
      [
        "suspended",
        parsePublicationContract({
          contractVersion: "v1",
          present: true,
          indexingEnabled: false,
          domainState: "suspended",
          seoState: "suspended",
          canonicalHost: "example.com.br",
        }),
      ],
      [
        "inactive tenant stamp",
        parsePublicationContract({
          contractVersion: "v1",
          present: true,
          indexingEnabled: false,
          domainState: "domain_bound",
          seoState: "seo_validated",
          canonicalHost: "example.com.br",
        }),
      ],
      [
        "site module off stamp",
        parsePublicationContract({
          contractVersion: "v1",
          present: true,
          indexingEnabled: false,
          domainState: "not_configured",
          seoState: "not_configured",
          canonicalHost: null,
        }),
      ],
      [
        "unknown contract",
        parsePublicationContract({
          contractVersion: "unknown",
          present: true,
          indexingEnabled: true,
          domainState: "domain_bound",
          seoState: "seo_validated",
        }),
      ],
      ["invalid body", parsePublicationContract("not-an-object")],
    ]
    for (const [label, publication] of cases) {
      assert.equal(
        shouldNoindexFromPublication({ enforce: true, publication }),
        true,
        label,
      )
    }
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
    assert.equal(
      shouldNoindexFromPublication({
        enforce: true,
        publication: approvedPublication("justwebsites.com.br"),
        billingStatus: "suspended",
        siteMode: "COMING_SOON",
        exposureAllowed: false,
      }),
      false,
    )
  })

  it("does not invent canonical host from payload slug or another tenant", () => {
    const parsed = publicationFromPayload({ slug: "acme", publication: null })
    assert.equal(parsed.canonicalHost, null)
    assert.equal(parsed.present, false)
    const flavio = publicationFromPayload({
      slug: "flavio-personal",
      publication: approvedPublication("treinecomflaviohenrique.com.br"),
    })
    const celina = publicationFromPayload({
      slug: "celina-pires",
      publication: approvedPublication("celinapiresdorio.com.br"),
    })
    assert.equal(flavio.canonicalHost, "treinecomflaviohenrique.com.br")
    assert.equal(celina.canonicalHost, "celinapiresdorio.com.br")
    assert.notEqual(flavio.canonicalHost, celina.canonicalHost)
  })
})
