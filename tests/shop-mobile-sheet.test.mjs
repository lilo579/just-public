import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const headerSrc = readFileSync(join(root, "src/components/Header.astro"), "utf8")

test("shop mobile sheet is gated to chrome=shop only", () => {
  assert.match(headerSrc, /isShopChrome && \(/)
  assert.match(headerSrc, /id=\{shopSheetId\}/)
  assert.match(headerSrc, /getAttribute\("data-chrome"\) !== "shop"/)
})

test("shop mobile uses LG breakpoint and hides wrapped nav", () => {
  assert.match(headerSrc, /@media \(max-width: 1023px\)/)
  assert.match(headerSrc, /@media \(min-width: 1024px\)/)
  assert.match(headerSrc, /site-header__menu-btn/)
  assert.match(headerSrc, /display: none !important/)
  assert.doesNotMatch(
    headerSrc,
    /max-width: 1023px\)[\s\S]*site-header__nav[\s\S]*flex-wrap:\s*wrap/,
  )
})

test("shop sheet covers GM mobile menu behaviors", () => {
  assert.match(headerSrc, /side="right"|translateX\(100%\)/)
  assert.match(headerSrc, /box-sizing:\s*border-box/)
  assert.match(headerSrc, /min\(280px,\s*100vw\)/)
  assert.match(headerSrc, /Explorar/)
  assert.match(headerSrc, /Institucional/)
  assert.match(headerSrc, /Catálogo completo/)
  assert.match(headerSrc, /aria-expanded/)
  assert.match(headerSrc, /aria-controls/)
  assert.match(headerSrc, /aria-modal/)
  assert.match(headerSrc, /Escape/)
  assert.match(headerSrc, /data-shop-sheet-open/)
  assert.match(headerSrc, /prefers-reduced-motion/)
  assert.match(headerSrc, /host=\$\{encodeURIComponent\(hostParam\)\}/)
})
