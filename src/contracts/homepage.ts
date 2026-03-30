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
  | FeaturesBlock
  | ProcessBlock
  | TestimonialsBlock
  | InfoCardBlock
  | CtaBlock

export type ResolvedHomepage = {
  tenantId: string
  status: HomepageStatus
  blocks: HomepageBlock[]
  footer: HomepageFooter
}