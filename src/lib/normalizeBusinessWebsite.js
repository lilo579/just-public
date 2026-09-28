/**
 * Normalize optional business website input for lead metadata.
 * Empty → null. Bare domains get https://. No network checks.
 *
 * @param {unknown} raw
 * @returns {{ ok: true, value: string | null } | { ok: false, error: "invalid_website" }}
 */
export function normalizeBusinessWebsite(raw) {
  if (raw == null) return { ok: true, value: null }

  const trimmed = String(raw).trim()
  if (!trimmed) return { ok: true, value: null }

  let candidate = trimmed

  if (!/^https?:\/\//i.test(candidate)) {
    // Reject other schemes (javascript:, ftp:, mailto:, etc.)
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
      return { ok: false, error: "invalid_website" }
    }
    candidate = `https://${candidate}`
  }

  let url
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, error: "invalid_website" }
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "invalid_website" }
  }

  const host = url.hostname
  if (
    !host ||
    !host.includes(".") ||
    host.startsWith(".") ||
    host.endsWith(".") ||
    host.includes(" ")
  ) {
    return { ok: false, error: "invalid_website" }
  }

  // Preserve user protocol; drop root-only trailing slash for stable metadata.
  let value = url.href
  if (url.pathname === "/" && !url.search && !url.hash) {
    value = `${url.protocol}//${url.host}`
  }

  return { ok: true, value }
}
