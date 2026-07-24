import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveShopNavItems,
  resolveShopSolidLogoUrl,
} from "../src/lib/resolveShopNavItems.js"

test("resolveShopNavItems builds collection-aware line hrefs + Catálogo", () => {
  const nav = resolveShopNavItems([
    { kind: "collection", slug: "shabat", name: "Shabat Col" },
    {
      kind: "line",
      id: "line-shabat",
      name: "Shabat",
      slug: "shabat",
      show_in_nav: true,
      sort_order: 1,
    },
    {
      kind: "line",
      id: "line-chaguim",
      name: "Chaguim",
      slug: "chaguim",
      show_in_nav: true,
      sort_order: 0,
    },
    {
      kind: "line",
      id: "line-hidden",
      name: "Hidden",
      slug: "hidden",
      show_in_nav: false,
      sort_order: 9,
    },
  ])

  assert.deepEqual(nav, [
    { label: "Chaguim", href: "/catalogo?line=line-chaguim" },
    { label: "Shabat", href: "/catalogo?colecao=shabat" },
    { label: "Catálogo", href: "/catalogo", separatorBefore: true },
  ])
})

test("resolveShopSolidLogoUrl prefers brand crest", () => {
  assert.equal(
    resolveShopSolidLogoUrl({
      logoUrl: "https://cdn.example/brand.png",
      logoHorizontalUrl: "https://cdn.example/horizontal.png",
    }),
    "https://cdn.example/brand.png",
  )
  assert.equal(
    resolveShopSolidLogoUrl({
      logoHorizontalUrl: "https://cdn.example/horizontal.png",
    }),
    "https://cdn.example/horizontal.png",
  )
})
