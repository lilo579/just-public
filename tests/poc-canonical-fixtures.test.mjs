import test from "node:test"
import assert from "node:assert/strict"

import {
  FIXTURE_ALPHA,
  FIXTURE_BAD_BRANDING,
  FIXTURE_BETA,
  FIXTURE_NO_PLAN,
  TENANT_ALPHA,
  TENANT_BETA,
} from "./fixtures/poc-canonical-payloads.mjs"
import { themeTokensFromBranding } from "../src/lib/themeFromBranding.js"
import { chooseHomepageRenderer } from "../src/lib/publicHomepageHelpers.js"

test("fixtures are distinct and match SerializableHomepageRenderPlan shape", () => {
  assert.notEqual(FIXTURE_ALPHA.tenantId, FIXTURE_BETA.tenantId)
  assert.notEqual(TENANT_ALPHA.title, TENANT_BETA.title)
  assert.notEqual(TENANT_ALPHA.primaryColor, TENANT_BETA.primaryColor)

  for (const fixture of [FIXTURE_ALPHA, FIXTURE_BETA]) {
    const plan = fixture.serializablePlan
    assert.ok(plan)
    assert.equal(typeof plan.contractVersion, "string")
    assert.ok(Array.isArray(plan.nodes))
    assert.ok(plan.nodes.length >= 1)
    for (const node of plan.nodes) {
      assert.equal(typeof node.componentKey, "string")
      assert.equal(typeof node.order, "number")
      assert.ok(node.runtime)
      assert.ok(node.capabilities)
    }
  }
})

test("chooseHomepageRenderer: plan → canonical; no plan → error (no silent legacy)", () => {
  const alphaChoice = chooseHomepageRenderer(FIXTURE_ALPHA)
  assert.equal(alphaChoice.mode, "canonical")

  const noPlan = chooseHomepageRenderer(FIXTURE_NO_PLAN)
  assert.equal(noPlan.mode, "error")
  assert.equal(noPlan.reason, "canonical_plan_missing")

  const noPlanEvenWithLegacyFlag = chooseHomepageRenderer(FIXTURE_NO_PLAN, {
    allowLegacy: false,
  })
  assert.equal(noPlanEvenWithLegacyFlag.mode, "error")
})

test("theme Alpha differs from Beta; bad branding uses defaults", () => {
  const alpha = themeTokensFromBranding(FIXTURE_ALPHA.source.meta.branding)
  const beta = themeTokensFromBranding(FIXTURE_BETA.source.meta.branding)
  assert.equal(alpha["--site-color-primary"], "#112233")
  assert.equal(beta["--site-color-primary"], "#aa5500")
  assert.notEqual(alpha["--site-color-primary"], beta["--site-color-primary"])

  const bad = themeTokensFromBranding(FIXTURE_BAD_BRANDING.source.meta.branding)
  assert.equal(bad["--site-color-primary"], "#2563eb")
  assert.equal(bad["--site-color-secondary"], "#0f172a")
  assert.doesNotMatch(bad["--site-color-primary"], /javascript|url\(/i)
})
