import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveCanonicalShopHeroUrl,
  resolveOwnedShopMediaUrl,
} from "../src/lib/f3ShopMedia.js"

const HOST = "3djewish.com.br"

test("rewrites SPA production hotlinks to Worker-owned paths", () => {
  assert.equal(
    resolveOwnedShopMediaUrl("https://3djewish.com.br/hero.jpg", HOST),
    "/presentation/f3_3d_jewish/hero.jpg",
  )
  assert.equal(
    resolveOwnedShopMediaUrl("https://3djewish.com.br/categories/mezuza.jpg", HOST),
    "/presentation/f3_3d_jewish/categories/mezuza.jpg",
  )
  assert.equal(
    resolveOwnedShopMediaUrl("/lines/pessach.jpg", HOST),
    "/presentation/f3_3d_jewish/lines/pessach.jpg",
  )
})

test("preserves Hub Supabase product/editorial ownership", () => {
  const hub =
    "https://ehondnpqztvybvgsjnxe.supabase.co/storage/v1/object/public/product-images/76a96afa/x/main.webp"
  assert.equal(resolveOwnedShopMediaUrl(hub, HOST), hub)
})

test("canonical hero prefers CMS then editorial then Worker default", () => {
  assert.equal(
    resolveCanonicalShopHeroUrl({
      host: HOST,
      catalogHeroUrl: "https://3djewish.com.br/hero.jpg",
      editorialHeroUrl:
        "https://ehondnpqztvybvgsjnxe.supabase.co/storage/v1/object/public/site-assets/x.webp",
    }),
    "/presentation/f3_3d_jewish/hero.jpg",
  )
  assert.equal(
    resolveCanonicalShopHeroUrl({
      host: HOST,
      catalogHeroUrl: null,
      editorialHeroUrl:
        "https://ehondnpqztvybvgsjnxe.supabase.co/storage/v1/object/public/site-assets/x.webp",
    }),
    "https://ehondnpqztvybvgsjnxe.supabase.co/storage/v1/object/public/site-assets/x.webp",
  )
  assert.equal(
    resolveCanonicalShopHeroUrl({
      host: HOST,
      catalogHeroUrl: null,
      editorialHeroUrl: null,
    }),
    "/presentation/f3_3d_jewish/hero.jpg",
  )
})

test("does not rewrite non-3D hosts aggressively", () => {
  assert.equal(
    resolveOwnedShopMediaUrl("/lines/pessach.jpg", "marceloborer.com.br"),
    "/lines/pessach.jpg",
  )
})
