import test from "node:test"
import assert from "node:assert/strict"

import { isPocFixtureMode } from "../src/lib/runtimeEnv.js"
import {
  TENANT_ALPHA,
  TENANT_BETA,
  TENANT_GAMMA,
  resolvePocFixturePayload,
} from "../src/poc/publicSiteFixtures.js"

function locals(env) {
  return { runtime: { env } }
}

test("isPocFixtureMode: dual gate only (preview + exact true)", () => {
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "preview", POC_FIXTURE_MODE: "true" })), true)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "PREVIEW", POC_FIXTURE_MODE: "true" })), true)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "preview", POC_FIXTURE_MODE: " true " })), true)

  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "production", POC_FIXTURE_MODE: "true" })), false)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "staging", POC_FIXTURE_MODE: "true" })), false)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "unknown", POC_FIXTURE_MODE: "true" })), false)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "preview", POC_FIXTURE_MODE: "false" })), false)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "preview", POC_FIXTURE_MODE: "1" })), false)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "preview", POC_FIXTURE_MODE: "yes" })), false)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "preview", POC_FIXTURE_MODE: "on" })), false)
  assert.equal(isPocFixtureMode(locals({ DEPLOY_ENV: "preview" })), false)
  assert.equal(isPocFixtureMode(locals({ POC_FIXTURE_MODE: "true" })), false)
  assert.equal(isPocFixtureMode(locals({})), false)
  assert.equal(isPocFixtureMode(undefined), false)
})

test("resolvePocFixturePayload: Alpha/Beta/Gamma distinct clones; unknown null", () => {
  const a = resolvePocFixturePayload(TENANT_ALPHA.host)
  const b = resolvePocFixturePayload(TENANT_BETA.host)
  const g = resolvePocFixturePayload(TENANT_GAMMA.host)
  assert.ok(a && b && g)
  assert.equal(a.source.contact.companyName, "Alpha Consulting")
  assert.equal(b.source.contact.companyName, "Beta Studio")
  assert.equal(g.source.contact.companyName, "Gamma Labs")
  assert.equal(a.source.meta.branding.primaryColor, "#112233")
  assert.equal(b.source.meta.branding.primaryColor, "#aa5500")
  assert.equal(g.source.meta.branding.primaryColor, "#008866")
  assert.notEqual(a.tenantId, b.tenantId)
  assert.ok(a.serializablePlan?.nodes?.length > 0)

  a.source.contact.companyName = "mutated"
  const a2 = resolvePocFixturePayload(TENANT_ALPHA.host)
  assert.equal(a2.source.contact.companyName, "Alpha Consulting")

  assert.equal(resolvePocFixturePayload("unknown.justwebsites.com.br"), null)
  assert.equal(resolvePocFixturePayload(""), null)
})
