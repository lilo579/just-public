/**
 * Public homepage UI contracts (Astro block props, footer, resolved homepage shell).
 * Painted plan / presentation wire types are owned by `@just/site-engine-authority`.
 */

export type HomepageCTA = {
  type: string
  label: string
  href?: string
  visible?: boolean
}

export type FooterSocialLink = {
  type: string
  url: string
}

export type HomepageFooter = {
  logoUrl: string | null
  tagline: string | null
  whatsappNumber: string | null
  whatsappVisible: boolean
  email: string | null
  address: string | null
  companyName: string | null
  socialLinks: FooterSocialLink[]
}

export type HomepageSourceBranding = {
  logoUrl?: string | null
  logoHorizontalUrl?: string | null
  logoWhiteUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  typography?: string | null
}

export type HomepageSourceContact = {
  companyName?: string | null
}

export type HomepageSourcePayload = {
  contact?: HomepageSourceContact
  meta?: {
    branding?: HomepageSourceBranding
    presentationProfile?: string | null
  }
}

export type HomepageStatus = "not_ready" | "structurally_ready" | "ready"

export type HeroBlock = {
  type: "hero"
  content: {
    title?: string | null
    subtitle?: string | null
    eyebrow?: string | null
    highlight?: string | null
    metrics: {
      label?: string | null
      value?: string | null
      description?: string | null
    }[]
  }
  primaryCTA?: HomepageCTA | null
}

export type TrustBlock = {
  type: "trust"
  content: {
    title?: string | null
    items: string[]
    logos: {
      name?: string | null
      imageUrl?: string | null
      alt?: string | null
    }[]
    hasContent: boolean
  }
}

export type ServicesBlock = {
  type: "services"
  content: {
    source: string
    kicker?: string | null
    title?: string | null
    items: {
      title: string
      description?: string | null
    }[]
  }
}

export type AboutBlock = {
  type: "about"
  content: {
    title?: string | null
    body?: string | null
    photoUrl?: string | null
  }
}

export type RichTextBlock = {
  type: "rich_text"
  content: {
    title?: string | null
    paragraphs: string[]
  }
}

export type FeaturesBlock = {
  type: "features"
  content: {
    title?: string | null
    items: {
      title: string
      description?: string | null
    }[]
  }
}

export type BenefitsBlock = {
  type: "benefits"
  content: {
    kicker?: string | null
    title?: string | null
    body?: string | null
    items: {
      title?: string | null
      description?: string | null
      imageUrl?: string | null
    }[]
    summary?: string | null
    metrics: {
      label?: string | null
      value?: string | null
      description?: string | null
    }[]
  }
}

export type ProcessBlock = {
  type: "process"
  content: {
    kicker?: string | null
    title?: string | null
    body?: string | null
    steps: {
      number: number
      title: string
      description?: string | null
    }[]
  }
}

export type SocialProofImage = {
  url: string
  alt?: string | null
}

export type TestimonialsBlock = {
  type: "testimonials"
  content: {
    title?: string | null
    subtitle?: string | null
    items: {
      company?: string | null
      tag?: string | null
      quote?: string | null
      result?: string | null
    }[]
    images: SocialProofImage[]
  }
}

export type InfoCardBlock = {
  type: "info_card"
  content: {
    title?: string | null
    body?: string | null
    pills: string[]
  }
}

export type CtaBlock = {
  type: "cta"
  content: {
    primaryCTA?: HomepageCTA | null
    title?: string | null
    body?: string | null
    buttonLabel?: string | null
  }
}

export type HomepageBlock =
  | HeroBlock
  | TrustBlock
  | ServicesBlock
  | AboutBlock
  | RichTextBlock
  | BenefitsBlock
  | FeaturesBlock
  | ProcessBlock
  | TestimonialsBlock
  | InfoCardBlock
  | CtaBlock

/** Plan / paint / presentation wire types — owned by @just/site-engine-authority. */
export type {
  PaintedBlockPayload,
  PaintedComponentKind,
  PaintedHomepageNode,
  PaintedHomepageNodeLayout,
  PaintedHomepagePresentation,
  SerializableHomepageBlockInstance,
  SerializableHomepageCapabilities,
  SerializableHomepageRecipe,
  SerializableHomepageRecipeBlock,
  SerializableHomepageRenderNode,
  SerializableHomepageRenderPlan,
  SerializableHomepageRuntime,
  F1PresentationChrome,
  F1PresentationProfile,
} from "@just/site-engine-authority"

export {
  HOMEPAGE_RENDER_CONTRACT_VERSION,
  DEFAULT_F1_PRESENTATION_PROFILE,
  resolveF1PresentationProfile,
  resolveF1PresentationChrome,
  resolveHeaderLogoUrl,
  resolveHeaderOverHeroLogoUrl,
  resolveFooterLogoUrl,
} from "@just/site-engine-authority"

import type { SerializableHomepageRenderPlan as AuthorityPlan } from "@just/site-engine-authority"

/**
 * ADR-SEO-001 — public URL authority from the active primary domain (is_primary).
 * Additive optional field on the public payload contract.
 */
export type PublicCanonicalContract = {
  host: string
  origin: string
  requestHost: string
  isPrimaryRequest: boolean
}

export type ResolvedHomepage = {
  tenantId: string
  status: HomepageStatus
  blocks: HomepageBlock[]
  footer: HomepageFooter
  source?: HomepageSourcePayload
  serializablePlan?: AuthorityPlan
  /** Present when an active primary domain exists (host path). */
  canonical?: PublicCanonicalContract
}
