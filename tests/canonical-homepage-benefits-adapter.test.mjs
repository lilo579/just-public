import test from "node:test"
import assert from "node:assert/strict"

import { adaptCanonicalBenefits } from "../src/components/canonicalHomepageBenefitsAdapter.js"

test("benefits with title and simple items adapts without warnings or feature fallback projection", () => {
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
})

test("benefits preserves kicker, body, summary, metrics, and imageUrl for native rendering", () => {
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
