function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asOptionalString(value) {
  return typeof value === "string" ? value : undefined
}

function hasTextContent(value) {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Project testimonials plan props into TestimonialsBlock shape (props-driven).
 */
export function adaptCanonicalTestimonials(nodeProps) {
  const source = isRecord(nodeProps?.testimonials)
    ? nodeProps.testimonials
    : isRecord(nodeProps?.content)
      ? nodeProps.content
      : isRecord(nodeProps)
        ? nodeProps
        : {}

  const images = Array.isArray(source.images)
    ? source.images
        .filter(isRecord)
        .map((image) => ({
          url: asOptionalString(image.url) ?? "",
          alt: asOptionalString(image.alt),
        }))
        .filter((image) => hasTextContent(image.url))
    : []

  const items = Array.isArray(source.items)
    ? source.items
        .filter(isRecord)
        .map((item) => ({
          company: asOptionalString(item.company),
          tag: asOptionalString(item.tag),
          quote: asOptionalString(item.quote),
          result: asOptionalString(item.result),
        }))
        .filter(
          (item) =>
            hasTextContent(item.company) ||
            hasTextContent(item.tag) ||
            hasTextContent(item.quote) ||
            hasTextContent(item.result)
        )
    : []

  return {
    type: "testimonials",
    content: {
      title: asOptionalString(source.title),
      subtitle: asOptionalString(source.subtitle),
      items,
      images,
    },
  }
}
