/**
 * Production SEO helpers for the public homepage.
 * Explicit payload SEO (source.meta.seo) wins when present; otherwise derive from plan/hero.
 */

/**
 * @param {unknown} plan
 * @returns {{ title?: string, subtitle?: string, highlight?: string, eyebrow?: string } | null}
 */
export function extractHeroSeoFields(plan) {
  const nodes = plan && typeof plan === "object" ? /** @type {{ nodes?: unknown }} */ (plan).nodes : null
  if (!Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue
    const n = /** @type {{ componentKey?: string, props?: Record<string, unknown> }} */ (node)
    const key = typeof n.componentKey === "string" ? n.componentKey : ""
    if (!key.startsWith("hero")) continue
    const props = n.props && typeof n.props === "object" ? n.props : {}
    const hero =
      props.hero && typeof props.hero === "object"
        ? /** @type {Record<string, unknown>} */ (props.hero)
        : props
    const title = typeof hero.title === "string" ? hero.title.trim() : ""
    const subtitle = typeof hero.subtitle === "string" ? hero.subtitle.trim() : ""
    const highlight = typeof hero.highlight === "string" ? hero.highlight.trim() : ""
    const eyebrow = typeof hero.eyebrow === "string" ? hero.eyebrow.trim() : ""
    return {
      title: title || undefined,
      subtitle: subtitle || undefined,
      highlight: highlight || undefined,
      eyebrow: eyebrow || undefined,
    }
  }
  return null
}

/**
 * Prefer a compact browser tab title (company + short qualifier).
 * @param {string} company
 * @param {{ title?: string, eyebrow?: string } | null} hero
 */
export function buildDocumentTitle(company, hero) {
  const qualifier = hero?.eyebrow || (hero?.title && hero.title.length <= 48 ? hero.title : "")
  if (qualifier && qualifier !== company) return `${company} | ${qualifier}`
  return company
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * @param {{
 *   host: string
 *   companyName: string
 *   branding?: {
 *     logoUrl?: string | null
 *     logoHorizontalUrl?: string | null
 *   } | null
 *   contact?: {
 *     address?: string | null
 *     email?: string | null
 *     whatsappNumber?: string | null
 *   } | null
 *   plan?: unknown
 *   footerTagline?: string | null
 *   noindex?: boolean
 *   seo?: {
 *     title?: string | null
 *     description?: string | null
 *     ogTitle?: string | null
 *     ogDescription?: string | null
 *     ogImage?: string | null
 *     favicon?: string | null
 *     jsonLdType?: string | null
 *   } | null
 * }} input
 */
export function buildPublicHomepageSeo(input) {
  const host = String(input.host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
  const company = (input.companyName || "Site").trim() || "Site"
  const hero = extractHeroSeoFields(input.plan)
  const explicit = input.seo && typeof input.seo === "object" ? input.seo : null

  const derivedDescription =
    hero?.subtitle ||
    hero?.highlight ||
    (typeof input.footerTagline === "string" && input.footerTagline.trim()) ||
    `Conheça ${company}.`

  const title = asTrimmed(explicit?.title) || buildDocumentTitle(company, hero)
  const description = asTrimmed(explicit?.description) || derivedDescription
  const ogTitle = asTrimmed(explicit?.ogTitle) || title
  const ogDescription = asTrimmed(explicit?.ogDescription) || description

  const canonicalUrl = host ? `https://${host}/` : ""
  const derivedOgImage =
    input.branding?.logoHorizontalUrl ||
    input.branding?.logoUrl ||
    ""
  const ogImage = asTrimmed(explicit?.ogImage) || derivedOgImage
  const faviconUrl = asTrimmed(explicit?.favicon) || ogImage || "/favicon.svg"

  const jsonLdType = asTrimmed(explicit?.jsonLdType) || "ProfessionalService"

  /** @type {Record<string, unknown>} */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": jsonLdType,
    name: company,
    url: canonicalUrl || undefined,
    image: ogImage || undefined,
    description,
  }
  if (input.contact?.address) jsonLd.address = input.contact.address
  if (input.contact?.email) jsonLd.email = input.contact.email
  if (input.contact?.whatsappNumber) {
    jsonLd.telephone = `+${String(input.contact.whatsappNumber).replace(/\D/g, "")}`
  }

  return {
    title,
    description,
    ogTitle,
    ogDescription,
    canonicalUrl,
    ogImage,
    faviconUrl,
    robots: input.noindex ? "noindex, nofollow" : "index, follow",
    jsonLd,
    twitterCard: ogImage ? "summary_large_image" : "summary",
  }
}
