import test from "node:test"
import assert from "node:assert/strict"
import {
  applyHostOverrideToNavItems,
  buildCatalogHref,
  resolveCatalogHostOverride,
} from "../src/lib/catalogBrowse.js"

test("resolveCatalogHostOverride preserves ?host= for Workers preview", () => {
  const params = new URLSearchParams("host=3djewish.com.br")
  assert.equal(
    resolveCatalogHostOverride(params, "3djewish.com.br"),
    "3djewish.com.br",
  )
})

test("resolveCatalogHostOverride is empty on production apex (no ?host=)", () => {
  const params = new URLSearchParams()
  assert.equal(resolveCatalogHostOverride(params, "3djewish.com.br"), "")
})

test("buildCatalogHref appends host only when override is set", () => {
  assert.equal(buildCatalogHref("", "/p/azul-titnio-4"), "/p/azul-titnio-4")
  assert.equal(
    buildCatalogHref("3djewish.com.br", "/p/azul-titnio-4"),
    "/p/azul-titnio-4?host=3djewish.com.br",
  )
  assert.equal(
    buildCatalogHref("3djewish.com.br", "/catalogo", { category: "natlan" }),
    "/catalogo?category=natlan&host=3djewish.com.br",
  )
})

test("applyHostOverrideToNavItems rewrites relative nav hrefs", () => {
  const items = applyHostOverrideToNavItems(
    [
      { label: "Catálogo", href: "/catalogo" },
      { label: "Ext", href: "https://wa.me/1" },
    ],
    "3djewish.com.br",
  )
  assert.equal(items[0].href, "/catalogo?host=3djewish.com.br")
  assert.equal(items[1].href, "https://wa.me/1")
})
