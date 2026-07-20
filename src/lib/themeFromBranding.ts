export {
  sanitizeCssColor,
  parseCssColorLightness,
  resolveFontStack,
  resolveShadowToken,
  resolveRadiusToken,
  resolveDensityTokens,
  themeTokensFromBranding,
  themeTokensToInlineStyle,
  THEME_FONT_KEYS,
  THEME_SHADOW_KEYS,
  THEME_RADIUS_KEYS,
  THEME_DENSITY_KEYS,
} from "./themeFromBranding.js"

export type BrandingInput = {
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  typography?: string | null
} | null | undefined

export type SiteThemeTokens = {
  "--site-color-primary": string
  "--site-color-secondary": string
  "--site-color-accent": string
  "--site-color-background": string
  "--site-color-text": string
  "--site-color-text-muted": string
  "--site-color-text-inverse": string
  "--site-color-surface": string
  "--site-color-surface-alt": string
  "--site-color-card": string
  "--site-color-card-border": string
  "--site-radius": string
  "--site-radius-button": string
  "--site-radius-card": string
  "--site-radius-image": string
  "--site-shadow": string
  "--site-container-max": string
  "--site-section-space": string
  "--site-font-heading": string
  "--site-font-body": string
  "--site-font-heading-weight": string
  "--site-font-body-weight": string
  __fontLoadUrl?: string | null
  __fontKey?: string
}
