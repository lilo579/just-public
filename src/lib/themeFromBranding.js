/**
 * Safe theme tokens from site_branding / HomepageSource branding.
 * Never interpolates unvalidated CSS into property names.
 */

const DEFAULTS = {
  "--site-color-primary": "#2563eb",
  "--site-color-secondary": "#0f172a",
  "--site-color-background": "#ffffff",
  "--site-color-text": "#0f172a",
  "--site-radius": "0.75rem",
  "--site-font-heading":
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  "--site-font-body":
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}

const FONT_ALLOWLIST = {
  modern: {
    heading: DEFAULTS["--site-font-heading"],
    body: DEFAULTS["--site-font-body"],
  },
  classic: {
    heading: 'Georgia, "Times New Roman", Times, serif',
    body: 'Georgia, "Times New Roman", Times, serif',
  },
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function sanitizeCssColor(value, fallback) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (!HEX_RE.test(trimmed)) return fallback
  return trimmed.toLowerCase()
}

export function resolveFontStack(typography) {
  if (typeof typography !== "string") return FONT_ALLOWLIST.modern
  const key = typography.trim().toLowerCase()
  return FONT_ALLOWLIST[key] ?? FONT_ALLOWLIST.modern
}

export function themeTokensFromBranding(branding) {
  const fonts = resolveFontStack(branding?.typography)
  return {
    "--site-color-primary": sanitizeCssColor(
      branding?.primaryColor,
      DEFAULTS["--site-color-primary"],
    ),
    "--site-color-secondary": sanitizeCssColor(
      branding?.secondaryColor,
      DEFAULTS["--site-color-secondary"],
    ),
    "--site-color-background": DEFAULTS["--site-color-background"],
    "--site-color-text": DEFAULTS["--site-color-text"],
    "--site-radius": DEFAULTS["--site-radius"],
    "--site-font-heading": fonts.heading,
    "--site-font-body": fonts.body,
  }
}

/** Inline style attribute value — only allowlisted custom properties. */
export function themeTokensToInlineStyle(tokens) {
  return Object.entries(tokens)
    .map(([key, value]) => `${key}:${value}`)
    .join(";")
}
