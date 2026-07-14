export {
  sanitizeCssColor,
  resolveFontStack,
  themeTokensFromBranding,
  themeTokensToInlineStyle,
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
  "--site-color-background": string
  "--site-color-text": string
  "--site-radius": string
  "--site-font-heading": string
  "--site-font-body": string
}
