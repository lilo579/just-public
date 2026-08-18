/**
 * Reusable catalog browse helpers (F3 / shop tenants).
 * Canonical product↔line identity is line_id (UUID). Slug is display/URL only
 * and must never group distinct NULL/empty slugs together.
 */

/**
 * @typedef {{
 *   tenant_id?: string | null
 *   product_id: string
 *   name: string
 *   slug: string
 *   price: number | null
 *   image_url: string | null
 *   featured: boolean
 *   sort_order: number
 *   company_name: string | null
 *   whatsapp_number: string | null
 *   category_id?: string | null
 *   category_slug: string | null
 *   category_name: string | null
 *   line_id?: string | null
 *   line_slug: string | null
 *   line_name: string | null
 *   collection_slugs: string[] | null
 * }} CatalogProductRow
 */

/**
 * @typedef {{
 *   tenant_id?: string | null
 *   kind: 'category' | 'line' | 'collection' | string
 *   id: string
 *   name: string
 *   slug: string | null
 *   sort_order: number
 *   image_url: string | null
 *   product_count: number
 * }} CatalogTaxonomyRow
 */

/**
 * @typedef {{
 *   code: string
 *   requested: string
 * }} CatalogBrowseDiagnostic
 */

/**
 * @param {unknown} value
 */
function canonicalId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * @param {unknown} value
 */
function canonicalSlug(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * @param {{ tenant_id?: string | null } | null | undefined} left
 * @param {{ tenant_id?: string | null } | null | undefined} right
 */
function sameTenant(left, right) {
  const a = canonicalId(left?.tenant_id);
  const b = canonicalId(right?.tenant_id);
  if (!a || !b) return true;
  return a === b;
}

/**
 * @param {URLSearchParams} searchParams
 */
export function readCatalogFilters(searchParams) {
  return {
    // Preserve UUID case; only trim. Slug match is case-insensitive downstream.
    category: (searchParams.get("category") || "").trim() || null,
    line: (searchParams.get("line") || "").trim() || null,
    collection:
      (searchParams.get("colecao") || searchParams.get("collection") || "").trim() ||
      null,
  };
}

/**
 * Resolve a Golden Master filter value (UUID id or slug) to a taxonomy row.
 * Empty slugs are not identities — UUID match only in that case.
 * @param {string | null} param
 * @param {CatalogTaxonomyRow[]} taxonomy
 * @param {'category' | 'line' | 'collection'} kind
 * @returns {CatalogTaxonomyRow | null}
 */
export function resolveTaxonomyFilter(param, taxonomy, kind) {
  if (!param) return null;
  const rows = (taxonomy || []).filter((row) => row.kind === kind);
  const exact = rows.find((row) => row.id === param);
  if (exact) return exact;
  const lowered = param.toLowerCase();
  return (
    rows.find((row) => {
      const slug = canonicalSlug(row.slug);
      return slug && slug.toLowerCase() === lowered;
    }) || null
  );
}

/**
 * Homepage / nav href for a line. Uses canonical line.id unless the line slug
 * is also a collection slug (Golden Master collection alias).
 * @param {{ id?: string | null, slug?: string | null } | null | undefined} line
 * @param {Iterable<string> | Set<string> | null | undefined} collectionSlugs
 */
export function resolveCatalogLineHref(line, collectionSlugs = []) {
  const slug = canonicalSlug(line?.slug);
  const collections =
    collectionSlugs instanceof Set ? collectionSlugs : new Set(collectionSlugs || []);
  if (slug && collections.has(slug)) {
    return `/catalogo?colecao=${encodeURIComponent(slug)}`;
  }
  const id = canonicalId(line?.id);
  if (!id) return "/catalogo";
  return `/catalogo?line=${encodeURIComponent(id)}`;
}

/**
 * Match product to taxonomy row by canonical UUID. Slug is a fallback only when
 * both sides have a non-empty slug (never NULL === NULL).
 * @param {CatalogProductRow | null | undefined} product
 * @param {CatalogTaxonomyRow | null | undefined} line
 */
export function productBelongsToLine(product, line) {
  if (!product || !line || !sameTenant(product, line)) return false;
  const productLineId = canonicalId(product.line_id);
  const lineId = canonicalId(line.id);
  if (productLineId && lineId) return productLineId === lineId;
  const productSlug = canonicalSlug(product.line_slug);
  const lineSlug = canonicalSlug(line.slug);
  if (!productSlug || !lineSlug) return false;
  return productSlug === lineSlug;
}

/**
 * @param {CatalogProductRow | null | undefined} product
 * @param {CatalogTaxonomyRow | null | undefined} category
 */
export function productBelongsToCategory(product, category) {
  if (!product || !category || !sameTenant(product, category)) return false;
  const productCategoryId = canonicalId(product.category_id);
  const categoryId = canonicalId(category.id);
  if (productCategoryId && categoryId) return productCategoryId === categoryId;
  const productSlug = canonicalSlug(product.category_slug);
  const categorySlug = canonicalSlug(category.slug);
  if (!productSlug || !categorySlug) return false;
  return productSlug === categorySlug;
}

/**
 * Independent product arrays per line, preserving source order.
 * @param {CatalogProductRow[]} products
 * @param {CatalogTaxonomyRow[]} lines
 * @returns {Array<{ line: CatalogTaxonomyRow, products: CatalogProductRow[] }>}
 */
export function groupCatalogProductsByLine(products, lines) {
  const source = Array.isArray(products) ? products : [];
  const lineRows = Array.isArray(lines) ? lines : [];
  return lineRows.map((line) => ({
    line,
    products: source.filter((product) => productBelongsToLine(product, line)),
  }));
}

/**
 * @param {CatalogProductRow[]} products
 * @param {{ category: string | null, line: string | null, collection: string | null }} filters
 * @param {CatalogTaxonomyRow[]} [taxonomy]
 * @returns {{
 *   products: CatalogProductRow[]
 *   diagnostics: CatalogBrowseDiagnostic[]
 *   activeLine: CatalogTaxonomyRow | null
 *   activeCategory: CatalogTaxonomyRow | null
 *   activeCollection: CatalogTaxonomyRow | null
 * }}
 */
export function resolveCatalogProductFilter(products, filters, taxonomy = []) {
  const diagnostics = [];
  const category = resolveTaxonomyFilter(filters.category, taxonomy, "category");
  const line = resolveTaxonomyFilter(filters.line, taxonomy, "line");
  const collection = resolveTaxonomyFilter(
    filters.collection,
    taxonomy,
    "collection",
  );

  if (filters.line && !line) {
    diagnostics.push({ code: "catalog_line_not_found", requested: filters.line });
  }
  if (filters.category && !category) {
    diagnostics.push({
      code: "catalog_category_not_found",
      requested: filters.category,
    });
  }
  if (filters.collection && !collection) {
    diagnostics.push({
      code: "catalog_collection_not_found",
      requested: filters.collection,
    });
  }

  // Invalid explicit filters → empty set (do not silently show all).
  if (filters.category && !category) {
    return { products: [], diagnostics, activeLine: line, activeCategory: category, activeCollection: collection };
  }
  if (filters.line && !line) {
    return { products: [], diagnostics, activeLine: line, activeCategory: category, activeCollection: collection };
  }
  if (filters.collection && !collection) {
    return { products: [], diagnostics, activeLine: line, activeCategory: category, activeCollection: collection };
  }

  const filtered = products.filter((product) => {
    if (category && !productBelongsToCategory(product, category)) return false;
    if (line && !productBelongsToLine(product, line)) return false;
    if (collection) {
      const slugs = Array.isArray(product.collection_slugs)
        ? product.collection_slugs
        : [];
      const collectionSlug = canonicalSlug(collection.slug);
      if (!collectionSlug || !slugs.includes(collectionSlug)) return false;
    }
    return true;
  });

  return {
    products: filtered,
    diagnostics,
    activeLine: line,
    activeCategory: category,
    activeCollection: collection,
  };
}

/**
 * @param {CatalogProductRow[]} products
 * @param {{ category: string | null, line: string | null, collection: string | null }} filters
 * @param {CatalogTaxonomyRow[]} [taxonomy]
 */
export function filterCatalogProducts(products, filters, taxonomy = []) {
  return resolveCatalogProductFilter(products, filters, taxonomy).products;
}

/**
 * Catalog page model: line scope first, then optional category, then rails.
 * @param {CatalogProductRow[]} products
 * @param {CatalogTaxonomyRow[]} taxonomy
 * @param {{ category: string | null, line: string | null, collection: string | null }} filters
 */
export function buildCatalogBrowseView(products, taxonomy, filters) {
  const catalogProducts = Array.isArray(products) ? products : [];
  const rows = Array.isArray(taxonomy) ? taxonomy : [];
  const resolved = resolveCatalogProductFilter(catalogProducts, filters, rows);
  const diagnostics = resolved.diagnostics.slice();

  const categories = rows.filter((row) => row.kind === "category");
  const lines = rows
    .filter((row) => row.kind === "line")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const activeLine = resolved.activeLine;
  const activeCategory = resolved.activeCategory;
  const activeCollection = resolved.activeCollection;

  const baseProducts =
    filters.line && !activeLine
      ? []
      : activeLine
        ? catalogProducts.filter((product) => productBelongsToLine(product, activeLine))
        : catalogProducts.slice();

  const displayCategories = categories.filter((category) =>
    baseProducts.some((product) => productBelongsToCategory(product, category)),
  );

  const effectiveCategory =
    activeCategory && displayCategories.some((category) => category.id === activeCategory.id)
      ? activeCategory
      : null;

  const scopedProducts = effectiveCategory
    ? baseProducts.filter((product) =>
        productBelongsToCategory(product, effectiveCategory),
      )
    : baseProducts;

  const displayLines = activeLine
    ? lines.filter((line) => line.id === activeLine.id)
    : lines.filter((line) =>
        scopedProducts.some((product) => productBelongsToLine(product, line)),
      );

  const lineRails = groupCatalogProductsByLine(scopedProducts, displayLines).filter(
    (row) => row.products.length > 0,
  );

  return {
    diagnostics,
    categories,
    lines,
    activeLine,
    activeCategory,
    activeCollection,
    effectiveCategory,
    displayCategories,
    displayLines,
    scopedProducts,
    lineRails,
  };
}

/**
 * When the tenant was selected via `?host=` (Workers preview / local),
 * preserve that host on catalog and PDP links. Production apex has no
 * `?host=` → returns "" so hrefs stay clean (`/p/slug`).
 *
 * @param {URLSearchParams} searchParams
 * @param {string | null | undefined} resolvedHost
 * @returns {string}
 */
export function resolveCatalogHostOverride(searchParams, resolvedHost) {
  const host = typeof resolvedHost === "string" ? resolvedHost.trim() : "";
  if (!host) return "";
  if (searchParams && searchParams.has("host")) return host;
  return "";
}

/**
 * @param {string | null | undefined} hostOverride
 * @param {string} path
 * @param {Record<string, string | null | undefined>} params
 */
export function buildCatalogHref(hostOverride, path, params = {}) {
  const url = new URL(path, "https://example.invalid");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  if (hostOverride) url.searchParams.set("host", hostOverride);
  return `${url.pathname}${url.search}`;
}

/**
 * @param {Array<{ href?: string, label?: string } | null | undefined> | null | undefined} navItems
 * @param {string | null | undefined} hostOverride
 */
export function applyHostOverrideToNavItems(navItems, hostOverride) {
  if (!hostOverride || !Array.isArray(navItems)) return navItems || [];
  return navItems.map((item) => {
    if (!item || typeof item !== "object") return item;
    const href = typeof item.href === "string" ? item.href.trim() : "";
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
      return item;
    }
    if (!href) return item;
    return { ...item, href: buildCatalogHref(hostOverride, href) };
  });
}

/**
 * @param {number | null | undefined} price
 */
export function formatCatalogPrice(price) {
  if (price == null || Number.isNaN(Number(price))) return null;
  return `R$ ${Number(price).toFixed(0)}`;
}
