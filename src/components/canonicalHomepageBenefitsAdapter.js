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
        .filter((item) => hasTextContent(item.title))
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

export function getCanonicalBenefitsFallbackWarnings(block) {
  const droppedFields = [
    hasTextContent(block.content.kicker) ? "kicker" : null,
    hasTextContent(block.content.body) ? "body" : null,
    hasTextContent(block.content.summary) ? "summary" : null,
    block.content.metrics.length > 0 ? `metrics(${block.content.metrics.length})` : null,
    block.content.items.some((item) => hasTextContent(item.imageUrl))
      ? `item.imageUrl(${block.content.items.filter((item) => hasTextContent(item.imageUrl)).length})`
      : null,
  ].filter((value) => value !== null)

  if (droppedFields.length === 0) return []

  return [
    `benefits fallback via FeaturesBlock omits visual rendering for: ${droppedFields.join(", ")}`,
  ]
}

export function projectBenefitsToFeaturesBlock(block) {
  return {
    type: "features",
    content: {
      title: block.content.title,
      items: block.content.items.map((item) => ({
        title: item.title ?? "",
        description: item.description,
      })),
    },
  }
}
