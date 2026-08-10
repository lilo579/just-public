/**
 * JUST institutional public SEO helpers (Coming Soon / packaged host).
 * Scoped to JUST — not platform SEO precedence.
 *
 * ADR-SEO-001: HTML, sitemap, and robots must use payload/RPC canonical.origin.
 * Host recognition helpers remain for packaged brand resolution only.
 */

import { JUST_HOSTS, justComingSoonSeo } from "./justInstitutionalFreeze.js"

/** Official OG / social image dimensions (pack file). */
export const JUST_OG_IMAGE_WIDTH = 1200
export const JUST_OG_IMAGE_HEIGHT = 630

/**
 * @param {string} host
 * @returns {boolean}
 */
export function isJustPublicHost(host) {
  const h = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
  return JUST_HOSTS.includes(h)
}

/**
 * Accurate Schema.org graph for the live Coming Soon public site.
 * No SearchAction (no on-site search). No ProfessionalService (not accurate).
 *
 * @param {{
 *   origin: string
 *   description?: string
 *   ogDescription?: string
 * }} seo
 * @returns {Record<string, unknown>}
 */
export function buildJustComingSoonJsonLd(seo) {
  const origin = String(seo?.origin || "")
    .trim()
    .replace(/\/$/, "")
  if (!origin) {
    throw new Error("buildJustComingSoonJsonLd requires canonical origin (ADR-SEO-001)")
  }
  const description =
    (typeof seo.description === "string" && seo.description.trim()) ||
    justComingSoonSeo.description
  const ogDescription =
    (typeof seo.ogDescription === "string" && seo.ogDescription.trim()) ||
    justComingSoonSeo.ogDescription
  const logoUrl = `${origin}/branding/just/logo-horizontal.png`
  const orgId = `${origin}/#organization`
  const siteId = `${origin}/#website`

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "JUST",
        url: `${origin}/`,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
        description,
      },
      {
        "@type": "WebSite",
        "@id": siteId,
        url: `${origin}/`,
        name: "JUST",
        description: ogDescription || description,
        inLanguage: "pt-BR",
        publisher: { "@id": orgId },
      },
    ],
  }
}
