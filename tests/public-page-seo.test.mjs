import test from "node:test"
import assert from "node:assert/strict"
import {
  buildPublicHomepageSeo,
  extractHeroSeoFields,
  toAbsolutePublicUrl,
} from "../src/lib/publicPageSeo.js"

function primary(host, requestHost = host) {
  return {
    host,
    origin: `https://${host}`,
    requestHost,
    isPrimaryRequest: host === requestHost,
  }
}

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

test("buildPublicHomepageSeo emits production SEO fields from primary", () => {
  const seo = buildPublicHomepageSeo({
    host: "marceloborer.com.br",
    canonical: primary("marceloborer.com.br"),
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
  assert.equal(seo.faviconUrl, "/branding/marcelo-borer/favicon.svg")
  assert.equal(seo.robots, "index, follow")
  assert.equal(seo.jsonLd["@type"], "ProfessionalService")
  assert.equal(seo.twitterCard, "summary_large_image")
})

test("favicon prefers packaged tenant mark over logo for Marcelo/Rossana/Soraya", () => {
  for (const [host, path] of [
    ["www.marceloborer.com.br", "/branding/marcelo-borer/favicon.svg"],
    ["www.rossanamendonca.com.br", "/branding/rossana-mendonca/favicon.svg"],
    ["www.sorayabarbosa.com.br", "/branding/soraya-barbosa/favicon.svg"],
    ["3djewish.com.br", "/branding/3d-jewish/favicon.svg"],
  ]) {
    const seo = buildPublicHomepageSeo({
      host,
      canonical: primary(host),
      companyName: "Tenant",
      branding: {
        logoUrl: "https://cdn.example/logo.png",
        logoHorizontalUrl: "https://cdn.example/logo-h.png",
      },
      seo: { ogImage: "https://cdn.example/social-og.webp" },
    })
    assert.equal(seo.faviconUrl, path, host)
    assert.equal(seo.ogImage, "https://cdn.example/social-og.webp")
  }
})

test("3D Jewish packaged OG used when CMS ogImage unset", () => {
  const seo = buildPublicHomepageSeo({
    host: "3djewish.com.br",
    canonical: primary("3djewish.com.br"),
    companyName: "3D Jewish",
    branding: {},
  })
  assert.equal(seo.faviconUrl, "/branding/3d-jewish/favicon.svg")
  assert.equal(
    seo.ogImage,
    "https://3djewish.com.br/branding/3d-jewish/og-image.jpg",
  )
})

test("JUST packaged OG is absolute on primary origin (D-001)", () => {
  const seo = buildPublicHomepageSeo({
    host: "www.justwebsites.com.br",
    canonical: primary("www.justwebsites.com.br"),
    companyName: "JUST",
    branding: {},
    seo: {
      ogImage: "/branding/just/og-image.jpg",
      favicon: "/branding/just/favicon.svg",
    },
  })
  assert.equal(seo.faviconUrl, "/branding/just/favicon.svg")
  assert.equal(
    seo.ogImage,
    "https://www.justwebsites.com.br/branding/just/og-image.jpg",
  )
  assert.equal(seo.twitterCard, "summary_large_image")
  assert.equal(
    toAbsolutePublicUrl("www.justwebsites.com.br", "/branding/just/og-image.jpg"),
    "https://www.justwebsites.com.br/branding/just/og-image.jpg",
  )
})

test("JUST packaged favicon defaults to SVG mark when Hub SEO unset", () => {
  const seo = buildPublicHomepageSeo({
    host: "www.justwebsites.com.br",
    canonical: primary("www.justwebsites.com.br"),
    companyName: "JUST",
    branding: {},
  })
  assert.equal(seo.faviconUrl, "/branding/just/favicon.svg")
})

test("favicon follows Golden Master: explicit → packaged/ogImage → logos", () => {
  const withOg = buildPublicHomepageSeo({
    host: "celinapiresdorio.com.br",
    canonical: primary("celinapiresdorio.com.br"),
    companyName: "Celina",
    branding: { logoUrl: "https://cdn.example/logo.png" },
    seo: { ogImage: "https://cdn.example/social-og.webp" },
  })
  assert.equal(withOg.faviconUrl, "https://cdn.example/social-og.webp")
  assert.equal(withOg.ogImage, "https://cdn.example/social-og.webp")

  const explicit = buildPublicHomepageSeo({
    host: "celinapiresdorio.com.br",
    canonical: primary("celinapiresdorio.com.br"),
    companyName: "Celina",
    branding: { logoUrl: "https://cdn.example/logo.png" },
    seo: {
      ogImage: "https://cdn.example/social-og.webp",
      favicon: "https://cdn.example/favicon.ico",
    },
  })
  assert.equal(explicit.faviconUrl, "https://cdn.example/favicon.ico")
})
