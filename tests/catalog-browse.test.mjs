import assert from "node:assert/strict";
import test from "node:test";
import {
  filterCatalogProducts,
  readCatalogFilters,
  resolveTaxonomyFilter,
} from "../src/lib/catalogBrowse.js";

const taxonomy = [
  {
    kind: "category",
    id: "d3c5eff9-fb6f-47c5-abf3-4483ef37c7ac",
    name: "Natlan",
    slug: "natlan",
    sort_order: 1,
    image_url: null,
    product_count: 72,
  },
  {
    kind: "line",
    id: "a38458eb-1a8a-4585-9098-42df90a56865",
    name: "Natlan Botone",
    slug: "natlan-botone",
    sort_order: 1,
    image_url: null,
    product_count: 5,
  },
  {
    kind: "collection",
    id: "b744a725-e015-4fc4-ae8c-ad517f846b58",
    name: "Shabat",
    slug: "shabat",
    sort_order: 0,
    image_url: null,
    product_count: 7,
  },
];

const products = [
  {
    product_id: "1",
    name: "A",
    slug: "a",
    price: 10,
    image_url: null,
    featured: true,
    sort_order: 0,
    company_name: "X",
    whatsapp_number: null,
    category_slug: "natlan",
    category_name: "Natlan",
    line_slug: "natlan-botone",
    line_name: "Natlan Botone",
    collection_slugs: ["shabat"],
  },
  {
    product_id: "2",
    name: "B",
    slug: "b",
    price: 10,
    image_url: null,
    featured: false,
    sort_order: 1,
    company_name: "X",
    whatsapp_number: null,
    category_slug: "mezuza",
    category_name: "Mezuzá",
    line_slug: "other",
    line_name: "Other",
    collection_slugs: [],
  },
];

test("resolveTaxonomyFilter accepts UUID and slug", () => {
  const byId = resolveTaxonomyFilter(
    "d3c5eff9-fb6f-47c5-abf3-4483ef37c7ac",
    taxonomy,
    "category",
  );
  const bySlug = resolveTaxonomyFilter("natlan", taxonomy, "category");
  assert.equal(byId?.slug, "natlan");
  assert.equal(bySlug?.id, byId?.id);
  assert.equal(resolveTaxonomyFilter("missing-xyz", taxonomy, "category"), null);
});

test("filterCatalogProducts supports Golden UUID category filter", () => {
  const filters = readCatalogFilters(
    new URLSearchParams("category=d3c5eff9-fb6f-47c5-abf3-4483ef37c7ac"),
  );
  const filtered = filterCatalogProducts(products, filters, taxonomy);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].slug, "a");
});

test("filterCatalogProducts supports slug category filter", () => {
  const filters = readCatalogFilters(new URLSearchParams("category=natlan"));
  const filtered = filterCatalogProducts(products, filters, taxonomy);
  assert.equal(filtered.length, 1);
});

test("invalid category filter yields empty set", () => {
  const filters = readCatalogFilters(new URLSearchParams("category=zzzz"));
  const filtered = filterCatalogProducts(products, filters, taxonomy);
  assert.equal(filtered.length, 0);
});

test("combined category + collection filter", () => {
  const filters = readCatalogFilters(
    new URLSearchParams("category=natlan&colecao=shabat"),
  );
  const filtered = filterCatalogProducts(products, filters, taxonomy);
  assert.equal(filtered.length, 1);
});
