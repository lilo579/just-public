export type HomepageStatus =
  | "not_ready"
  | "structurally_ready"
  | "ready"

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
  }
}

export type HeroBlock = {
  type: "hero"
  content: {
    title?: string | null
    subtitle?: string | null
    eyebrow?: string | null
  }
  primaryCTA?: HomepageCTA | null
}

export type TrustBlock = {
  type: "trust"
  content: {
    items: string[]
    hasContent: boolean
  }
}

export type ServicesBlock = {
  type: "services"
  content: {
    source: string
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
    title?: string | null
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

export type SerializableHomepageRecipeBlock = {
  id: string
  order: number
  variant: string
}

export type SerializableHomepageRecipe = {
  id: string
  version: string
  blocks: SerializableHomepageRecipeBlock[]
}

export type SerializableHomepageBlockInstance = {
  id: string
  order: number
  variant: string
  visible: boolean
}

export type SerializableHomepageRuntime = {
  key: string
  analyticsId: string
  hydration: string
  lazy: boolean
  ssr: boolean
  priority: string
}

export type SerializableHomepageCapabilities = {
  supportsHydration: boolean
  supportsLazyLoading: boolean
  supportsSSR: boolean
  supportsStreaming: boolean
  supportsAnimation: boolean
  supportsPersonalization: boolean
  supportsABTesting: boolean
}

export type SerializableHomepageRenderNode = {
  id: string
  variant: string
  order: number
  componentKey: string
  runtime: SerializableHomepageRuntime
  capabilities: SerializableHomepageCapabilities
  props: Record<string, unknown>
}

export type SerializableHomepageRenderPlan = {
  contractVersion: string
  recipe: SerializableHomepageRecipe
  instances: SerializableHomepageBlockInstance[]
  nodes: SerializableHomepageRenderNode[]
}

export type ResolvedHomepage = {
  tenantId: string
  status: HomepageStatus
  blocks: HomepageBlock[]
  footer: HomepageFooter
  source?: HomepageSourcePayload
  serializablePlan?: SerializableHomepageRenderPlan
}
