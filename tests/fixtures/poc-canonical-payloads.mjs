/**
 * POC-001 / CF-004 fixtures for tests.
 * A/B/G runtime corpus lives in src/poc (Workers-safe). Error fixtures stay test-only.
 */

export {
  TENANT_ALPHA,
  TENANT_BETA,
  TENANT_GAMMA,
  FIXTURE_ALPHA,
  FIXTURE_BETA,
  FIXTURE_GAMMA,
  POC_FIXTURES_BY_HOST,
  resolvePocFixturePayload,
} from "../../src/poc/publicSiteFixtures.js"

import {
  FIXTURE_ALPHA,
  FIXTURE_BETA,
  FIXTURE_GAMMA,
  TENANT_ALPHA,
  TENANT_BETA,
  TENANT_GAMMA,
} from "../../src/poc/publicSiteFixtures.js"

export const POC_TENANTS = {
  alpha: TENANT_ALPHA,
  beta: TENANT_BETA,
  gamma: TENANT_GAMMA,
}

/** Payload without serializablePlan — must force controlled error (no silent legacy). */
export const FIXTURE_NO_PLAN = {
  tenantId: "00000000-0000-4000-8000-0000000000c3",
  status: "ready",
  // Broken F1: no Execution Plan and no Shop/NoSource blocks → must error.
  blocks: [],
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

/** Shop / NoSource — plan absent, legacy blocks present → legacy runtime. */
export const FIXTURE_NOSOURCE_LEGACY = {
  tenantId: "00000000-0000-4000-8000-0000000000c4",
  status: "ready",
  blocks: [
    {
      type: "hero",
      content: { title: "NoSource Legacy Hero" },
      primaryCTA: null,
    },
  ],
  footer: {
    logoUrl: null,
    tagline: null,
    whatsappNumber: null,
    whatsappVisible: false,
    email: "nosource@example.test",
    address: null,
    companyName: "NoSource Shop Tenant",
    socialLinks: [],
  },
  source: {
    contact: { companyName: "NoSource Shop Tenant", email: "nosource@example.test" },
    meta: {
      branding: {
        primaryColor: "#333333",
        secondaryColor: "#444444",
        typography: "modern",
      },
    },
  },
}

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

function planNode(partial) {
  const props = partial.props ?? {}
  let paint = partial.paint
  if (!paint && partial.componentKey?.startsWith("hero")) {
    const hero = props.hero ?? {}
    paint = {
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
      chrome: {},
    },
    nodes,
  }
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
      whatsappNumber: null,
      whatsappVisible: false,
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
    whatsappNumber: null,
    whatsappVisible: false,
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
  [TENANT_GAMMA.host]: FIXTURE_GAMMA,
  "no-plan.justwebsites.com.br": FIXTURE_NO_PLAN,
  "nosource.justwebsites.com.br": FIXTURE_NOSOURCE_LEGACY,
  "bad-branding.justwebsites.com.br": FIXTURE_BAD_BRANDING,
}

/** Hosts used to return non-JSON / controlled HTTP errors from the mock. */
export const HOST_MALFORMED = "malformed.justwebsites.com.br"
export const HOST_UNKNOWN = "unknown.example.test"
