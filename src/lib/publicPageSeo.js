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
 * Approved per-tenant favicon packs (not logos) shipped under public/branding/.
 * Used when Hub `seo.favicon` is unset — never fall back to the site logo for these hosts.
 */
const PACKAGED_FAVICON_SLUG_BY_HOST = Object.freeze({
  "www.marceloborer.com.br": "marcelo-borer",
  "marceloborer.com.br": "marcelo-borer",
  "www.rossanamendonca.com.br": "rossana-mendonca",
  "rossanamendonca.com.br": "rossana-mendonca",
  "www.sorayabarbosa.com.br": "soraya-barbosa",
  "sorayabarbosa.com.br": "soraya-barbosa",
  "www.3djewish.com.br": "3d-jewish",
  "3djewish.com.br": "3d-jewish",
})

/**
 * @param {string} host
 * @returns {string}
 */
function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
}

/**
 * @param {string} host
 * @param {{ preferIco?: boolean }} [opts]
 * @returns {string} site-relative path or ""
 */
export function resolvePackagedTenantFaviconPath(host, opts = {}) {
  const slug = PACKAGED_FAVICON_SLUG_BY_HOST[normalizeHost(host)]
  if (!slug) return ""
  return opts.preferIco
    ? `/branding/${slug}/favicon.ico`
    : `/branding/${slug}/favicon.svg`
}

/**
 * Golden Master favicon resolution — never Astro scaffold paths.
 * Prefer explicit CMS favicon, then packaged tenant mark, then og/logo fallbacks.
 * @param {{
 *   host?: string | null
 *   favicon?: string | null
 *   ogImage?: string | null
 *   logoHorizontalUrl?: string | null
 *   logoUrl?: string | null
 *   preferIco?: boolean
 * }} input
 * @returns {string}
 */
export function resolveBrandFaviconUrl(input) {
  const packaged = resolvePackagedTenantFaviconPath(input?.host || "", {
    preferIco: input?.preferIco === true,
  })
  const candidates = [
    asTrimmed(input?.favicon),
    packaged,
    asTrimmed(input?.ogImage),
    asTrimmed(input?.logoHorizontalUrl),
    asTrimmed(input?.logoUrl),
  ]
  for (const url of candidates) {
    if (!url) continue
    // Only reject Astro scaffold paths — not remote URLs that happen to end in favicon.ico
    if (url === "/favicon.svg" || url === "/favicon.ico") continue
    return url
  }
  return ""
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
  const logoUrl = asTrimmed(input.branding?.logoUrl)
  const logoHorizontalUrl = asTrimmed(input.branding?.logoHorizontalUrl)
  const packagedSlug = PACKAGED_FAVICON_SLUG_BY_HOST[host] || ""
  const packagedOgImage = packagedSlug ? `/branding/${packagedSlug}/og-image.jpg` : ""
  // Prefer CMS OG → Hub logos → packaged OG (only hosts with a shipped og-image.jpg).
  const derivedOgImage = logoHorizontalUrl || logoUrl || packagedOgImage || ""
  const ogImage = asTrimmed(explicit?.ogImage) || derivedOgImage
  /**
   * Favicon: explicit CMS → packaged tenant mark (not logo) → ogImage → logos.
   * Do not use Astro scaffold (/favicon.svg|/favicon.ico) as a customer icon.
   */
  const faviconUrl = resolveBrandFaviconUrl({
    host,
    favicon: explicit?.favicon || (packagedSlug ? `/branding/${packagedSlug}/favicon.svg` : ""),
    ogImage,
    logoHorizontalUrl,
    logoUrl,
  })

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
