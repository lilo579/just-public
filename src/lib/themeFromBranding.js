/**
 * Safe theme tokens from site_branding / HomepageSource branding.
 * Never interpolates unvalidated CSS into property names or freeform CSS.
 */

const DEFAULTS = {
  "--site-color-primary": "#2563eb",
  "--site-color-secondary": "#0f172a",
  "--site-color-accent": "#64748b",
  "--site-color-background": "#ffffff",
  "--site-color-text": "#0f172a",
  "--site-color-text-muted": "hsl(220 10% 40%)",
  "--site-color-text-inverse": "#ffffff",
  "--site-color-surface": "#ffffff",
  "--site-color-surface-alt": "hsl(40 20% 97%)",
  "--site-color-card": "#ffffff",
  "--site-color-card-border": "hsl(30 8% 88%)",
  "--site-radius": "0.75rem",
  "--site-radius-button": "0.75rem",
  "--site-radius-card": "0.75rem",
  "--site-radius-image": "0.75rem",
  "--site-shadow": "none",
  "--site-container-max": "1280px",
  "--site-section-space": "4rem",
  "--site-font-heading":
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  "--site-font-body":
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  "--site-font-heading-weight": "700",
  "--site-font-body-weight": "400",
}

/** Allowlisted font keys — never accept arbitrary CSS font-family from tenant data. */
const FONT_ALLOWLIST = {
  modern: {
    heading: DEFAULTS["--site-font-heading"],
    body: DEFAULTS["--site-font-body"],
    load: null,
  },
  classic: {
    heading: 'Georgia, "Times New Roman", Times, serif',
    body: 'Georgia, "Times New Roman", Times, serif',
    load: null,
  },
  lato: {
    heading: '"Lato", ui-sans-serif, system-ui, sans-serif',
    body: '"Lato", ui-sans-serif, system-ui, sans-serif',
    load: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
  },
}

const SHADOW_ALLOWLIST = {
  none: "none",
  subtle: "0 1px 2px hsl(220 15% 15% / 0.06), 0 4px 12px hsl(220 15% 15% / 0.04)",
  elevated: "0 4px 6px hsl(220 15% 15% / 0.06), 0 12px 24px hsl(220 15% 15% / 0.08)",
}

const DENSITY_ALLOWLIST = {
  compact: { section: "3rem", container: "1100px" },
  regular: { section: "4rem", container: "1280px" },
}

const RADIUS_ALLOWLIST = {
  none: "0",
  sm: "0.375rem",
  md: "0.75rem",
  lg: "1rem",
  pill: "999px",
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

/**
 * @param {unknown} typography
 * @returns {{ heading: string, body: string, load: string | null, key: string }}
 */
export function resolveFontStack(typography) {
  if (typeof typography !== "string") {
    return { ...FONT_ALLOWLIST.modern, key: "modern" }
  }
  const key = typography.trim().toLowerCase()
  const entry = FONT_ALLOWLIST[key]
  if (!entry) return { ...FONT_ALLOWLIST.modern, key: "modern" }
  return { ...entry, key }
}

/**
 * @param {unknown} value
 * @param {keyof typeof SHADOW_ALLOWLIST} fallback
 */
export function resolveShadowToken(value, fallback = "none") {
  if (typeof value !== "string") return SHADOW_ALLOWLIST[fallback]
  const key = value.trim().toLowerCase()
  return SHADOW_ALLOWLIST[key] ?? SHADOW_ALLOWLIST[fallback]
}

/**
 * @param {unknown} value
 * @param {keyof typeof RADIUS_ALLOWLIST} fallback
 */
export function resolveRadiusToken(value, fallback = "md") {
  if (typeof value !== "string") return RADIUS_ALLOWLIST[fallback]
  const key = value.trim().toLowerCase()
  return RADIUS_ALLOWLIST[key] ?? RADIUS_ALLOWLIST[fallback]
}

/**
 * @param {unknown} value
 * @param {keyof typeof DENSITY_ALLOWLIST} fallback
 */
export function resolveDensityTokens(value, fallback = "regular") {
  if (typeof value !== "string") return DENSITY_ALLOWLIST[fallback]
  const key = value.trim().toLowerCase()
  return DENSITY_ALLOWLIST[key] ?? DENSITY_ALLOWLIST[fallback]
}

/**
 * Optional theme extensions from allowlisted content keys (no free CSS).
 * @typedef {{
 *   density?: string | null
 *   shadow?: string | null
 *   radius?: string | null
 *   buttonRadius?: string | null
 *   cardRadius?: string | null
 *   imageRadius?: string | null
 *   surfaceAlt?: string | null
 *   cardBorder?: string | null
 * }} ThemeExtras
 *
 * @param {{
 *   primaryColor?: string | null
 *   secondaryColor?: string | null
 *   accentColor?: string | null
 *   typography?: string | null
 * } | null} branding
 * @param {ThemeExtras | null | undefined} extras
 */
export function themeTokensFromBranding(branding, extras = null) {
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

  const density = resolveDensityTokens(extras?.density)
  const radius = resolveRadiusToken(extras?.radius, "md")
  const buttonRadius = resolveRadiusToken(extras?.buttonRadius ?? extras?.radius, "md")
  const cardRadius = resolveRadiusToken(extras?.cardRadius ?? extras?.radius, "md")
  const imageRadius = resolveRadiusToken(extras?.imageRadius ?? extras?.radius, "md")
  const shadow = resolveShadowToken(extras?.shadow, "none")
  const surfaceAlt = sanitizeCssColor(
    extras?.surfaceAlt,
    DEFAULTS["--site-color-surface-alt"],
  )
  const cardBorder = sanitizeCssColor(
    extras?.cardBorder,
    DEFAULTS["--site-color-card-border"],
  )

  return {
    "--site-color-primary": primary,
    "--site-color-secondary":
      secondaryL != null && secondaryL >= 80
        ? DEFAULTS["--site-color-secondary"]
        : secondary,
    "--site-color-accent": accent,
    "--site-color-background": background,
    "--site-color-text": DEFAULTS["--site-color-text"],
    "--site-color-text-muted": DEFAULTS["--site-color-text-muted"],
    "--site-color-text-inverse": DEFAULTS["--site-color-text-inverse"],
    "--site-color-surface": DEFAULTS["--site-color-surface"],
    "--site-color-surface-alt": surfaceAlt,
    "--site-color-card": DEFAULTS["--site-color-card"],
    "--site-color-card-border": cardBorder,
    "--site-radius": radius,
    "--site-radius-button": buttonRadius,
    "--site-radius-card": cardRadius,
    "--site-radius-image": imageRadius,
    "--site-shadow": shadow,
    "--site-container-max": density.container,
    "--site-section-space": density.section,
    "--site-font-heading": fonts.heading,
    "--site-font-body": fonts.body,
    "--site-font-heading-weight": DEFAULTS["--site-font-heading-weight"],
    "--site-font-body-weight": DEFAULTS["--site-font-body-weight"],
    /** Non-CSS metadata for font loading (stripped from inline style). */
    __fontLoadUrl: fonts.load,
    __fontKey: fonts.key,
  }
}

/** Inline style attribute value — only allowlisted custom properties. */
export function themeTokensToInlineStyle(tokens) {
  return Object.entries(tokens)
    .filter(([key]) => key.startsWith("--"))
    .map(([key, value]) => `${key}:${value}`)
    .join(";")
}

export const THEME_FONT_KEYS = Object.keys(FONT_ALLOWLIST)
export const THEME_SHADOW_KEYS = Object.keys(SHADOW_ALLOWLIST)
export const THEME_RADIUS_KEYS = Object.keys(RADIUS_ALLOWLIST)
export const THEME_DENSITY_KEYS = Object.keys(DENSITY_ALLOWLIST)
