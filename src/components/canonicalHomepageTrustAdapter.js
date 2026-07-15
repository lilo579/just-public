function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asOptionalString(value) {
  return typeof value === "string" ? value : undefined
}

function hasTextContent(value) {
  return typeof value === "string" && value.trim().length > 0
}

function asStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.filter((item) => typeof item === "string" && item.trim().length > 0)
}

/**
 * Project trust plan props into TrustBlock shape (props-driven).
 */
export function adaptCanonicalTrust(nodeProps) {
  const source = isRecord(nodeProps?.trust)
    ? nodeProps.trust
    : isRecord(nodeProps?.content)
      ? nodeProps.content
      : isRecord(nodeProps)
        ? nodeProps
        : {}

  const items = asStringArray(source.items)
  const logos = Array.isArray(source.logos)
    ? source.logos
        .filter(isRecord)
        .map((logo) => ({
          name: asOptionalString(logo.name),
          imageUrl: asOptionalString(logo.imageUrl),
          alt: asOptionalString(logo.alt),
        }))
        .filter(
          (logo) => hasTextContent(logo.imageUrl) || hasTextContent(logo.name)
        )
    : []

  const title = asOptionalString(source.title)
  const hasContent =
    hasTextContent(title) || items.length > 0 || logos.length > 0

  return {
    type: "trust",
    content: {
      title,
      items,
      logos,
      hasContent,
    },
  }
}
