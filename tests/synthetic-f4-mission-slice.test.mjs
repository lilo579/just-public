import assert from "node:assert/strict"
import test from "node:test"

import { chooseHomepageRenderer } from "../src/lib/publicHomepageHelpers.js"
import { resolvePublicPresentationBinding } from "../src/lib/publicPresentationBinding.js"
import { resolveAllowlistedMissionRoute } from "../src/lib/resolveAllowlistedMissionRoute.js"
import {
  FIXTURE_SYNTHETIC_F4,
  SYNTHETIC_F4_HOST,
  listSyntheticF4PaintComponents,
} from "../src/poc/syntheticF4MissionTenant.js"
import { resolvePocFixturePayload } from "../src/poc/publicSiteFixtures.js"
import { FIXTURE_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"

const F4_COMPONENTS = [
  "hero",
  "about",
  "initiative",
  "progress_track",
  "patronage",
  "recurring_support",
  "history_collection",
  "trust",
  "cta_final",
]

test("synthetic F4 fixture is registered and non-Dorot", () => {
  const fixture = resolvePocFixturePayload(SYNTHETIC_F4_HOST)
  assert.ok(fixture)
  assert.equal(fixture.host, SYNTHETIC_F4_HOST)
  assert.equal(fixture.tenantId, FIXTURE_SYNTHETIC_F4.tenantId)
  const blob = JSON.stringify(fixture)
  assert.doesNotMatch(blob, /dorot|avraham|david|juda/i)
})

test("synthetic F4 painted plan contains F4 paint components", () => {
  const components = listSyntheticF4PaintComponents(FIXTURE_SYNTHETIC_F4.serializablePlan)
  for (const key of F4_COMPONENTS) {
    assert.ok(components.includes(key), `missing paint component ${key}`)
  }
})

test("static F4 works without publications document", () => {
  const choice = chooseHomepageRenderer(FIXTURE_SYNTHETIC_F4)
  assert.equal(choice.mode, "canonical")
  assert.ok(choice.plan?.nodes?.length >= 9)
  assert.equal(
    FIXTURE_SYNTHETIC_F4.serializablePlan.presentation.profile,
    "f4.presentation.mission_v1",
  )
  // No publications field required on the fixture payload.
  assert.equal("publications" in FIXTURE_SYNTHETIC_F4, false)
})

test("F4 presentation binding selects family f4", () => {
  const choice = chooseHomepageRenderer(FIXTURE_SYNTHETIC_F4)
  const binding = resolvePublicPresentationBinding(FIXTURE_SYNTHETIC_F4, choice)
  assert.equal(binding.family, "f4")
})

test("F1 plans still choose canonical renderer", () => {
  const choice = chooseHomepageRenderer(FIXTURE_ALPHA)
  assert.equal(choice.mode, "canonical")
  const binding = resolvePublicPresentationBinding(FIXTURE_ALPHA, choice)
  assert.equal(binding.family, "f1")
})

test("allowlisted content_page and form_signup_shell resolve for synthetic host", () => {
  const privacy = resolveAllowlistedMissionRoute(SYNTHETIC_F4_HOST, "/privacy", "content_page")
  assert.ok(privacy)
  assert.equal(privacy.route.path, "/privacy")

  const form = resolveAllowlistedMissionRoute(
    SYNTHETIC_F4_HOST,
    "/participate",
    "form_signup_shell",
  )
  assert.ok(form)
  assert.equal(form.route.kind, "form_signup_shell")

  assert.equal(
    resolveAllowlistedMissionRoute(SYNTHETIC_F4_HOST, "/secret", "content_page"),
    null,
  )
  assert.equal(resolveAllowlistedMissionRoute("alpha.justwebsites.com.br", "/privacy", "content_page"), null)
})
