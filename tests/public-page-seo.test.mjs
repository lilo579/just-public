import test from "node:test"
import assert from "node:assert/strict"
import {
  buildPublicHomepageSeo,
  extractHeroSeoFields,
} from "../src/lib/publicPageSeo.js"

test("extractHeroSeoFields reads hero props from serializable plan", () => {
  const plan = {
    nodes: [
      {
        componentKey: "hero:default",
        props: {
          hero: {
            title: "Título clínico",
            subtitle: "Subtítulo de apoio para meta description.",
          },
        },
      },
    ],
  }
  const hero = extractHeroSeoFields(plan)
  assert.equal(hero?.title, "Título clínico")
  assert.equal(hero?.subtitle, "Subtítulo de apoio para meta description.")
})

test("buildPublicHomepageSeo emits production SEO fields", () => {
  const seo = buildPublicHomepageSeo({
    host: "marceloborer.com.br",
    companyName: "Marcelo Borer",
    branding: {
      logoUrl: "https://cdn.example/logo.png",
    },
    contact: {
      address: "São Paulo",
      whatsappNumber: "5511991331107",
    },
    plan: {
      nodes: [
        {
          componentKey: "hero:default",
          props: {
            hero: {
              title: "Nem tudo que dói por dentro se resolve sozinho.",
              eyebrow: "Atendimento a adolescentes, adultos e casais",
              subtitle: "Atendimento em psicanálise para adolescentes, adultos e casais.",
            },
          },
        },
      ],
    },
    noindex: false,
  })

  assert.match(seo.title, /Marcelo Borer \| Atendimento/)
  assert.match(seo.description, /psicanálise/i)
  assert.equal(seo.canonicalUrl, "https://marceloborer.com.br/")
  assert.equal(seo.ogImage, "https://cdn.example/logo.png")
  assert.equal(seo.faviconUrl, "https://cdn.example/logo.png")
  assert.equal(seo.robots, "index, follow")
  assert.equal(seo.jsonLd["@type"], "ProfessionalService")
  assert.equal(seo.twitterCard, "summary_large_image")
})
