function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asOptionalString(value) {
  return typeof value === "string" ? value : undefined
}

function hasTextContent(value) {
  return typeof value === "string" && value.trim().length > 0
}

export function adaptCanonicalBenefits(source) {
  const items = Array.isArray(source?.items)
    ? source.items
        .filter(isRecord)
        .map((item) => ({
          title: asOptionalString(item.title),
          description: asOptionalString(item.description),
          imageUrl: asOptionalString(item.imageUrl),
        }))
        .filter(
          (item) =>
            hasTextContent(item.title) ||
            hasTextContent(item.description) ||
            hasTextContent(item.imageUrl)
        )
    : []

  const metrics = Array.isArray(source?.metrics)
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
    type: "benefits",
    content: {
      kicker: asOptionalString(source?.kicker),
      title: asOptionalString(source?.title),
      body: asOptionalString(source?.body),
      items,
      summary: asOptionalString(source?.summary),
      metrics,
    },
  }
}

/**
 * Pro differentials (title-only items) originally rendered as FeaturesBlock.
 * Project benefits → features for that compact visual without changing plan semantics.
 */
export function projectBenefitsToFeaturesBlock(benefitsBlock) {
  const content = benefitsBlock?.content && isRecord(benefitsBlock.content)
    ? benefitsBlock.content
    : {}
  const items = Array.isArray(content.items)
    ? content.items
        .filter(isRecord)
        .map((item) => ({
          title: asOptionalString(item.title),
          description: asOptionalString(item.description) ?? null,
        }))
        .filter((item) => hasTextContent(item.title))
    : []

  return {
    type: "features",
    content: {
      title: asOptionalString(content.title) ?? null,
      items,
    },
  }
}

/** Compact pro layout: no images, no metrics aside, no kicker/body prose. */
export function shouldRenderBenefitsAsFeatures(benefitsBlock) {
  const content = benefitsBlock?.content && isRecord(benefitsBlock.content)
    ? benefitsBlock.content
    : {}
  const items = Array.isArray(content.items) ? content.items.filter(isRecord) : []
  const hasImage = items.some((item) => hasTextContent(item.imageUrl))
  const metrics = Array.isArray(content.metrics) ? content.metrics : []
  const hasAside = hasTextContent(content.summary) || metrics.length > 0
  const hasProse = hasTextContent(content.kicker) || hasTextContent(content.body)
  return !hasImage && !hasAside && !hasProse && items.length > 0
}
