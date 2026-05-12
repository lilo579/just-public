import test from "node:test"
import assert from "node:assert/strict"

import {
  adaptCanonicalBenefits,
  getCanonicalBenefitsFallbackWarnings,
  projectBenefitsToFeaturesBlock,
} from "../src/components/canonicalHomepageBenefitsAdapter.js"

test("benefits with title and simple items adapts without partial fallback warnings", () => {
  const block = adaptCanonicalBenefits({
    title: "Beneficios",
    items: [
      { title: "Atendimento rapido", description: "Sem filas" },
      { title: "Equipe dedicada" },
    ],
  })

  assert.deepEqual(block, {
    type: "benefits",
    content: {
      kicker: undefined,
      title: "Beneficios",
      body: undefined,
      items: [
        { title: "Atendimento rapido", description: "Sem filas", imageUrl: undefined },
        { title: "Equipe dedicada", description: undefined, imageUrl: undefined },
      ],
      summary: undefined,
      metrics: [],
    },
  })
  assert.deepEqual(getCanonicalBenefitsFallbackWarnings(block), [])

  assert.deepEqual(projectBenefitsToFeaturesBlock(block), {
    type: "features",
    content: {
      title: "Beneficios",
      items: [
        { title: "Atendimento rapido", description: "Sem filas" },
        { title: "Equipe dedicada", description: undefined },
      ],
    },
  })
})

test("benefits preserves canonical fields and warns when FeaturesBlock is only a partial fallback", () => {
  const block = adaptCanonicalBenefits({
    kicker: "Sem carencia",
    title: "Beneficios completos",
    body: "Cobertura clara",
    items: [
      {
        title: "Rede ampla",
        description: "Hospitais parceiros",
        imageUrl: "https://cdn.example.com/rede.png",
      },
    ],
    summary: "Resumo canonico",
    metrics: [{ label: "Hospitais", value: "120", description: "Na regiao" }],
  })

  assert.deepEqual(block, {
    type: "benefits",
    content: {
      kicker: "Sem carencia",
      title: "Beneficios completos",
      body: "Cobertura clara",
      items: [
        {
          title: "Rede ampla",
          description: "Hospitais parceiros",
          imageUrl: "https://cdn.example.com/rede.png",
        },
      ],
      summary: "Resumo canonico",
      metrics: [{ label: "Hospitais", value: "120", description: "Na regiao" }],
    },
  })

  assert.deepEqual(getCanonicalBenefitsFallbackWarnings(block), [
    "benefits fallback via FeaturesBlock omits visual rendering for: kicker, body, summary, metrics(1), item.imageUrl(1)",
  ])
})

test('componentKey "benefits:default" stays canonically mapped to benefits semantics', () => {
  const componentKey = "benefits:default"
  const [baseKey] = componentKey.split(":")
  const block = adaptCanonicalBenefits({
    title: "Beneficios",
    items: [{ title: "Cobertura" }],
  })

  assert.equal(baseKey, "benefits")
  assert.equal(block.type, "benefits")
  assert.notEqual(block.type, "features")
})
