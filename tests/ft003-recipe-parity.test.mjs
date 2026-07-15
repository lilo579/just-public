import test from "node:test"
import assert from "node:assert/strict"

import { adaptCanonicalHero } from "../src/components/canonicalHomepageHeroAdapter.js"
import { adaptCanonicalTrust } from "../src/components/canonicalHomepageTrustAdapter.js"
import { adaptCanonicalTestimonials } from "../src/components/canonicalHomepageTestimonialsAdapter.js"

const RECIPE_COMPONENT_KEYS = [
  "hero",
  "trust",
  "problem",
  "about",
  "services",
  "benefits",
  "process",
  "attendance",
  "testimonials",
  "cta_final",
]

const professionalPlan = {
  contractVersion: "homepage-render-contract/v1",
  recipe: { id: "default_homepage_recipe", version: "homepage_recipe_v1", blocks: [] },
  instances: [],
  nodes: [
    {
      id: "hero",
      variant: "default",
      order: 10,
      componentKey: "hero:default",
      props: {
        hero: {
          eyebrow: "Advogada trabalhista",
          title: "Defesa clara para o trabalhador",
          subtitle: "Orientacao objetiva.",
          highlight: null,
          primaryCtaLabel: "Falar no WhatsApp",
          metrics: [],
        },
        contact: { whatsappNumber: "5511999000011", whatsappVisible: true },
      },
    },
    {
      id: "trust",
      variant: "default",
      order: 20,
      componentKey: "trust:default",
      props: {
        trust: {
          title: null,
          items: ["+10 anos", "Atendimento humanizado"],
          logos: [],
        },
      },
    },
    {
      id: "testimonials",
      variant: "default",
      order: 80,
      componentKey: "testimonials:default",
      props: {
        testimonials: {
          title: "Depoimentos",
          subtitle: null,
          items: [],
          images: [{ url: "https://cdn.example.test/pro/social-1.jpg", alt: "Cliente A" }],
        },
      },
    },
  ],
}

const b2bPlan = {
  contractVersion: "homepage-render-contract/v1",
  recipe: { id: "default_homepage_recipe", version: "homepage_recipe_v1", blocks: [] },
  instances: [],
  nodes: [
    {
      id: "hero",
      variant: "default",
      order: 10,
      componentKey: "hero:default",
      props: {
        hero: {
          eyebrow: "Saude ocupacional B2B",
          title: "Menos afastamentos.\nMais produtividade.",
          subtitle: "Programas sob medida.",
          highlight: "Resultados mediveis.",
          primaryCtaLabel: "Agendar diagnostico",
          metrics: [
            { label: "Reducao media", value: "32%", description: "Em afastamentos." },
            { label: "Tempo de ativacao", value: "14 dias", description: "Go-live." },
          ],
        },
        contact: { whatsappNumber: "5511988000022", whatsappVisible: true },
      },
    },
    {
      id: "trust",
      variant: "default",
      order: 20,
      componentKey: "trust:default",
      props: {
        trust: {
          title: "Empresas que confiam",
          items: [],
          logos: [
            {
              name: "Acme Industria",
              imageUrl: "https://cdn.example.test/b2b/logo-acme.svg",
              alt: "Logo Acme",
            },
            { name: "Atlas Log", imageUrl: null, alt: null },
          ],
        },
      },
    },
    {
      id: "testimonials",
      variant: "default",
      order: 80,
      componentKey: "testimonials:default",
      props: {
        testimonials: {
          title: "Prova social",
          subtitle: "Casos recentes.",
          items: [
            {
              company: "Acme Industria",
              tag: "Manufatura",
              quote: "Reduzimos afastamentos.",
              result: "-28% em 9 meses",
            },
          ],
          images: [],
        },
      },
    },
  ],
}

test("FT-003 hero adapter preserves B2B metrics and highlight", () => {
  const block = adaptCanonicalHero(b2bPlan.nodes[0].props)
  assert.equal(block.content.highlight, "Resultados mediveis.")
  assert.equal(block.content.metrics.length, 2)
  assert.deepEqual(block.content.metrics[0], {
    label: "Reducao media",
    value: "32%",
    description: "Em afastamentos.",
  })
  assert.equal(block.primaryCTA?.type, "whatsapp")
})

test("FT-003 trust adapter preserves title and logos", () => {
  const block = adaptCanonicalTrust(b2bPlan.nodes[1].props)
  assert.equal(block.content.title, "Empresas que confiam")
  assert.equal(block.content.logos.length, 2)
  assert.equal(block.content.logos[0].imageUrl, "https://cdn.example.test/b2b/logo-acme.svg")
  assert.equal(block.content.logos[1].name, "Atlas Log")
  assert.equal(block.content.hasContent, true)
})

test("FT-003 testimonials adapter preserves B2B items and subtitle", () => {
  const block = adaptCanonicalTestimonials(b2bPlan.nodes[2].props)
  assert.equal(block.content.title, "Prova social")
  assert.equal(block.content.subtitle, "Casos recentes.")
  assert.equal(block.content.items.length, 1)
  assert.equal(block.content.items[0].company, "Acme Industria")
  assert.equal(block.content.images.length, 0)
})

test("FT-003 professional trust/items and testimonials/images remain intact", () => {
  const trust = adaptCanonicalTrust(professionalPlan.nodes[1].props)
  const testimonials = adaptCanonicalTestimonials(professionalPlan.nodes[2].props)
  assert.deepEqual(trust.content.items, ["+10 anos", "Atendimento humanizado"])
  assert.equal(testimonials.content.images.length, 1)
})

test("FT-003 default recipe has zero unknown componentKeys for fixture nodes", () => {
  for (const plan of [professionalPlan, b2bPlan]) {
    for (const node of plan.nodes) {
      const [base] = node.componentKey.split(":")
      assert.ok(RECIPE_COMPONENT_KEYS.includes(base), `unknown key ${node.componentKey}`)
    }
  }
})

test("FT-003 adapters stay props-driven (no tenant branching)", async () => {
  const files = [
    "../src/components/canonicalHomepageHeroAdapter.js",
    "../src/components/canonicalHomepageTrustAdapter.js",
    "../src/components/canonicalHomepageTestimonialsAdapter.js",
  ]
  const { readFile } = await import("node:fs/promises")
  const { fileURLToPath } = await import("node:url")
  const { dirname, join } = await import("node:path")
  const here = dirname(fileURLToPath(import.meta.url))
  for (const relative of files) {
    const source = await readFile(join(here, relative), "utf8")
    assert.doesNotMatch(source, /\btenantId\b|\bsiteType\b|\bif\s*\(\s*contract\b/)
  }
})
