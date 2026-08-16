/**
 * P0 cinematic editorial isolation fixtures.
 * Sanitized fingerprints only. Deep-frozen. No shared mutable objects.
 */

function freezeDeep(value) {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      for (const item of value) freezeDeep(item)
    } else {
      for (const nested of Object.values(value)) freezeDeep(nested)
    }
    Object.freeze(value)
  }
  return value
}

export const CELINA_FACTORY_POISON = freezeDeep({
  composition: "editorial",
  atmosphere: "editorial",
  typography: "editorial",
  heroImageUrl: "/presentation/cinematic_v1/hero.jpg",
  processImageUrl: "/presentation/cinematic_v1/process.jpg",
  principlesImageUrl: "/presentation/cinematic_v1/principles.jpg",
  problemKicker: "O desafio",
  problemPullQuote:
    "Quando a criança é compreendida, o desenvolvimento encontra espaço para acontecer.",
  situationsKicker: "Sinais de atenção",
  processKicker: "Como acontece o acompanhamento",
  processSupport: "Cada criança tem uma história única.",
  aboutStats: [
    { value: "40+", label: "Anos de experiência clínica" },
    { value: "Inúmeras", label: "Famílias e crianças acompanhadas" },
  ],
  processSupplementalSteps: [
    {
      title: "Parceria com a família",
      description: "A família recebe orientação e participa ativamente do processo.",
    },
  ],
  ctaMicrocopy: "Atendimento humanizado e individualizado",
  closingPullQuote:
    "O objetivo não é acelerar a criança, mas construir caminhos possíveis para que ela avance com segurança.",
  headerCtaLabel: "Fale comigo",
  navItems: [{ label: "Para quem é", href: "#para-quem" }],
})

export const FLAVIO_EDITORIAL = freezeDeep({
  composition: "pt_trainer",
  atmosphere: "pt_dark",
  typography: "satoshi",
  heroImageUrl: "/presentation/cinematic_v1/pt/proof-02.jpeg",
  processImageUrl: "/presentation/cinematic_v1/pt/proof-01.jpeg",
  heroVideoUrl: "https://cdn.example.test/flavio/hero.mp4",
  suppressProblem: true,
  suppressServices: true,
  situationsSupport: "O corpo não responde igual em todo movimento. Seu treino também não deveria.",
  processKicker: "Método",
  processSupport: "O corpo não responde igual em todo movimento. Seu treino também não deveria.",
  headerCtaLabel: "Quero treinar com método",
  navItems: [
    { label: "Serviços", href: "#metodo" },
    { label: "Benefícios", href: "#beneficios" },
  ],
  manifestoGhost: ["INTENSIDADE", "SEM MÉTODO", "DESGASTA."],
  manifestoStatement: ["MÉTODO", "BEM APLICADO", "TRANSFORMA."],
  testimonialsSubtitle: "Quando o treino respeita o seu corpo, o resultado aparece.",
  sectionIds: {
    method: "metodo",
    benefits: "beneficios",
    proof: "resultados",
    testimonials: "depoimentos",
    manifesto: "manifesto-final",
  },
})

export const CELINA_HUB_EDITORIAL = freezeDeep({
  composition: "editorial",
  atmosphere: "editorial",
  typography: "editorial",
  heroImageUrl: "/presentation/cinematic_v1/hero.jpg",
  problemPullQuote:
    "Quando a criança é compreendida, o desenvolvimento encontra espaço para acontecer.",
  aboutStats: [{ value: "40+", label: "Anos de experiência clínica" }],
  headerCtaLabel: "Fale comigo",
  processSupport: "Cada criança tem uma história única.",
  closingPullQuote:
    "O objetivo não é acelerar a criança, mas construir caminhos possíveis para que ela avance com segurança.",
})

export const TENANT_FLAVIO = freezeDeep({
  key: "flavio",
  tenantId: "99f35036-71a3-43a9-8e5e-8984ab31e81d",
  host: "treinecomflaviohenrique.com.br",
  wwwHost: "www.treinecomflaviohenrique.com.br",
  companyName: "Flávio Henrique",
  title: "Treino com método",
  email: "flavio-fixture@example.test",
  phone: "5511999900101",
  primaryColor: "#1a1a1a",
  secondaryColor: "#f5f5f5",
})

export const TENANT_CELINA = freezeDeep({
  key: "celina",
  tenantId: "b7c2d3c1-a096-4ae9-a5b1-2d3548211823",
  host: "celina-pires.com.br",
  wwwHost: "www.celina-pires.com.br",
  companyName: "Celina Pires",
  title: "Desenvolvimento infantil com escuta",
  email: "celina-fixture@example.test",
  phone: "5511999900102",
  primaryColor: "#4a6670",
  secondaryColor: "#e8eef0",
})

export const TENANT_NEXO = freezeDeep({
  key: "nexo",
  tenantId: "00000000-0000-4000-8000-cinematic0003",
  host: "nexo-visual.example.test",
  wwwHost: "www.nexo-visual.example.test",
  companyName: "Nexo Visual",
  title: "Nexo Visual homepage",
  email: "nexo-fixture@example.test",
  phone: "5511999900103",
  primaryColor: "#203040",
  secondaryColor: "#d0d8e0",
})

export const CINEMATIC_TENANTS = [TENANT_FLAVIO, TENANT_CELINA, TENANT_NEXO]

export const CELINA_MARKERS = freezeDeep([
  "criança",
  "clínica",
  "40+",
  "/presentation/cinematic_v1/hero.jpg",
  "Quando a criança é compreendida",
  "Anos de experiência clínica",
  "Fale comigo",
])

export const FLAVIO_MARKERS = freezeDeep([
  "Quero treinar com método",
  "/presentation/cinematic_v1/pt/proof-02.jpeg",
  "pt_trainer",
  "INTENSIDADE",
  "Treino com método",
])

function cinematicChrome(poisoned) {
  return freezeDeep({
    profile: "f1.presentation.cinematic_v1",
    trustOverlapsHero: false,
    benefitsAsFeatureCards: true,
    benefitsLayout: "cinematic-principles",
    servicesLayout: "cinematic-signs",
    heroLayout: "cinematic",
    problemLayout: "cinematic-editorial",
    aboutLayout: "cinematic-authority",
    processLayout: "cinematic-journey",
    ctaLayout: "cinematic-band",
    headerOverHero: true,
    headerLogoSource: "brand",
    footerSurface: "light",
    cinematicEditorial: poisoned ? CELINA_FACTORY_POISON : null,
  })
}

function node(id, order, component, content) {
  return freezeDeep({
    id,
    variant: "default",
    order,
    componentKey: `${component}:default`,
    runtime: { key: id, analyticsId: id, hydration: "none", lazy: false, ssr: true, priority: "normal" },
    capabilities: { supportsSSR: true },
    props: {},
    paint: {
      component,
      block: { type: component === "cta_final" ? "cta" : component, content },
      layout: {},
    },
  })
}

function buildPayload(tenant, editorial, options = {}) {
  const contractVersion =
    options.contractVersion === undefined ? "v1" : options.contractVersion
  const contact = {
    companyName: tenant.companyName,
    email: tenant.email,
    whatsappNumber: tenant.phone,
    whatsappVisible: true,
  }
  const nodes = [
    node(`${tenant.key}-hero`, 10, "hero", {
      title: tenant.title,
      subtitle: `${tenant.companyName} subtitle`,
      eyebrow: tenant.companyName,
    }),
    node(`${tenant.key}-about`, 20, "about", {
      title: `Sobre ${tenant.companyName}`,
      body: `Conteúdo próprio de ${tenant.companyName}.`,
    }),
    node(`${tenant.key}-process`, 30, "process", {
      title: `Método ${tenant.companyName}`,
      steps: [{ number: 1, title: "Passo um", description: `Passo de ${tenant.companyName}` }],
    }),
    node(`${tenant.key}-cta`, 40, "cta_final", {
      title: `Falar com ${tenant.companyName}`,
      body: `CTA ${tenant.companyName}`,
      buttonLabel: `Contato ${tenant.companyName}`,
      primaryCTA: {
        type: "email",
        href: `mailto:${tenant.email}`,
        label: `Email ${tenant.companyName}`,
        visible: true,
      },
    }),
  ]

  return freezeDeep({
    tenantId: tenant.tenantId,
    status: "ready",
    host: tenant.host,
    canonical: {
      host: tenant.host,
      origin: `https://${tenant.host}`,
      requestHost: tenant.host,
      isPrimaryRequest: true,
    },
    blocks: [],
    footer: {
      logoUrl: null,
      tagline: `${tenant.companyName} tagline`,
      whatsappNumber: tenant.phone,
      whatsappVisible: true,
      email: tenant.email,
      address: null,
      companyName: tenant.companyName,
      socialLinks: [],
    },
    source: {
      contact,
      meta: {
        presentationProfile: "f1.presentation.cinematic_v1",
        ...(contractVersion
          ? { cinematicEditorialContractVersion: contractVersion }
          : {}),
        cinematicEditorial: editorial,
        branding: {
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          typography: "modern",
          logoUrl: null,
          logoHorizontalUrl: null,
        },
        seo: {
          title: `${tenant.companyName} — site`,
          description: `Homepage ${tenant.companyName}`,
        },
      },
    },
    serializablePlan: {
      contractVersion: "homepage-render-1",
      recipe: { id: `cinematic-${tenant.key}`, version: "1", blocks: [] },
      instances: nodes.map((n) => ({ id: n.id, order: n.order, variant: n.variant, visible: true })),
      presentation: {
        profile: "f1.presentation.cinematic_v1",
        chrome: cinematicChrome(true),
      },
      nodes,
    },
  })
}

export const FIXTURE_FLAVIO = buildPayload(TENANT_FLAVIO, FLAVIO_EDITORIAL)
export const FIXTURE_CELINA = buildPayload(TENANT_CELINA, CELINA_HUB_EDITORIAL)
export const FIXTURE_NEXO = buildPayload(TENANT_NEXO, null)

/** Compatible Public + legacy Edge: no contract marker; plan still carries factory blob. */
export const FIXTURE_FLAVIO_LEGACY = buildPayload(TENANT_FLAVIO, null, {
  contractVersion: null,
})
export const FIXTURE_CELINA_LEGACY = buildPayload(TENANT_CELINA, null, {
  contractVersion: null,
})
export const FIXTURE_NEXO_LEGACY = buildPayload(TENANT_NEXO, null, {
  contractVersion: null,
})
/** Seed present in Hub but legacy Edge ignores it — marker absent, meta unused. */
export const FIXTURE_CELINA_LEGACY_WITH_SEED = buildPayload(
  TENANT_CELINA,
  CELINA_HUB_EDITORIAL,
  { contractVersion: null },
)
export const FIXTURE_UNKNOWN_VERSION = buildPayload(TENANT_NEXO, CELINA_HUB_EDITORIAL, {
  contractVersion: "v9",
})
/** v1 without Celina seed — forbidden rollout cell (chrome stripped). */
export const FIXTURE_CELINA_V1_NO_SEED = buildPayload(TENANT_CELINA, null)

function withHost(payload, requestHost, primaryHost) {
  return freezeDeep({
    ...payload,
    host: requestHost,
    canonical: {
      host: primaryHost,
      origin: `https://${primaryHost}`,
      requestHost,
      isPrimaryRequest: requestHost === primaryHost,
    },
  })
}

export const HOST_FLAVIO_LEGACY = "flavio-legacy.cinematic.test"
export const HOST_CELINA_LEGACY = "celina-legacy.cinematic.test"
export const HOST_NEXO_UNKNOWN = "nexo-unknown.cinematic.test"
export const HOST_CELINA_V1_NO_SEED = "celina-v1-noseed.cinematic.test"

export const CINEMATIC_HOST_FIXTURES = freezeDeep({
  [TENANT_FLAVIO.host]: FIXTURE_FLAVIO,
  [TENANT_FLAVIO.wwwHost]: withHost(FIXTURE_FLAVIO, TENANT_FLAVIO.wwwHost, TENANT_FLAVIO.host),
  [TENANT_CELINA.host]: FIXTURE_CELINA,
  [TENANT_CELINA.wwwHost]: withHost(FIXTURE_CELINA, TENANT_CELINA.wwwHost, TENANT_CELINA.host),
  [TENANT_NEXO.host]: FIXTURE_NEXO,
  [TENANT_NEXO.wwwHost]: withHost(FIXTURE_NEXO, TENANT_NEXO.wwwHost, TENANT_NEXO.host),
  [HOST_FLAVIO_LEGACY]: withHost(FIXTURE_FLAVIO_LEGACY, HOST_FLAVIO_LEGACY, HOST_FLAVIO_LEGACY),
  [HOST_CELINA_LEGACY]: withHost(FIXTURE_CELINA_LEGACY, HOST_CELINA_LEGACY, HOST_CELINA_LEGACY),
  [HOST_NEXO_UNKNOWN]: withHost(FIXTURE_UNKNOWN_VERSION, HOST_NEXO_UNKNOWN, HOST_NEXO_UNKNOWN),
  [HOST_CELINA_V1_NO_SEED]: withHost(
    FIXTURE_CELINA_V1_NO_SEED,
    HOST_CELINA_V1_NO_SEED,
    HOST_CELINA_V1_NO_SEED,
  ),
})
