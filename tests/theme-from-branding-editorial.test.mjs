import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  resolveFontStack,
  themeTokensFromBranding,
  THEME_FONT_KEYS,
} from "../src/lib/themeFromBranding.js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

test("FONT_ALLOWLIST includes editorial_serif and keeps classic→Lato", () => {
  assert.ok(THEME_FONT_KEYS.includes("editorial_serif"))
  assert.ok(THEME_FONT_KEYS.includes("editorial"))
  assert.ok(THEME_FONT_KEYS.includes("classic"))

  const serif = resolveFontStack("editorial_serif")
  assert.equal(serif.key, "editorial_serif")
  assert.match(serif.heading, /Cormorant Garamond/)
  assert.match(serif.body, /Inter/)
  assert.equal(serif.load, "/fonts/cormorant/cormorant.css")

  const classic = resolveFontStack("classic")
  assert.equal(classic.key, "classic")
  assert.match(classic.heading, /Lato/)
  assert.equal(classic.load, "/fonts/lato/lato.css")
})

test("self-hosted Cormorant stylesheet exists for editorial_serif load URL", () => {
  const cssPath = join(ROOT, "public/fonts/cormorant/cormorant.css")
  assert.equal(existsSync(cssPath), true)
  const css = readFileSync(cssPath, "utf8")
  assert.match(css, /Cormorant Garamond/)
  assert.match(css, /CormorantGaramond-Regular\.woff2/)
  assert.match(css, /CormorantGaramond-SemiBold\.woff2/)
})

test("editorial_serif tokens tighten radius defaults; explicit radius still wins", () => {
  const defaults = themeTokensFromBranding({ typography: "editorial_serif" })
  assert.equal(defaults["--site-radius"], "0.375rem")
  assert.equal(defaults["--site-radius-button"], "0.375rem")

  const none = themeTokensFromBranding(
    { typography: "editorial_serif" },
    { radius: "none" },
  )
  assert.equal(none["--site-radius"], "0")

  const modern = themeTokensFromBranding({ typography: "modern" })
  assert.equal(modern["--site-radius"], "0.75rem")
})
