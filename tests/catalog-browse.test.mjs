import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogBrowseView,
  filterCatalogProducts,
  groupCatalogProductsByLine,
  productBelongsToLine,
  readCatalogFilters,
  resolveCatalogLineHref,
  resolveCatalogProductFilter,
  resolveTaxonomyFilter,
} from "../src/lib/catalogBrowse.js";
import { resolveShopNavItems } from "../src/lib/resolveShopNavItems.js";

const TENANT_A = "76a96afa-80f9-4782-a08d-e869e79d7d84";
const TENANT_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const NATLAN_LINE_ID = "33ddd67b-9cc5-4458-9d46-3f5a9df70c16";
const MEZUZA_LINE_ID = "dbe23f90-427d-4210-b19b-0977e7ea2b8b";
const EMPTY_LINE_ID = "11111111-2222-3333-4444-555555555555";
const SIMILAR_LINE_ID = "99999999-aaaa-bbbb-cccc-dddddddddddd";

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

function lineRow(overrides) {
  return {
    tenant_id: TENANT_A,
    kind: "line",
    sort_order: 0,
    image_url: null,
    product_count: 0,
    slug: null,
    ...overrides,
  };
}

function productRow(overrides) {
  return {
    tenant_id: TENANT_A,
    price: 10,
    image_url: null,
    featured: false,
    sort_order: 0,
    company_name: "3D Jewish",
    whatsapp_number: null,
    category_id: null,
    category_slug: null,
    category_name: null,
    collection_slugs: [],
    line_slug: null,
    ...overrides,
  };
}

const jewishTaxonomy = [
  lineRow({
    id: NATLAN_LINE_ID,
    name: "Natlan Elegance",
    slug: null,
    sort_order: 1,
    product_count: 1,
  }),
  lineRow({
    id: MEZUZA_LINE_ID,
    name: "Mezuzá Multicolor",
    slug: null,
    sort_order: 2,
    product_count: 2,
  }),
  lineRow({
    id: EMPTY_LINE_ID,
    name: "Linha vazia",
    slug: null,
    sort_order: 3,
    product_count: 0,
  }),
  lineRow({
    id: SIMILAR_LINE_ID,
    name: "Mezuzá Multicolor Extra",
    slug: "mezuza-multicolor-extra",
    sort_order: 4,
    product_count: 1,
  }),
];

const jewishProducts = [
  productRow({
    product_id: "66c3133d-a872-4c0f-94a1-927dad48ce20",
    name: "Natlan Elegance",
    slug: "natlan-elegance",
    line_id: NATLAN_LINE_ID,
    line_name: "Natlan Elegance",
    line_slug: null,
    sort_order: 0,
  }),
  productRow({
    product_id: "288bf8cb-3740-45e5-8a84-8e65d169fbcd",
    name: "Mezuzá Multicolor - Tons vinho/prata",
    slug: "mezuza-multicolor---tons-vinhoprata",
    line_id: MEZUZA_LINE_ID,
    line_name: "Mezuzá Multicolor",
    line_slug: null,
    sort_order: 1,
  }),
  productRow({
    product_id: "45aedba9-aebb-41be-b393-f52b304529d3",
    name: "Mezuzá Multicolor - Tons azuis",
    slug: "mezuza-multicolor",
    line_id: MEZUZA_LINE_ID,
    line_name: "Mezuzá Multicolor",
    line_slug: null,
    sort_order: 2,
  }),
  productRow({
    product_id: "similar-line-product",
    name: "Mezuzá similar slug",
    slug: "mezuza-multicolor-extra",
    line_id: SIMILAR_LINE_ID,
    line_name: "Mezuzá Multicolor Extra",
    line_slug: "mezuza-multicolor-extra",
    sort_order: 3,
  }),
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

test("distinct lines receive independent product sets", () => {
  const groups = groupCatalogProductsByLine(jewishProducts, jewishTaxonomy);
  const natlan = groups.find((row) => row.line.id === NATLAN_LINE_ID);
  const mezuza = groups.find((row) => row.line.id === MEZUZA_LINE_ID);
  assert.deepEqual(
    natlan.products.map((product) => product.slug),
    ["natlan-elegance"],
  );
  assert.deepEqual(
    mezuza.products.map((product) => product.slug),
    ["mezuza-multicolor---tons-vinhoprata", "mezuza-multicolor"],
  );
  assert.notEqual(natlan.products, mezuza.products);
  mezuza.products.push(natlan.products[0]);
  const regrouped = groupCatalogProductsByLine(jewishProducts, jewishTaxonomy);
  assert.equal(regrouped.find((row) => row.line.id === NATLAN_LINE_ID).products.length, 1);
  assert.equal(regrouped.find((row) => row.line.id === MEZUZA_LINE_ID).products.length, 2);
});

test("a product appears only on the line matching its line_id", () => {
  const matches = jewishTaxonomy.filter((line) =>
    productBelongsToLine(jewishProducts[0], line),
  );
  assert.deepEqual(
    matches.map((line) => line.id),
    [NATLAN_LINE_ID],
  );
});

test("empty line does not inherit products from another line", () => {
  const view = buildCatalogBrowseView(jewishProducts, jewishTaxonomy, {
    category: null,
    line: EMPTY_LINE_ID,
    collection: null,
  });
  assert.equal(view.activeLine?.id, EMPTY_LINE_ID);
  assert.equal(view.lineRails.length, 0);
  assert.equal(view.scopedProducts.length, 0);
});

test("similar slugs or names do not mix line groups", () => {
  const view = buildCatalogBrowseView(jewishProducts, jewishTaxonomy, {
    category: null,
    line: MEZUZA_LINE_ID,
    collection: null,
  });
  assert.deepEqual(
    view.scopedProducts.map((product) => product.slug),
    ["mezuza-multicolor---tons-vinhoprata", "mezuza-multicolor"],
  );
  const similar = buildCatalogBrowseView(jewishProducts, jewishTaxonomy, {
    category: null,
    line: "mezuza-multicolor-extra",
    collection: null,
  });
  assert.deepEqual(
    similar.scopedProducts.map((product) => product.slug),
    ["mezuza-multicolor-extra"],
  );
});

test("tenant A never receives tenant B products even with matching names", () => {
  const foreign = productRow({
    tenant_id: TENANT_B,
    product_id: "foreign-natlan",
    name: "Natlan Elegance",
    slug: "natlan-elegance-b",
    line_id: NATLAN_LINE_ID,
    line_name: "Natlan Elegance",
    line_slug: null,
  });
  const mixed = [...jewishProducts, foreign];
  const view = buildCatalogBrowseView(mixed, jewishTaxonomy, {
    category: null,
    line: NATLAN_LINE_ID,
    collection: null,
  });
  assert.deepEqual(
    view.scopedProducts.map((product) => product.product_id),
    ["66c3133d-a872-4c0f-94a1-927dad48ce20"],
  );
});

test("product order is preserved within a line rail", () => {
  const reversed = [jewishProducts[2], jewishProducts[1], jewishProducts[0]];
  const view = buildCatalogBrowseView(reversed, jewishTaxonomy, {
    category: null,
    line: MEZUZA_LINE_ID,
    collection: null,
  });
  assert.deepEqual(
    view.scopedProducts.map((product) => product.slug),
    ["mezuza-multicolor", "mezuza-multicolor---tons-vinhoprata"],
  );
});

test("homepage and line page share canonical line_id relationship", () => {
  const natlanLine = jewishTaxonomy[0];
  const href = resolveCatalogLineHref(natlanLine);
  assert.equal(href, `/catalogo?line=${NATLAN_LINE_ID}`);
  const nav = resolveShopNavItems([{ ...natlanLine, show_in_nav: true }]);
  assert.equal(nav[0].href, href);
  const filters = readCatalogFilters(new URLSearchParams(href.split("?")[1]));
  const filtered = filterCatalogProducts(jewishProducts, filters, jewishTaxonomy);
  assert.deepEqual(
    filtered.map((product) => product.slug),
    ["natlan-elegance"],
  );
});

test("Natlan Elegance and Mezuzá Multicolor no longer share the same payload", () => {
  const beforeBug = jewishProducts.filter(
    (product) => product.line_slug === jewishTaxonomy[0].slug,
  );
  assert.equal(beforeBug.length, 3);

  const natlan = buildCatalogBrowseView(jewishProducts, jewishTaxonomy, {
    category: null,
    line: NATLAN_LINE_ID,
    collection: null,
  });
  const mezuza = buildCatalogBrowseView(jewishProducts, jewishTaxonomy, {
    category: null,
    line: MEZUZA_LINE_ID,
    collection: null,
  });
  assert.deepEqual(
    natlan.lineRails[0].products.map((product) => product.slug),
    ["natlan-elegance"],
  );
  assert.deepEqual(
    mezuza.lineRails[0].products.map((product) => product.slug),
    ["mezuza-multicolor---tons-vinhoprata", "mezuza-multicolor"],
  );
});

test("null line slugs without line_id fail closed instead of returning all products", () => {
  const legacyProducts = jewishProducts.map((product) => ({
    ...product,
    line_id: null,
  }));
  const view = buildCatalogBrowseView(legacyProducts, jewishTaxonomy, {
    category: null,
    line: NATLAN_LINE_ID,
    collection: null,
  });
  assert.equal(view.scopedProducts.length, 0);
});

test("referenced missing line yields empty set and observable diagnostic", () => {
  const resolved = resolveCatalogProductFilter(
    jewishProducts,
    { category: null, line: "missing-line", collection: null },
    jewishTaxonomy,
  );
  assert.equal(resolved.products.length, 0);
  assert.deepEqual(resolved.diagnostics, [
    { code: "catalog_line_not_found", requested: "missing-line" },
  ]);
});

test("unfiltered catalog index keeps distinct rails for null-slug lines", () => {
  const view = buildCatalogBrowseView(jewishProducts, jewishTaxonomy, {
    category: null,
    line: null,
    collection: null,
  });
  const rails = Object.fromEntries(
    view.lineRails.map((row) => [row.line.id, row.products.map((product) => product.slug)]),
  );
  assert.deepEqual(rails[NATLAN_LINE_ID], ["natlan-elegance"]);
  assert.deepEqual(rails[MEZUZA_LINE_ID], [
    "mezuza-multicolor---tons-vinhoprata",
    "mezuza-multicolor",
  ]);
  assert.equal(rails[EMPTY_LINE_ID], undefined);
});
