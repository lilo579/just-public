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

export function buildCanonicalCtaPrimaryCTA(source, contact) {
  const whatsappNumber = sanitizeWhatsappNumber(contact?.whatsappNumber)
  const whatsappVisible = contact?.whatsappVisible === true
  const email = asOptionalString(contact?.email)
  const emailVisible = contact?.emailVisible === true

  let href
  let type
  let fallbackLabel

  if (whatsappVisible && whatsappNumber) {
    href = `https://wa.me/${whatsappNumber}`
    type = "whatsapp"
    fallbackLabel = "Fale pelo WhatsApp"
  } else if (emailVisible && hasTextContent(email)) {
    href = `mailto:${email}`
    type = "email"
    fallbackLabel = "Enviar email"
  }

  const buttonLabel = asOptionalString(source?.buttonLabel)
  const label = buttonLabel ?? fallbackLabel

  return href
    ? {
        type,
        label,
        href,
        visible: true,
      }
    : null
}
