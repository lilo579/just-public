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
