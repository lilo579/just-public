import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { enrichPlanPaintWithPresentationChrome } from "../src/lib/enrichPlanPaintWithPresentationChrome.js"
import { resolvePublicPresentationBinding } from "../src/lib/publicPresentationBinding.js"
import { resolveCinematicEditorialPolicy } from "../src/lib/resolveCinematicEditorialPolicy.js"
import {
  CELINA_FACTORY_POISON,
  CELINA_HUB_EDITORIAL,
  CELINA_MARKERS,
  FIXTURE_CELINA,
  FIXTURE_CELINA_LEGACY,
  FIXTURE_CELINA_LEGACY_WITH_SEED,
  FIXTURE_CELINA_V1_NO_SEED,
  FIXTURE_FLAVIO,
  FIXTURE_FLAVIO_LEGACY,
  FIXTURE_NEXO,
  FIXTURE_NEXO_LEGACY,
  FIXTURE_UNKNOWN_VERSION,
  FLAVIO_EDITORIAL,
  FLAVIO_MARKERS,
} from "./fixtures/cinematic-editorial-payloads.mjs"

const seedJson = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/celina-hub-editorial.v1.json"),
    "utf8",
  ),
)

function paintJson(plan) {
  return JSON.stringify(plan.nodes.map((node) => node.paint?.block?.content))
}

function bind(fixture) {
  return resolvePublicPresentationBinding(fixture, {
    mode: "canonical",
    plan: fixture.serializablePlan,
  })
}

test("marker absent keeps legacy plan chrome (compatible Public + old Edge)", () => {
  const flavio = bind(FIXTURE_FLAVIO_LEGACY)
  const celina = bind(FIXTURE_CELINA_LEGACY)
  const seededButLegacyEdge = bind(FIXTURE_CELINA_LEGACY_WITH_SEED)
  const nexo = bind(FIXTURE_NEXO_LEGACY)

  assert.equal(resolveCinematicEditorialPolicy(FIXTURE_FLAVIO_LEGACY.source.meta, FIXTURE_FLAVIO_LEGACY.serializablePlan.presentation.chrome).mode, "legacy-temporary")
  assert.equal(flavio.chrome.cinematicEditorial.heroImageUrl, "/presentation/cinematic_v1/hero.jpg")
  assert.match(JSON.stringify(flavio.chrome.cinematicEditorial), /criança/)
  assert.equal(celina.chrome.cinematicEditorial.headerCtaLabel, "Fale comigo")
  assert.equal(
    seededButLegacyEdge.chrome.cinematicEditorial.heroImageUrl,
    "/presentation/cinematic_v1/hero.jpg",
    "old Edge ignores Hub seed; visual stays factory blob",
  )
  assert.equal(nexo.chrome.cinematicEditorial.heroImageUrl, "/presentation/cinematic_v1/hero.jpg")
  assert.equal(
    flavio.chrome,
    FIXTURE_FLAVIO_LEGACY.serializablePlan.presentation.chrome,
    "legacy fallback must be the plan chrome object, not a reconstructed copy",
  )
})

test("legacy-temporary returns partial planChrome without filling cinematic flags", () => {
  const partialChrome = {
    cinematicEditorial: {
      heroImageUrl: "/presentation/cinematic_v1/hero.jpg",
      headerCtaLabel: "Fale comigo",
    },
  }
  const homepage = {
    source: {
      meta: {
        presentationProfile: "f1.presentation.cinematic_v1",
      },
    },
    serializablePlan: {
      presentation: {
        profile: "f1.presentation.cinematic_v1",
        chrome: partialChrome,
      },
    },
  }
  const bound = bind(homepage)
  assert.equal(
    resolveCinematicEditorialPolicy(homepage.source.meta, partialChrome).mode,
    "legacy-temporary",
  )
  assert.equal(bound.chrome, partialChrome)
  assert.deepEqual(Object.keys(bound.chrome), ["cinematicEditorial"])
  assert.equal(bound.chrome.headerOverHero, undefined)
  assert.equal(bound.chrome.heroLayout, undefined)
  assert.equal(bound.chrome.trustOverlapsHero, undefined)
  assert.equal(bound.chrome.profile, undefined)
  assert.equal(bound.chrome.cinematicEditorial.heroImageUrl, "/presentation/cinematic_v1/hero.jpg")
})

test("v1 + object ignores the global plan blob completely", () => {
  const flavio = bind(FIXTURE_FLAVIO)
  const celina = bind(FIXTURE_CELINA)
  assert.equal(flavio.chrome.cinematicEditorial.composition, "pt_trainer")
  assert.doesNotMatch(JSON.stringify(flavio.chrome.cinematicEditorial), /criança|clínica|40\+/)
  assert.notEqual(flavio.chrome.cinematicEditorial, FIXTURE_FLAVIO.serializablePlan.presentation.chrome.cinematicEditorial)
  assert.equal(celina.chrome.cinematicEditorial.headerCtaLabel, "Fale comigo")
  assert.match(JSON.stringify(celina.chrome.cinematicEditorial), /criança/)
  assert.doesNotMatch(JSON.stringify(celina.chrome.cinematicEditorial), /pt_trainer|Quero treinar/)
})

test("v1 + null strips the global blob and invents nothing", () => {
  const nexo = bind(FIXTURE_NEXO)
  const celinaNoSeed = bind(FIXTURE_CELINA_V1_NO_SEED)
  assert.equal(nexo.chrome.cinematicEditorial, null)
  assert.equal(celinaNoSeed.chrome.cinematicEditorial, null)
  assert.doesNotMatch(JSON.stringify(nexo.chrome), /criança|pt_trainer|Quero treinar|hero\.jpg/)
  assert.doesNotMatch(JSON.stringify(celinaNoSeed.chrome), /criança|40\+|hero\.jpg/)
})

test("unknown contract version fails closed and never mixes with legacy blob", () => {
  const unknown = bind(FIXTURE_UNKNOWN_VERSION)
  const policy = resolveCinematicEditorialPolicy(
    FIXTURE_UNKNOWN_VERSION.source.meta,
    FIXTURE_UNKNOWN_VERSION.serializablePlan.presentation.chrome,
  )
  assert.equal(policy.mode, "fail-closed")
  assert.equal(unknown.chrome.cinematicEditorial, null)
  assert.doesNotMatch(JSON.stringify(unknown.chrome), /criança|Fale comigo|hero\.jpg/)
})

test("v1 never merges partial legacy fields into Hub editorial", () => {
  const mixed = {
    ...FIXTURE_FLAVIO,
    source: {
      ...FIXTURE_FLAVIO.source,
      meta: {
        ...FIXTURE_FLAVIO.source.meta,
        cinematicEditorialContractVersion: "v1",
        cinematicEditorial: { composition: "pt_trainer", headerCtaLabel: "Quero treinar com método" },
      },
    },
  }
  const chrome = bind(mixed).chrome.cinematicEditorial
  assert.equal(chrome.composition, "pt_trainer")
  assert.equal(chrome.headerCtaLabel, "Quero treinar com método")
  assert.equal(chrome.heroImageUrl, undefined)
  assert.doesNotMatch(JSON.stringify(chrome), /criança|hero\.jpg|40\+/)
})

test("rollback v1 → legacy Edge restores factory chrome via absent marker", () => {
  const v1 = bind(FIXTURE_FLAVIO)
  const rolled = bind(FIXTURE_FLAVIO_LEGACY)
  assert.equal(v1.chrome.cinematicEditorial.composition, "pt_trainer")
  assert.match(JSON.stringify(rolled.chrome.cinematicEditorial), /criança/)
})

test("binding order does not leak editorial in v1", () => {
  const first = bind(FIXTURE_FLAVIO)
  const second = bind(FIXTURE_CELINA)
  const third = bind(FIXTURE_FLAVIO)
  assert.equal(first.chrome.cinematicEditorial.composition, third.chrome.cinematicEditorial.composition)
  assert.equal(second.chrome.cinematicEditorial.headerCtaLabel, "Fale comigo")
  assert.equal(third.chrome.cinematicEditorial.composition, "pt_trainer")
})

test("enrich v1 fills only this tenant and does not invent trainer assets", () => {
  const flavioPlan = enrichPlanPaintWithPresentationChrome(
    FIXTURE_FLAVIO.serializablePlan,
    bind(FIXTURE_FLAVIO).chrome,
  )
  const nexoPlan = enrichPlanPaintWithPresentationChrome(
    FIXTURE_NEXO.serializablePlan,
    bind(FIXTURE_NEXO).chrome,
  )
  const flavioText = paintJson(flavioPlan)
  const nexoText = paintJson(nexoPlan)

  assert.match(flavioText, /proof-02\.jpeg/)
  for (const marker of CELINA_MARKERS) {
    assert.doesNotMatch(flavioText, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.doesNotMatch(flavioText, /benefits-\d\d\.jpeg/)
  for (const marker of [...CELINA_MARKERS, ...FLAVIO_MARKERS]) {
    assert.doesNotMatch(nexoText, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.equal(FIXTURE_FLAVIO.serializablePlan.nodes[0].paint.block.content.imageUrl, undefined)
})

test("Celina v1 seed fixture matches Hub JSON (sanitized)", () => {
  assert.equal(seedJson.heroImageUrl, "/presentation/cinematic_v1/hero.jpg")
  assert.equal(seedJson.aboutStats[0].value, "40+")
  assert.match(seedJson.problemPullQuote, /criança/)
  assert.doesNotMatch(JSON.stringify(seedJson), /pt_trainer|Quero treinar|flavio/i)
  assert.equal(CELINA_HUB_EDITORIAL.headerCtaLabel, seedJson.headerCtaLabel)
})

test("frozen fixtures reject mutation", () => {
  assert.throws(() => {
    FLAVIO_EDITORIAL.composition = "editorial"
  })
  assert.throws(() => {
    CELINA_HUB_EDITORIAL.headerCtaLabel = "x"
  })
  assert.throws(() => {
    CELINA_FACTORY_POISON.heroImageUrl = "/x"
  })
})
