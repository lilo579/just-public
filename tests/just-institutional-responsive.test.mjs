import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const css = fs.readFileSync(
  path.join(root, "src/styles/just-institutional.css"),
  "utf8",
)
const headerSrc = fs.readFileSync(
  path.join(root, "src/components/just-institutional/JustHeader.astro"),
  "utf8",
)

test("header CTA is marked for responsive visibility control", () => {
  assert.match(headerSrc, /class="premium-button just-header__cta"/)
})

test("mobile header uses a 2-column row so logo and actions cannot collide", () => {
  const rowBlock = css.slice(
    css.indexOf(".just-header__row {"),
    css.indexOf(".just-header__brand {"),
  )
  assert.match(rowBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
  assert.doesNotMatch(
    rowBlock,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/,
  )
})

test("desktop header chrome (nav, Entrar, CTA) starts at lg, not md", () => {
  assert.match(css, /\.just-header__cta\s*\{[\s\S]*?display:\s*none/)

  const headerStart = css.indexOf("/* Institutional header")
  const headerEnd = css.indexOf("/* Near-invisible structural atmosphere")
  assert.ok(headerStart >= 0 && headerEnd > headerStart)
  const headerCss = css.slice(headerStart, headerEnd)

  assert.doesNotMatch(headerCss, /@media \(min-width: 768px\)/)
  assert.match(
    headerCss,
    /@media \(min-width: 1024px\) \{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/,
  )
  assert.match(
    headerCss,
    /@media \(min-width: 1024px\) \{[\s\S]*?\.just-header__nav\s*\{[\s\S]*?display:\s*flex/,
  )
  assert.match(
    headerCss,
    /@media \(min-width: 1024px\) \{[\s\S]*?\.just-header__cta\s*\{[\s\S]*?display:\s*inline-flex/,
  )
  assert.match(
    headerCss,
    /@media \(min-width: 1024px\) \{[\s\S]*?\.just-header__menu-trigger\s*\{[\s\S]*?display:\s*none/,
  )
})
