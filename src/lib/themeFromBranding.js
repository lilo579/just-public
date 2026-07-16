/**
 * Safe theme tokens from site_branding / HomepageSource branding.
 * Never interpolates unvalidated CSS into property names.
 */

const DEFAULTS = {
  "--site-color-primary": "#2563eb",
  "--site-color-secondary": "#0f172a",
  "--site-color-accent": "#64748b",
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
/** Hub stores bare HSL components, e.g. `146 7% 45%` (not `hsl(...)`). */
const HSL_TRIPLET_RE =
  /^(\d{1,3})\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/
const HSL_FUNC_RE =
  /^hsla?\(\s*(\d{1,3})\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%(?:\s*\/\s*[\d.]+%?)?\s*\)$/i

/**
 * @param {string} h
 * @param {string} s
 * @param {string} l
 * @returns {string | null}
 */
function toHslIfValid(h, s, l) {
  const hh = Number(h)
  const ss = Number(s)
  const ll = Number(l)
  if (!Number.isFinite(hh) || hh < 0 || hh > 360) return null
  if (!Number.isFinite(ss) || ss < 0 || ss > 100) return null
  if (!Number.isFinite(ll) || ll < 0 || ll > 100) return null
  return `hsl(${Math.round(hh)} ${ss}% ${ll}%)`
}

/**
 * @param {string} value
 * @returns {number | null} lightness 0–100
 */
export function parseCssColorLightness(value) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  const trip = trimmed.match(HSL_TRIPLET_RE)
  if (trip) return Number(trip[3])
  const fn = trimmed.match(HSL_FUNC_RE)
  if (fn) return Number(fn[3])
  const hex = trimmed.match(HEX_RE)
  if (!hex) return null
  let raw = hex[1]
  if (raw.length === 3) raw = raw.split("").map((c) => c + c).join("")
  const r = parseInt(raw.slice(0, 2), 16) / 255
  const g = parseInt(raw.slice(2, 4), 16) / 255
  const b = parseInt(raw.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return ((max + min) / 2) * 100
}

export function sanitizeCssColor(value, fallback) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase()

  const trip = trimmed.match(HSL_TRIPLET_RE)
  if (trip) {
    const out = toHslIfValid(trip[1], trip[2], trip[3])
    if (out) return out
  }

  const fn = trimmed.match(HSL_FUNC_RE)
  if (fn) {
    const out = toHslIfValid(fn[1], fn[2], fn[3])
    if (out) return out
  }

  return fallback
}

export function resolveFontStack(typography) {
  if (typeof typography !== "string") return FONT_ALLOWLIST.modern
  const key = typography.trim().toLowerCase()
  return FONT_ALLOWLIST[key] ?? FONT_ALLOWLIST.modern
}

export function themeTokensFromBranding(branding) {
  const fonts = resolveFontStack(branding?.typography)
  const primary = sanitizeCssColor(
    branding?.primaryColor,
    DEFAULTS["--site-color-primary"],
  )
  const secondary = sanitizeCssColor(
    branding?.secondaryColor,
    DEFAULTS["--site-color-secondary"],
  )
  const accent = sanitizeCssColor(
    branding?.accentColor,
    DEFAULTS["--site-color-accent"],
  )

  // Hub often stores a light “secondary” as page wash (cream/off-white).
  const secondaryL = parseCssColorLightness(secondary)
  const background =
    secondaryL != null && secondaryL >= 80
      ? secondary
      : DEFAULTS["--site-color-background"]

  return {
    "--site-color-primary": primary,
    "--site-color-secondary":
      secondaryL != null && secondaryL >= 80
        ? DEFAULTS["--site-color-secondary"]
        : secondary,
    "--site-color-accent": accent,
    "--site-color-background": background,
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
