/**
 * Synthetic F4 Mission tenant — environmental restoration NGO (non-Dorot).
 * Hub-shaped painted Execution Plan for CanonicalHomepageRenderer bind-only path.
 */

const CAPABILITIES = Object.freeze({
  supportsHydration: false,
  supportsLazyLoading: false,
  supportsSSR: true,
  supportsStreaming: false,
  supportsAnimation: false,
  supportsPersonalization: false,
  supportsABTesting: false,
})

function runtimeFor(id) {
  return {
    key: id,
    analyticsId: id,
    hydration: "none",
    lazy: false,
    ssr: true,
    priority: "normal",
  }
}

function node(partial) {
  return {
    id: partial.id,
    variant: partial.variant ?? "default",
    order: partial.order,
    componentKey: partial.componentKey,
    runtime: runtimeFor(partial.id),
    capabilities: { ...CAPABILITIES },
    props: partial.props ?? {},
    paint: partial.paint,
  }
}

export const SYNTHETIC_F4_HOST = "www.canonical-f4.example.test"
export const SYNTHETIC_F4_TENANT_ID = "00000000-0000-4000-8000-00000000f401"

/** Allowlisted multi-route surfaces for this synthetic tenant only. */
export const SYNTHETIC_F4_ROUTES = Object.freeze([
  Object.freeze({
    kind: "content_page",
    path: "/privacy",
    title: "Privacidade",
    heading: "Aviso de privacidade",
    body: "Rios Vivos trata dados de contato apenas para responder solicitações de participação em projetos de restauração.",
  }),
  Object.freeze({
    kind: "form_signup_shell",
    path: "/participate",
    title: "Participar",
    heading: "Inscrição de voluntários",
    body: "Formulário de apresentação — envio real fica fora deste foundation slice.",
  }),
])

const F4_PAINT_COMPONENTS = Object.freeze([
  "hero",
  "about",
  "initiative",
  "progress_track",
  "patronage",
  "recurring_support",
  "history_collection",
  "trust",
  "cta_final",
])

export function buildSyntheticF4MissionPlan() {
  const nodes = [
    node({
      id: "f4-framing",
      order: 10,
      componentKey: "framing:default",
      paint: {
        component: "hero",
        block: {
          type: "hero",
          content: {
            eyebrow: "Restauração ambiental",
            title: "Reviver rios urbanos",
            subtitle: "Mobilização comunitária por bacias recuperadas.",
            highlight: null,
            metrics: [],
          },
          primaryCTA: {
            type: "email",
            href: "mailto:participar@rios-vivos.example.test",
            label: "Falar com a equipe",
            visible: true,
          },
        },
        layout: { heroLayout: "editorial-split" },
      },
    }),
    node({
      id: "f4-mission",
      order: 20,
      componentKey: "mission:default",
      paint: {
        component: "about",
        block: {
          type: "about",
          content: {
            title: "Nossa missão",
            body: "Conectar voluntários, ciência cidadã e prefeituras para recuperar manguezais costeiros e corredores verdes.",
            photoUrl: null,
          },
        },
        layout: { aboutLayout: "editorial", sectionId: "about" },
      },
    }),
    node({
      id: "f4-initiative",
      order: 30,
      componentKey: "active_initiative:default",
      paint: {
        component: "initiative",
        block: {
          type: "initiative",
          content: {
            title: "Corredor verde Pinheiros",
            subtitle: "Fase 2 — replantio de margem",
            description:
              "Voluntários monitoram qualidade da água semanalmente e plantam espécies nativas.",
            imageUrl: "https://cdn.example.test/rios-vivos/corredor.jpg",
            imageAlt: "Margem do Pinheiros com mudas nativas",
            cta: { label: "Conhecer o projeto", href: "#progresso" },
          },
        },
        layout: {},
      },
    }),
    node({
      id: "f4-progress",
      order: 40,
      componentKey: "progress:default",
      paint: {
        component: "progress_track",
        block: {
          type: "progress_track",
          content: {
            milestones: [
              { id: "diagnostico", label: "Diagnóstico", position: 1 },
              { id: "replantio", label: "Replantio", position: 2 },
              { id: "monitoramento", label: "Monitoramento", position: 3 },
            ],
            currentId: "replantio",
            quantitative: { current: 42000, goal: 80000, unitLabel: "BRL" },
          },
        },
        layout: {},
      },
    }),
    node({
      id: "f4-patronage",
      order: 50,
      componentKey: "patronage:default",
      paint: {
        component: "patronage",
        block: {
          type: "patronage",
          content: {
            headline: "Apoie a iniciativa atual",
            description: "Contribuições pontuais financiam mudas, kits de medição e mutirões.",
            tiers: [
              {
                id: "semente",
                title: "Semente",
                description: "Kit de mudas nativas",
                priceLabel: "R$ 80",
                cta: { label: "Apoiar", href: "mailto:apoiar@rios-vivos.example.test" },
              },
              {
                id: "guarda",
                title: "Guardião",
                description: "Um mutirão completo de margem",
                priceLabel: "R$ 400",
                cta: { label: "Apoiar", href: "mailto:apoiar@rios-vivos.example.test" },
              },
            ],
          },
        },
        layout: {},
      },
    }),
    node({
      id: "f4-recurring",
      order: 60,
      componentKey: "recurring_support:default",
      paint: {
        component: "recurring_support",
        block: {
          type: "recurring_support",
          content: {
            title: "Círculo de guardiões",
            description: "Programa mensal de voluntariado e educação ambiental.",
            benefits: [
              "Convites prioritários a mutirões",
              "Relatórios sazonais de monitoramento",
              "Encontros abertos com técnicos parceiros",
            ],
            priceLabel: "A partir de R$ 35/mês",
            cta: { label: "Quero participar", href: "/participate" },
          },
        },
        layout: {},
      },
    }),
    node({
      id: "f4-history",
      order: 70,
      componentKey: "history:default",
      paint: {
        component: "history_collection",
        block: {
          type: "history_collection",
          content: {
            title: "Iniciativas concluídas",
            items: [
              {
                id: "bacia-tiete-pilot",
                title: "Bacia Tietê — pilot",
                subtitle: "2024",
                imageUrl: null,
                imageAlt: null,
              },
              {
                id: "mangue-santos",
                title: "Manguezal Santos",
                subtitle: "2023",
                imageUrl: "https://cdn.example.test/rios-vivos/mangue.jpg",
                imageAlt: "Faixa de mangue recuperada",
              },
            ],
          },
        },
        layout: {},
      },
    }),
    node({
      id: "f4-trust",
      order: 80,
      componentKey: "trust:default",
      paint: {
        component: "trust",
        block: {
          type: "trust",
          content: {
            title: "Parcerias institucionais",
            items: [
              "Protocolos públicos de monitoramento",
              "Transparência de mutirões e doações",
              "Ciência cidadã aberta",
            ],
            logos: [],
            hasContent: true,
          },
        },
        layout: {},
      },
    }),
    node({
      id: "f4-contact",
      order: 90,
      componentKey: "contact:default",
      paint: {
        component: "cta_final",
        block: {
          type: "cta",
          content: {
            title: "Participe",
            body: "Fale com nossa equipe para mutirões, escolas e apoio técnico.",
            buttonLabel: "Enviar pelo WhatsApp",
            formMode: "whatsapp_compose",
            companyName: "Rios Vivos",
            contact: {
              whatsappNumber: "5511999900444",
              whatsappDisplay: "(11) 99990-0444",
              email: "participar@rios-vivos.example.test",
            },
            primaryCTA: {
              type: "whatsapp",
              href: "https://wa.me/5511999900444",
              label: "Enviar pelo WhatsApp",
              visible: true,
            },
          },
        },
        layout: { sectionId: "contact" },
      },
    }),
  ]

  return Object.freeze({
    contractVersion: "homepage-render-contract/v1",
    recipe: {
      id: "default_mission_recipe",
      version: "1",
      blocks: nodes.map((n) => ({ id: n.id, order: n.order, variant: n.variant })),
    },
    instances: nodes.map((n) => ({
      id: n.id,
      order: n.order,
      variant: n.variant,
      visible: true,
    })),
    presentation: {
      profile: "f4.presentation.mission_v1",
      chrome: {
        trustOverlapsHero: false,
        heroLayout: "editorial-split",
        aboutLayout: "editorial",
        ctaLayout: "standard",
        sectionId: undefined,
      },
    },
    nodes,
  })
}

export function listSyntheticF4PaintComponents(plan = buildSyntheticF4MissionPlan()) {
  return [...new Set((plan.nodes ?? []).map((n) => n.paint?.component).filter(Boolean))]
}

export function createSyntheticF4MissionTenant() {
  const serializablePlan = buildSyntheticF4MissionPlan()
  return Object.freeze({
    tenantId: SYNTHETIC_F4_TENANT_ID,
    status: "ready",
    host: SYNTHETIC_F4_HOST,
    slug: "rios-vivos-canonical-f4",
    canonical: Object.freeze({
      host: SYNTHETIC_F4_HOST,
      origin: `https://${SYNTHETIC_F4_HOST}`,
      requestHost: SYNTHETIC_F4_HOST,
      isPrimaryRequest: true,
    }),
    blocks: [],
    footer: Object.freeze({
      logoUrl: null,
      tagline: "Restauração comunitária de rios urbanos",
      whatsappNumber: "5511999900444",
      whatsappVisible: true,
      email: "participar@rios-vivos.example.test",
      address: null,
      companyName: "Rios Vivos",
      socialLinks: Object.freeze([]),
    }),
    source: Object.freeze({
      contact: Object.freeze({
        companyName: "Rios Vivos",
        email: "participar@rios-vivos.example.test",
        whatsappNumber: "5511999900444",
        whatsappVisible: true,
      }),
      meta: Object.freeze({
        siteMode: "NORMAL",
        presentationProfile: "f4.presentation.mission_v1",
        branding: Object.freeze({
          primaryColor: "#1a2744",
          secondaryColor: "#f4efe6",
          accentColor: "#c4a35a",
          typography: "editorial_serif",
          logoUrl: null,
          logoHorizontalUrl: null,
        }),
        seo: Object.freeze({
          title: "Rios Vivos — restauração de rios urbanos",
          description:
            "Organização comunitária de restauração ambiental: iniciativas ativas, progresso e participação.",
          ogTitle: "Rios Vivos",
          ogDescription:
            "Mobilização comunitária por bacias recuperadas e corredores verdes.",
          ogImage: "https://cdn.example.test/rios-vivos/og.jpg",
          favicon: null,
        }),
      }),
      missionRoutes: SYNTHETIC_F4_ROUTES,
    }),
    routes: SYNTHETIC_F4_ROUTES,
    serializablePlan,
    _f4PaintComponents: F4_PAINT_COMPONENTS,
  })
}

export const FIXTURE_SYNTHETIC_F4 = createSyntheticF4MissionTenant()
