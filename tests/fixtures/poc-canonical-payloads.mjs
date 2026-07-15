/**
 * POC-001 Slice 4 — fictitious Alpha/Beta payload fixtures matching ResolvedHomepage
 * + SerializableHomepageRenderPlan as consumed by CanonicalHomepageRenderer.
 * Not real tenants. Not a parallel Hub contract.
 */

const CAPABILITIES = {
  supportsHydration: false,
  supportsLazyLoading: false,
  supportsSSR: true,
  supportsStreaming: false,
  supportsAnimation: false,
  supportsPersonalization: false,
  supportsABTesting: false,
}

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

/**
 * @param {{
 *   id: string
 *   order: number
 *   componentKey: string
 *   props: Record<string, unknown>
 *   variant?: string
 * }} partial
 */
function planNode(partial) {
  return {
    id: partial.id,
    variant: partial.variant ?? "default",
    order: partial.order,
    componentKey: partial.componentKey,
    runtime: runtimeFor(partial.id),
    capabilities: { ...CAPABILITIES },
    props: partial.props,
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
    nodes,
  }
}

/**
 * @param {{
 *   tenantId: string
 *   key: string
 *   host: string
 *   slug: string
 *   companyName: string
 *   title: string
 *   subtitle: string
 *   email: string
 *   primaryColor: string
 *   secondaryColor: string
 *   serviceTitle: string
 *   ctaTitle: string
 * }} t
 */
function buildTenantFixture(t) {
  const contact = {
    companyName: t.companyName,
    email: t.email,
    whatsappNumber: null,
    whatsappVisible: false,
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

  return {
    tenantId: t.tenantId,
    status: "ready",
    host: t.host,
    slug: t.slug,
    blocks: [],
    footer: {
      logoUrl: null,
      tagline: `${t.companyName} tagline`,
      whatsappNumber: null,
      whatsappVisible: false,
      email: t.email,
      address: null,
      companyName: t.companyName,
      socialLinks: [],
    },
    source: {
      contact,
      meta: {
        branding: {
          primaryColor: t.primaryColor,
          secondaryColor: t.secondaryColor,
          typography: "modern",
          logoUrl: null,
          logoHorizontalUrl: null,
        },
      },
    },
    serializablePlan: buildPlan(t.key, nodes),
  }
}

export const TENANT_ALPHA = {
  tenantId: "00000000-0000-4000-8000-0000000000a1",
  key: "alpha",
  host: "alpha.justwebsites.com.br",
  slug: "alpha-consulting-poc",
  companyName: "Alpha Consulting",
  title: "Alpha Consulting",
  subtitle: "Alpha subtitle for canonical POC",
  email: "alpha@example.test",
  primaryColor: "#112233",
  secondaryColor: "#445566",
  serviceTitle: "Alpha Services",
  ctaTitle: "Alpha CTA",
}

export const TENANT_BETA = {
  tenantId: "00000000-0000-4000-8000-0000000000b2",
  key: "beta",
  host: "beta.justwebsites.com.br",
  slug: "beta-studio-poc",
  companyName: "Beta Studio",
  title: "Beta Studio",
  subtitle: "Beta subtitle for canonical POC",
  email: "beta@example.test",
  primaryColor: "#aa5500",
  secondaryColor: "#664422",
  serviceTitle: "Beta Services",
  ctaTitle: "Beta CTA",
}

export const FIXTURE_ALPHA = buildTenantFixture(TENANT_ALPHA)
export const FIXTURE_BETA = buildTenantFixture(TENANT_BETA)

/** Payload without serializablePlan — must force controlled error (no silent legacy). */
export const FIXTURE_NO_PLAN = {
  tenantId: "00000000-0000-4000-8000-0000000000c3",
  status: "ready",
  blocks: [
    {
      type: "hero",
      content: { title: "Should Not Render Silently" },
      primaryCTA: null,
    },
  ],
  footer: {
    logoUrl: null,
    tagline: null,
    whatsappNumber: null,
    whatsappVisible: false,
    email: "noplan@example.test",
    address: null,
    companyName: "No Plan Tenant",
    socialLinks: [],
  },
  source: {
    contact: { companyName: "No Plan Tenant", email: "noplan@example.test" },
    meta: {
      branding: {
        primaryColor: "#111111",
        secondaryColor: "#222222",
        typography: "modern",
      },
    },
  },
}

/** Valid plan + branding colors that must fall back to theme defaults. */
export const FIXTURE_BAD_BRANDING = {
  ...FIXTURE_ALPHA,
  tenantId: "00000000-0000-4000-8000-0000000000d4",
  host: "bad-branding.justwebsites.com.br",
  source: {
    contact: {
      companyName: "Bad Branding Co",
      email: "bad-branding@example.test",
    },
    meta: {
      branding: {
        primaryColor: "url(javascript:alert(1))",
        secondaryColor: "red",
        typography: "not-a-font",
        logoUrl: null,
      },
    },
  },
  footer: {
    ...FIXTURE_ALPHA.footer,
    companyName: "Bad Branding Co",
    email: "bad-branding@example.test",
    tagline: "Bad Branding tagline",
  },
  serializablePlan: buildPlan("badbrand", [
    planNode({
      id: "bad-hero",
      order: 10,
      componentKey: "hero:default",
      props: {
        hero: {
          title: "Bad Branding Co",
          subtitle: "Invalid colors should use safe defaults",
        },
        contact: {
          companyName: "Bad Branding Co",
          email: "bad-branding@example.test",
        },
        primaryCTA: {
          type: "email",
          href: "mailto:bad-branding@example.test",
          label: "Email Bad Branding Co",
          visible: true,
        },
      },
    }),
  ]),
}

export const HOST_FIXTURES = {
  [TENANT_ALPHA.host]: FIXTURE_ALPHA,
  [TENANT_BETA.host]: FIXTURE_BETA,
  "no-plan.justwebsites.com.br": FIXTURE_NO_PLAN,
  "bad-branding.justwebsites.com.br": FIXTURE_BAD_BRANDING,
}

/** Hosts used to return non-JSON / controlled HTTP errors from the mock. */
export const HOST_MALFORMED = "malformed.justwebsites.com.br"
export const HOST_UNKNOWN = "unknown.example.test"
