function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asOptionalString(value) {
  return typeof value === "string" ? value : undefined
}

function hasTextContent(value) {
  return typeof value === "string" && value.trim().length > 0
}

function sanitizeWhatsappNumber(value) {
  if (typeof value !== "string") return null
  const digits = value.replace(/\D/g, "")
  return digits ? digits : null
}

/**
 * Project hero plan props into HeroBlock shape (props-driven).
 */
export function adaptCanonicalHero(nodeProps) {
  const source = isRecord(nodeProps?.hero)
    ? nodeProps.hero
    : isRecord(nodeProps?.content)
      ? nodeProps.content
      : isRecord(nodeProps)
        ? nodeProps
        : {}
  const contact = isRecord(nodeProps?.contact) ? nodeProps.contact : {}
  const existingPrimaryCTA = isRecord(nodeProps?.primaryCTA)
    ? nodeProps.primaryCTA
    : isRecord(source.primaryCTA)
      ? source.primaryCTA
      : null

  const whatsappNumber = sanitizeWhatsappNumber(contact.whatsappNumber)
  const whatsappVisible = contact.whatsappVisible === true
  const fallbackHref =
    whatsappVisible && whatsappNumber ? `https://wa.me/${whatsappNumber}` : undefined
  const fallbackLabel =
    asOptionalString(source.primaryCtaLabel) ?? "Falar pelo WhatsApp"
  const existingHref = existingPrimaryCTA ? asOptionalString(existingPrimaryCTA.href) : undefined
  const existingLabel = existingPrimaryCTA ? asOptionalString(existingPrimaryCTA.label) : undefined
  const existingVisible = existingPrimaryCTA?.visible
  const primaryCTA =
    existingPrimaryCTA && (existingHref || existingLabel)
      ? {
          type: asOptionalString(existingPrimaryCTA.type) ?? "whatsapp",
          href: existingHref,
          label: existingLabel ?? fallbackLabel,
          visible: typeof existingVisible === "boolean" ? existingVisible : true,
        }
      : fallbackHref
        ? {
            type: "whatsapp",
            href: fallbackHref,
            label: fallbackLabel,
            visible: true,
          }
        : null

  const metrics = Array.isArray(source.metrics)
    ? source.metrics
        .filter(isRecord)
        .map((metric) => ({
          label: asOptionalString(metric.label),
          value: asOptionalString(metric.value),
          description: asOptionalString(metric.description),
        }))
        .filter(
          (metric) =>
            hasTextContent(metric.label) ||
            hasTextContent(metric.value) ||
            hasTextContent(metric.description)
        )
    : []

  return {
    type: "hero",
    content: {
      title: asOptionalString(source.title),
      subtitle: asOptionalString(source.subtitle),
      eyebrow: asOptionalString(source.eyebrow),
      highlight: asOptionalString(source.highlight),
      metrics,
    },
    primaryCTA,
  }
}
