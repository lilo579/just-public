/**
 * CF-004 — POC Public Layer fixtures for Preview-only remote validation.
 * Fictitious Alpha/Beta/Gamma only. No real tenants, URLs, or network I/O.
 * Runtime: Web/ECMAScript APIs only (Workers-safe).
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

function planNode(partial) {
  const paint =
    partial.paint ??
    (() => {
      // Minimal paint for POC fixtures (bind-only renderer).
      const props = partial.props ?? {}
      if (partial.componentKey?.startsWith("hero")) {
        const hero = props.hero ?? {}
        return {
          component: "hero",
          block: {
            type: "hero",
            content: {
              title: hero.title,
              subtitle: hero.subtitle,
              eyebrow: hero.eyebrow,
              highlight: hero.highlight,
              metrics: hero.metrics ?? [],
            },
            primaryCTA: props.primaryCTA ?? null,
          },
          layout: {},
        }
      }
      if (partial.componentKey?.startsWith("services")) {
        const services = props.services ?? {}
        return {
          component: "services",
          block: {
            type: "services",
            content: {
              source: "canonical_preview",
              kicker: services.kicker,
              title: services.title,
              items: services.items ?? [],
            },
          },
          layout: { servicesLayout: "list" },
        }
      }
      if (partial.componentKey?.startsWith("cta_final")) {
        const ctaFinal = props.ctaFinal ?? {}
        const contact = props.contact ?? {}
        const digits =
          typeof contact.whatsappNumber === "string"
            ? contact.whatsappNumber.replace(/\D/g, "")
            : ""
        const primaryCTA =
          contact.whatsappVisible && digits
            ? {
                type: "whatsapp",
                href: `https://wa.me/${digits}`,
                label: ctaFinal.buttonLabel ?? "Fale pelo WhatsApp",
                visible: true,
              }
            : contact.email
              ? {
                  type: "email",
                  href: `mailto:${contact.email}`,
                  label: ctaFinal.buttonLabel ?? "Enviar email",
                  visible: true,
                }
              : null
        return {
          component: "cta_final",
          block: {
            type: "cta",
            content: {
              title: ctaFinal.title,
              body: ctaFinal.body,
              buttonLabel: ctaFinal.buttonLabel,
              primaryCTA,
            },
          },
          layout: {},
        }
      }
      return {
        component: "rich_text",
        block: { type: "rich_text", content: { title: null, paragraphs: [] } },
        layout: {},
      }
    })()

  return {
    id: partial.id,
    variant: partial.variant ?? "default",
    order: partial.order,
    componentKey: partial.componentKey,
    runtime: runtimeFor(partial.id),
    capabilities: { ...CAPABILITIES },
    props: partial.props,
    paint,
  }
}

function buildPlan(tenantKey, nodes) {
  return {
    contractVersion: "poc-1",
    recipe: {
      id: `poc-${tenantKey}`,
      version: "1",
      blocks: nodes.map((n) => ({
        id: n.id,
        order: n.order,
        variant: n.variant,
      })),
    },
    instances: nodes.map((n) => ({
      id: n.id,
      order: n.order,
      variant: n.variant,
      visible: true,
    })),
    presentation: {
      profile: "f1.presentation.engine_v1",
      chrome: {
        trustOverlapsHero: true,
        benefitsAsFeatureCards: true,
        servicesLayout: "engine-list",
      },
    },
    nodes,
  }
}

function buildTenantFixture(t) {
  const contact = {
    companyName: t.companyName,
    email: t.email,
    whatsappNumber: t.phone,
    whatsappVisible: true,
  }

  const nodes = [
    planNode({
      id: `${t.key}-hero`,
      order: 10,
      componentKey: "hero:default",
      props: {
        hero: {
          title: t.title,
          subtitle: t.subtitle,
          eyebrow: `${t.companyName} POC`,
          primaryCtaLabel: `Contato ${t.companyName}`,
        },
        contact,
        primaryCTA: {
          type: "email",
          href: `mailto:${t.email}`,
          label: `Email ${t.companyName}`,
          visible: true,
        },
      },
    }),
    planNode({
      id: `${t.key}-services`,
      order: 20,
      componentKey: "services:default",
      props: {
        services: {
          title: t.serviceTitle,
          items: [
            {
              title: `${t.companyName} Service`,
              description: `Distinct ${t.key} service description for isolation checks.`,
            },
          ],
        },
      },
    }),
    planNode({
      id: `${t.key}-cta`,
      order: 30,
      componentKey: "cta_final:default",
      props: {
        ctaFinal: {
          title: t.ctaTitle,
          body: `CTA body for ${t.companyName}`,
          buttonLabel: `Falar com ${t.companyName}`,
        },
        contact,
      },
    }),
  ]

  return Object.freeze({
    tenantId: t.tenantId,
    status: "ready",
    host: t.host,
    slug: t.slug,
    blocks: [],
    footer: Object.freeze({
      logoUrl: null,
      tagline: `${t.companyName} tagline`,
      whatsappNumber: t.phone,
      whatsappVisible: true,
      email: t.email,
      address: null,
      companyName: t.companyName,
      socialLinks: Object.freeze([]),
    }),
    source: Object.freeze({
      contact: Object.freeze({ ...contact }),
      meta: Object.freeze({
        branding: Object.freeze({
          primaryColor: t.primaryColor,
          secondaryColor: t.secondaryColor,
          typography: "modern",
          logoUrl: null,
          logoHorizontalUrl: null,
        }),
      }),
    }),
    serializablePlan: buildPlan(t.key, nodes),
  })
}

export const TENANT_ALPHA = Object.freeze({
  tenantId: "00000000-0000-4000-8000-0000000000a1",
  key: "alpha",
  host: "alpha.justwebsites.com.br",
  slug: "alpha-consulting-poc",
  companyName: "Alpha Consulting",
  title: "Alpha Consulting",
  subtitle: "Alpha subtitle for canonical POC",
  email: "alpha@example.test",
  phone: "5511999900001",
  primaryColor: "#112233",
  secondaryColor: "#445566",
  serviceTitle: "Alpha Services",
  ctaTitle: "Alpha CTA",
})

export const TENANT_BETA = Object.freeze({
  tenantId: "00000000-0000-4000-8000-0000000000b2",
  key: "beta",
  host: "beta.justwebsites.com.br",
  slug: "beta-studio-poc",
  companyName: "Beta Studio",
  title: "Beta Studio",
  subtitle: "Beta subtitle for canonical POC",
  email: "beta@example.test",
  phone: "5511999900002",
  primaryColor: "#aa5500",
  secondaryColor: "#664422",
  serviceTitle: "Beta Services",
  ctaTitle: "Beta CTA",
})

export const TENANT_GAMMA = Object.freeze({
  tenantId: "00000000-0000-4000-8000-0000000000c7",
  key: "gamma",
  host: "gamma.justwebsites.com.br",
  slug: "gamma-labs-poc",
  companyName: "Gamma Labs",
  title: "Gamma Labs",
  subtitle: "Gamma subtitle for canonical POC",
  email: "gamma@example.test",
  phone: "5511999900003",
  primaryColor: "#008866",
  secondaryColor: "#004433",
  serviceTitle: "Gamma Services",
  ctaTitle: "Gamma CTA",
})

export const FIXTURE_ALPHA = buildTenantFixture(TENANT_ALPHA)
export const FIXTURE_BETA = buildTenantFixture(TENANT_BETA)
export const FIXTURE_GAMMA = buildTenantFixture(TENANT_GAMMA)

/** Host → fixture map. Unknown hosts are intentionally omitted (caller returns 404). */
export const POC_FIXTURES_BY_HOST = Object.freeze({
  [TENANT_ALPHA.host]: FIXTURE_ALPHA,
  [TENANT_BETA.host]: FIXTURE_BETA,
  [TENANT_GAMMA.host]: FIXTURE_GAMMA,
})

/**
 * Resolve a per-request clone of a POC fixture for `host`.
 * @param {string} host normalized hostname
 * @returns {object | null}
 */
export function resolvePocFixturePayload(host) {
  if (typeof host !== "string" || host.trim() === "") return null
  const fixture = POC_FIXTURES_BY_HOST[host]
  if (!fixture) return null
  return structuredClone(fixture)
}
