import assert from "node:assert/strict"
import test from "node:test"

import { FIXTURE_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import { resolvePublicPresentationBinding } from "../src/lib/publicPresentationBinding.js"

test("resolvePublicPresentationBinding: canonical uses plan.presentation (no Family branch in page)", () => {
  const homepage = FIXTURE_ALPHA
  const plan = homepage.serializablePlan
  assert.ok(plan?.presentation)

  const binding = resolvePublicPresentationBinding(homepage, {
    mode: "canonical",
    plan,
  })

  assert.equal(binding.profile, plan.presentation.profile)
  assert.ok(binding.chrome)
})

test("resolvePublicPresentationBinding: legacy path falls back to source meta profile", () => {
  const homepage = {
    source: {
      meta: {
        presentationProfile: "f1.presentation.classic_v1",
      },
    },
  }
  const binding = resolvePublicPresentationBinding(homepage, { mode: "legacy" })
  assert.equal(binding.profile, "f1.presentation.classic_v1")
  assert.equal(binding.chrome.footerSurface, "light")
})
