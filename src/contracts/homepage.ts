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

export type HeroBlock = {
  type: "hero"
  content: {
    title?: string
    subtitle?: string
  }
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
    title?: string
    items: {
      title: string
      description?: string | null
    }[]
  }
}

export type AboutBlock = {
  type: "about"
  content: {
    title?: string
    body?: string
  }
}

export type CtaBlock = {
  type: "cta"
  content: {
    primaryCTA?: HomepageCTA
  }
}

export type HomepageBlock =
  | HeroBlock
  | TrustBlock
  | ServicesBlock
  | AboutBlock
  | CtaBlock

export type ResolvedHomepage = {
  tenantId: string
  status: HomepageStatus
  blocks: HomepageBlock[]
}
